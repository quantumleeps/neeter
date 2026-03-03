import type {
  CustomEvent,
  PermissionRequest,
  PermissionResponse,
  RewindFilesResult,
  SessionHistoryEntry,
  SSEEvent,
} from "@neeter/types";
import { type ChatStore, replayEvents } from "./store.js";

export interface AgentClientConfig {
  endpoint?: string;
  onCustomEvent?: (event: CustomEvent) => void;
}

export interface ResumeOptions {
  fork?: boolean;
  sdkSessionId?: string;
  resumeSessionAt?: string;
}

export interface RewindOptions {
  dryRun?: boolean;
}

/**
 * Framework-agnostic client that manages the EventSource lifecycle and feeds
 * SSE events into a Zustand ChatStore. Handles session creation, resumption,
 * message sending, permissions, and cleanup.
 */
export class AgentClient {
  private store: ChatStore;
  private endpoint: string;
  private eventSource: EventSource | null = null;
  private aborted = false;
  private _sessionHistory: SessionHistoryEntry[] = [];
  private initCancelled = false;
  onCustomEvent?: (event: CustomEvent) => void;

  onHistoryChange?: (history: SessionHistoryEntry[]) => void;

  // biome-ignore lint/suspicious/noExplicitAny: mirrors JSON.parse return type
  private parseEvent(e: MessageEvent): any {
    try {
      return JSON.parse(e.data);
    } catch {
      console.warn("[neeter] malformed SSE event:", e.type);
      return null;
    }
  }

  private formatError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private surfaceError(label: string, err: unknown): void {
    this.store.getState().addSystemMessage(`Failed to ${label}: ${this.formatError(err)}`);
  }

