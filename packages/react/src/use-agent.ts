import type {
  CustomEvent,
  PermissionRequest,
  PermissionResponse,
  SessionHistoryEntry,
  SSEEvent,
} from "@neeter/types";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ChatStore, replayEvents } from "./store.js";

export interface UseAgentConfig {
  endpoint?: string;
  resumeSessionId?: string;
  onCustomEvent?: (event: CustomEvent) => void;
}

export interface UseAgentReturn {
  sessionId: string | null;
  sdkSessionId: string | null;
  sessionHistory: SessionHistoryEntry[];
  sendMessage: (text: string) => Promise<void>;
  stopSession: () => Promise<void>;
  respondToPermission: (response: PermissionResponse) => Promise<void>;
  resumeSession: (options?: { fork?: boolean; sdkSessionId?: string }) => Promise<void>;
  newSession: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

/**
 * Low-level hook that manages the EventSource lifecycle and feeds SSE events
 * into the Zustand store. Most apps should use `AgentProvider` instead —
 * this hook is for custom provider implementations.
 */
export function useAgent(store: ChatStore, config?: UseAgentConfig): UseAgentReturn {
  const endpoint = config?.endpoint ?? "/api";
  const resumeSessionId = config?.resumeSessionId;
  const onCustomEvent = config?.onCustomEvent;
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortedRef = useRef(false);

  const sessionId = useSyncExternalStore(store.subscribe, () => store.getState().sessionId);
  const sdkSessionId = useSyncExternalStore(store.subscribe, () => store.getState().sdkSessionId);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      let res: Response;
      if (resumeSessionId) {
        try {
          const eventsRes = await fetch(`${endpoint}/sessions/replay/${resumeSessionId}`);
          if (eventsRes.ok && !cancelled) {
            const events: SSEEvent[] = await eventsRes.json();
            replayEvents(store, events);
          }
        } catch {
          /* replay is best-effort */
        }
        res = await fetch(`${endpoint}/sessions/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdkSessionId: resumeSessionId }),
        });
      } else {
        res = await fetch(`${endpoint}/sessions`, { method: "POST" });
      }
      const data = await res.json();
      if (!cancelled) store.getState().setSessionId(data.sessionId);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [endpoint, resumeSessionId, store]);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`${endpoint}/sessions/${sessionId}/events`);
    eventSourceRef.current = es;
    abortedRef.current = false;

    es.addEventListener("session_init", (e) => {
      const { sdkSessionId: id } = JSON.parse(e.data);
      store.getState().setSdkSessionId(id);
    });

    es.addEventListener("message_start", () => {
      store.getState().setThinking(true);
    });

    es.addEventListener("thinking_delta", (e) => {
      const { text } = JSON.parse(e.data);
      store.getState().appendStreamingThinking(text);
    });

    es.addEventListener("text_delta", (e) => {
      store.getState().setThinking(false);
      store.getState().flushStreamingThinking();
      const { text } = JSON.parse(e.data);
      store.getState().appendStreamingText(text);
    });

    es.addEventListener("tool_start", (e) => {
      store.getState().setThinking(false);
      store.getState().flushStreamingThinking();
      store.getState().flushStreamingText();
      const { id, name } = JSON.parse(e.data);
      store.getState().startToolCall(id, name);
    });

    es.addEventListener("tool_input_delta", (e) => {
      const { id, partialJson } = JSON.parse(e.data);
      store.getState().appendToolInput(id, partialJson);
    });

    es.addEventListener("tool_call", (e) => {
      store.getState().flushStreamingText();
      const { id, name, input } = JSON.parse(e.data);
      store.getState().finalizeToolCall(id, name, input);
    });

    es.addEventListener("tool_result", (e) => {
      const { toolUseId, result, isError } = JSON.parse(e.data);
      if (isError) {
        store.getState().errorToolCall(toolUseId, result);
      } else {
        store.getState().completeToolCall(toolUseId, result);
      }
      if (store.getState().isStreaming) {
        store.getState().setThinking(true);
      }
    });

    es.addEventListener("permission_request", (e) => {
      const request = JSON.parse(e.data) as PermissionRequest;
      store.getState().addPermissionRequest(request);
    });

    es.addEventListener("session_error", (e) => {
      store.getState().flushStreamingThinking();
      store.getState().flushStreamingText();
      store.getState().setThinking(false);
      store.getState().setStreaming(false);
      if (abortedRef.current) {
        store.getState().cancelInflightToolCalls();
        store.getState().addSystemMessage("Interrupted");
        abortedRef.current = false;
      } else {
        const { subtype } = JSON.parse(e.data);
        store.getState().addSystemMessage(`Session ended: ${subtype}`);
      }
    });

    es.addEventListener("turn_complete", (e) => {
      const { cost, numTurns } = JSON.parse(e.data);
      store.getState().flushStreamingThinking();
      store.getState().flushStreamingText();
      store.getState().setThinking(false);
      store.getState().setStreaming(false);
      store.getState().addCost(cost ?? 0, numTurns ?? 0);
      if (abortedRef.current) {
        store.getState().cancelInflightToolCalls();
        store.getState().addSystemMessage("Interrupted");
        abortedRef.current = false;
      }
    });

    es.addEventListener("error", () => {
      if (abortedRef.current) {
        store.getState().flushStreamingThinking();
        store.getState().flushStreamingText();
        store.getState().cancelInflightToolCalls();
        store.getState().setThinking(false);
        store.getState().setStreaming(false);
        store.getState().addSystemMessage("Interrupted");
        abortedRef.current = false;
        es.close();
      } else if (es.readyState === EventSource.CLOSED) {
        store.getState().flushStreamingThinking();
        store.getState().flushStreamingText();
        store.getState().setThinking(false);
        store.getState().setStreaming(false);
      }
    });

    if (onCustomEvent) {
      es.addEventListener("custom", (e) => {
        onCustomEvent(JSON.parse(e.data) as CustomEvent);
      });
    }

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, endpoint, store, onCustomEvent]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId) return;
      store.getState().addUserMessage(text);
      store.getState().setStreaming(true);
      store.getState().setThinking(true);
      await fetch(`${endpoint}/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    },
    [sessionId, endpoint, store],
  );

  const stopSession = useCallback(async () => {
    if (!sessionId) return;
    abortedRef.current = true;
    store.getState().setThinking(false);
    store.getState().setStreaming(false);
    await fetch(`${endpoint}/sessions/${sessionId}/abort`, { method: "POST" });
  }, [sessionId, endpoint, store]);

  const respondToPermission = useCallback(
    async (response: PermissionResponse) => {
      if (!sessionId) return;
      store.getState().removePermissionRequest(response.requestId);
      await fetch(`${endpoint}/sessions/${sessionId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
    },
    [sessionId, endpoint, store],
  );

  const resumeSession = useCallback(
    async (options?: { fork?: boolean; sdkSessionId?: string }) => {
      const targetSdkSessionId = options?.sdkSessionId ?? store.getState().sdkSessionId;
      if (!targetSdkSessionId) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      store.getState().reset();

      try {
        const eventsRes = await fetch(`${endpoint}/sessions/replay/${targetSdkSessionId}`);
        if (eventsRes.ok) {
          const events: SSEEvent[] = await eventsRes.json();
          replayEvents(store, events);
        }
      } catch {
        /* replay is best-effort */
      }

      const res = await fetch(`${endpoint}/sessions/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdkSessionId: targetSdkSessionId,
          forkSession: options?.fork,
        }),
      });
      const data = await res.json();
      store.getState().setSessionId(data.sessionId);
    },
    [endpoint, store],
  );

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch(`${endpoint}/sessions/history`);
      if (res.ok) setSessionHistory(await res.json());
    } catch {
      /* ignore */
    }
  }, [endpoint]);

  const newSession = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    store.getState().reset();

    const res = await fetch(`${endpoint}/sessions`, { method: "POST" });
    const data = await res.json();
    store.getState().setSessionId(data.sessionId);
  }, [endpoint, store]);

  return {
    sessionId,
    sdkSessionId,
    sessionHistory,
    sendMessage,
    stopSession,
    respondToPermission,
    resumeSession,
    newSession,
    refreshHistory,
  };
}
