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
   * Creates or resumes a session, then opens an EventSource for live events.
   * Call once after construction. For subsequent sessions use `newSession()`
   * or `resumeSession()`.
   */
  async connect(resumeSessionId?: string): Promise<void> {
    this.initCancelled = false;
    const target = resumeSessionId;
    let res: Response;

    if (target) {
      try {
        const eventsRes = await fetch(`${this.endpoint}/sessions/replay/${target}`);
        if (eventsRes.ok && !this.initCancelled) {
          const events: SSEEvent[] = await eventsRes.json();
          replayEvents(this.store, events);
        }
      } catch {
        /* replay is best-effort */
      }
      res = await fetch(`${this.endpoint}/sessions/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdkSessionId: target }),
      });
    } else {
      res = await fetch(`${this.endpoint}/sessions`, { method: "POST" });
    }

    const data = await res.json();
    if (!this.initCancelled) {
      this.store.getState().setSessionId(data.sessionId);
    }
  }

  /**
   * Attaches an EventSource to the current sessionId and wires up all SSE
   * event handlers. Called automatically when sessionId changes — only call
   * directly if you need to re-attach after a manual close.
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
      const { sdkSessionId: id, mcpServers, fileCheckpointing } = JSON.parse(e.data);
      s.getState().setSdkSessionId(id);
      if (mcpServers) s.getState().setMcpServers(mcpServers);
      if (fileCheckpointing) s.getState().setFileCheckpointing(true);
    });

    es.addEventListener("message_start", () => {
      s.getState().setThinking(true);
    });

    es.addEventListener("thinking_delta", (e) => {
      const { text } = JSON.parse(e.data);
      s.getState().appendStreamingThinking(text);
    });

    es.addEventListener("text_delta", (e) => {
      s.getState().setThinking(false);
      s.getState().flushStreamingThinking();
      const { text } = JSON.parse(e.data);
      s.getState().appendStreamingText(text);
    });

    es.addEventListener("tool_start", (e) => {
      s.getState().setThinking(false);
      s.getState().flushStreamingThinking();
      s.getState().flushStreamingText();
      const { id, name } = JSON.parse(e.data);
      s.getState().startToolCall(id, name);
    });

    es.addEventListener("tool_input_delta", (e) => {
      const { id, partialJson } = JSON.parse(e.data);
      s.getState().appendToolInput(id, partialJson);
    });

    es.addEventListener("tool_call", (e) => {
      s.getState().flushStreamingText();
      const { id, name, input } = JSON.parse(e.data);
      s.getState().finalizeToolCall(id, name, input);
    });

    es.addEventListener("tool_result", (e) => {
      const { toolUseId, result, isError } = JSON.parse(e.data);
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
      const request = JSON.parse(e.data) as PermissionRequest;
      s.getState().addPermissionRequest(request);
    });

    es.addEventListener("session_error", (e) => {
      const { subtype, stopReason } = JSON.parse(e.data);
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
      const data = JSON.parse(e.data);
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
      const { userMessageUuid } = JSON.parse(e.data);
      s.getState().addCheckpoint(userMessageUuid);
    });

    if (this.onCustomEvent) {
      const handler = this.onCustomEvent;
      es.addEventListener("custom", (e) => {
        handler(JSON.parse(e.data) as CustomEvent);
      });
    }
  }

  async sendMessage(text: string): Promise<void> {
    const sid = this.sessionId;
    if (!sid) return;
    this.store.getState().addUserMessage(text);
    this.store.getState().setStreaming(true);
    this.store.getState().setThinking(true);
    await fetch(`${this.endpoint}/sessions/${sid}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  async stopSession(): Promise<void> {
    const sid = this.sessionId;
    if (!sid) return;
    this.aborted = true;
    this.store.getState().setThinking(false);
    this.store.getState().setStreaming(false);
    await fetch(`${this.endpoint}/sessions/${sid}/abort`, { method: "POST" });
  }

  async respondToPermission(response: PermissionResponse): Promise<void> {
    const sid = this.sessionId;
    if (!sid) return;
    this.store.getState().removePermissionRequest(response.requestId);
    await fetch(`${this.endpoint}/sessions/${sid}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });
  }

  async resumeSession(options?: ResumeOptions): Promise<void> {
    const targetSdkSessionId = options?.sdkSessionId ?? this.store.getState().sdkSessionId;
    if (!targetSdkSessionId) return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.store.getState().reset();

    try {
      const eventsRes = await fetch(`${this.endpoint}/sessions/replay/${targetSdkSessionId}`);
      if (eventsRes.ok) {
        const events: SSEEvent[] = await eventsRes.json();
        replayEvents(this.store, events, {
          stopAtCheckpoint: options?.resumeSessionAt,
        });
      }
    } catch {
      /* replay is best-effort */
    }

    const res = await fetch(`${this.endpoint}/sessions/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sdkSessionId: targetSdkSessionId,
        forkSession: options?.fork,
        resumeSessionAt: options?.resumeSessionAt,
      }),
    });
    const data = await res.json();
    this.store.getState().setSessionId(data.sessionId);
  }

  async rewindSession(checkpointId: string, options?: RewindOptions): Promise<RewindFilesResult> {
    const sid = this.sessionId;
    if (!sid) return { canRewind: false, error: "No active session" };
    const res = await fetch(`${this.endpoint}/sessions/${sid}/rewind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessageId: checkpointId, dryRun: options?.dryRun }),
    });
    return res.json();
  }

  async newSession(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.store.getState().reset();

    const res = await fetch(`${this.endpoint}/sessions`, { method: "POST" });
    const data = await res.json();
    this.store.getState().setSessionId(data.sessionId);
  }

  async refreshHistory(): Promise<SessionHistoryEntry[]> {
    try {
      const res = await fetch(`${this.endpoint}/sessions/history`);
      if (res.ok) {
        this._sessionHistory = await res.json();
        this.onHistoryChange?.(this._sessionHistory);
      }
    } catch {
      /* ignore */
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