  private async fetchOk(url: string, init?: RequestInit, label?: string): Promise<Response> {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`${label ?? "Request"} failed with status ${res.status}`);
    }
    return res;
  }

  // biome-ignore lint/suspicious/noExplicitAny: wraps fetch + JSON parsing
  private async fetchJson(url: string, init?: RequestInit, label?: string): Promise<any> {
    const res = await this.fetchOk(url, init, label);
    return res.json();
  }

  constructor(store: ChatStore, config?: AgentClientConfig) {
    this.store = store;
    this.endpoint = config?.endpoint ?? "/api";
    this.onCustomEvent = config?.onCustomEvent;
  }

  get sessionId(): string | null {
    return this.store.getState().sessionId;
  }

  get sdkSessionId(): string | null {
    return this.store.getState().sdkSessionId;
  }

  get sessionHistory(): SessionHistoryEntry[] {
    return this._sessionHistory;
  }

  /**
   * Creates or resumes a session. Sets `sessionId` in the store on success.
   * Callers must call `attachEventSource()` separately after the sessionId
   * is set — in `@neeter/react` this happens via `useEffect`.
   */
  async connect(resumeSessionId?: string): Promise<void> {
    this.initCancelled = false;
    const target = resumeSessionId;

    try {
      if (target) {
        try {
          const eventsRes = await fetch(`${this.endpoint}/sessions/replay/${target}`);
          if (eventsRes.ok && !this.initCancelled) {
            const events: SSEEvent[] = await eventsRes.json();
            replayEvents(this.store, events);
          }
        } catch (err) {
          console.warn("[neeter] replay failed:", err);
        }
      }

      const data = target
        ? await this.fetchJson(
            `${this.endpoint}/sessions/resume`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sdkSessionId: target }),
            },
            "Session request",
          )
        : await this.fetchJson(`${this.endpoint}/sessions`, { method: "POST" }, "Session request");

      if (!data.sessionId) {
        throw new Error("Server response missing sessionId");
      }
      if (!this.initCancelled) {
        this.store.getState().setSessionId(data.sessionId);
      }
    } catch (err) {
      this.surfaceError("connect", err);
      throw err;
    }
  }

  /**
   * Opens an EventSource for the current sessionId and wires up all SSE
   * event handlers. In `@neeter/react` this is called via `useEffect` —
   * standalone consumers must call it explicitly after `connect()`.
   */
  attachEventSource(): void {
    const sid = this.sessionId;
    if (!sid) return;

    if (this.eventSource) {
      this.eventSource.close();
    }

    const es = new EventSource(`${this.endpoint}/sessions/${sid}/events`);
    this.eventSource = es;
    this.aborted = false;
    const s = this.store;

    es.addEventListener("session_init", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      const { sdkSessionId: id, mcpServers, fileCheckpointing } = data;
      s.getState().setSdkSessionId(id);
      if (mcpServers) s.getState().setMcpServers(mcpServers);
      if (fileCheckpointing) s.getState().setFileCheckpointing(true);
    });

    es.addEventListener("message_start", () => {
      s.getState().setThinking(true);
    });

    es.addEventListener("thinking_delta", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().appendStreamingThinking(data.text);
    });

    es.addEventListener("text_delta", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().setThinking(false);
      s.getState().flushStreamingThinking();
      s.getState().appendStreamingText(data.text);
    });

    es.addEventListener("tool_start", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().setThinking(false);
      s.getState().flushStreamingThinking();
      s.getState().flushStreamingText();
      s.getState().startToolCall(data.id, data.name);
    });

    es.addEventListener("tool_input_delta", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().appendToolInput(data.id, data.partialJson);
    });

    es.addEventListener("tool_call", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().flushStreamingText();
      s.getState().finalizeToolCall(data.id, data.name, data.input);
    });

    es.addEventListener("tool_result", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      const { toolUseId, result, isError } = data;
      if (isError) {
        s.getState().errorToolCall(toolUseId, result);
      } else {
        s.getState().completeToolCall(toolUseId, result);
      }
      if (s.getState().isStreaming) {
        s.getState().setThinking(true);
      }
    });

    es.addEventListener("permission_request", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().addPermissionRequest(data as PermissionRequest);
    });

    es.addEventListener("session_error", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      const { subtype, stopReason } = data;
      s.getState().flushStreamingThinking();
      s.getState().flushStreamingText();
      s.getState().setThinking(false);
      s.getState().setStreaming(false);
      s.getState().setStopReason(stopReason ?? null);
      if (this.aborted) {
        s.getState().cancelInflightToolCalls();
        s.getState().addSystemMessage("Interrupted");
        this.aborted = false;
      } else {
        s.getState().addSystemMessage(`Session ended: ${subtype}`);
      }
    });

    es.addEventListener("turn_complete", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().flushStreamingThinking();
      s.getState().flushStreamingText();
      s.getState().setThinking(false);
      s.getState().setStreaming(false);
      s.getState().setStopReason(data.stopReason ?? null);
      s.getState().addCost({
        cost: data.cost ?? 0,
        numTurns: data.numTurns ?? 0,
        stopReason: data.stopReason ?? null,
        usage: data.usage ?? null,
        modelUsage: data.modelUsage ?? null,
      });
      if (this.aborted) {
        s.getState().cancelInflightToolCalls();
        s.getState().addSystemMessage("Interrupted");
        this.aborted = false;
      }
    });

    es.addEventListener("error", () => {
      if (this.aborted) {
        s.getState().flushStreamingThinking();
        s.getState().flushStreamingText();
        s.getState().cancelInflightToolCalls();
        s.getState().setThinking(false);
        s.getState().setStreaming(false);
        s.getState().addSystemMessage("Interrupted");
        this.aborted = false;
        es.close();
      } else if (es.readyState === EventSource.CLOSED) {
        s.getState().flushStreamingThinking();
        s.getState().flushStreamingText();
        s.getState().setThinking(false);
        s.getState().setStreaming(false);
      }
    });

    es.addEventListener("checkpoint", (e) => {
      const data = this.parseEvent(e);
      if (!data) return;
      s.getState().addCheckpoint(data.userMessageUuid);
    });

    if (this.onCustomEvent) {
      const handler = this.onCustomEvent;
      es.addEventListener("custom", (e) => {
        const data = this.parseEvent(e);
        if (!data) return;
        handler(data as CustomEvent);
      });
    }
  }

  async sendMessage(text: string): Promise<void> {
    const sid = this.sessionId;
    if (!sid) return;
    this.store.getState().addUserMessage(text);
    this.store.getState().setStreaming(true);
    this.store.getState().setThinking(true);
    try {
      await this.fetchOk(
        `${this.endpoint}/sessions/${sid}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
        "Send message",
      );
    } catch (err) {
      this.store.getState().setStreaming(false);
      this.store.getState().setThinking(false);
      this.surfaceError("send message", err);
    }
  }

  async stopSession(): Promise<void> {
    const sid = this.sessionId;
    if (!sid) return;
    this.aborted = true;
    this.store.getState().setThinking(false);
    this.store.getState().setStreaming(false);
    try {
      await this.fetchOk(
        `${this.endpoint}/sessions/${sid}/abort`,
        { method: "POST" },
        "Stop session",
      );
    } catch (err) {
      this.surfaceError("stop session", err);
    }
  }

  async respondToPermission(response: PermissionResponse): Promise<void> {
    const sid = this.sessionId;
    if (!sid) return;
    this.store.getState().removePermissionRequest(response.requestId);
    try {
      await this.fetchOk(
        `${this.endpoint}/sessions/${sid}/permissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        },
        "Permission response",
      );
    } catch (err) {
      this.surfaceError("send permission response", err);
    }
  }

  async resumeSession(options?: ResumeOptions): Promise<void> {
    const targetSdkSessionId = options?.sdkSessionId ?? this.store.getState().sdkSessionId;
    if (!targetSdkSessionId) return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    let replayedEvents: SSEEvent[] = [];
    try {
      const eventsRes = await fetch(`${this.endpoint}/sessions/replay/${targetSdkSessionId}`);
      if (eventsRes.ok) {
        replayedEvents = await eventsRes.json();
      }
    } catch (err) {
      console.warn("[neeter] replay failed:", err);
    }

    try {
      const data = await this.fetchJson(
        `${this.endpoint}/sessions/resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sdkSessionId: targetSdkSessionId,
            forkSession: options?.fork,
            resumeSessionAt: options?.resumeSessionAt,
          }),
        },
        "Resume session",
      );
      this.store.getState().reset();
      if (replayedEvents.length > 0) {
        replayEvents(this.store, replayedEvents, {
          stopAtCheckpoint: options?.resumeSessionAt,
        });
      }
      this.store.getState().setSessionId(data.sessionId);
    } catch (err) {
      this.surfaceError("resume session", err);
      throw err;
    }
  }

  async rewindSession(checkpointId: string, options?: RewindOptions): Promise<RewindFilesResult> {
    const sid = this.sessionId;
    if (!sid) return { canRewind: false, error: "No active session" };
    try {
      return await this.fetchJson(
        `${this.endpoint}/sessions/${sid}/rewind`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessageId: checkpointId, dryRun: options?.dryRun }),
        },
        "Rewind",
      );
    } catch (err) {
      return { canRewind: false, error: this.formatError(err) };
    }
  }

  async newSession(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      const data = await this.fetchJson(
        `${this.endpoint}/sessions`,
        { method: "POST" },
        "New session",
      );
      this.store.getState().reset();
      this.store.getState().setSessionId(data.sessionId);
    } catch (err) {
      this.surfaceError("create session", err);
      throw err;
    }
  }

  async refreshHistory(): Promise<SessionHistoryEntry[]> {
    try {
      const res = await fetch(`${this.endpoint}/sessions/history`);
      if (res.ok) {
        this._sessionHistory = await res.json();
        this.onHistoryChange?.(this._sessionHistory);
      }
    } catch (err) {
      console.warn("[neeter] history refresh failed:", err);
    }
    return this._sessionHistory;
  }

  closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Cancel any pending init, close the EventSource, and release resources.
   */
  destroy(): void {
    this.initCancelled = true;
    this.closeEventSource();
  }
}
