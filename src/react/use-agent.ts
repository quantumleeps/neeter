import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { CustomEvent, PermissionRequest, PermissionResponse } from "../types.js";
import type { ChatStore } from "./store.js";

export interface UseAgentConfig {
  endpoint?: string;
  onCustomEvent?: (event: CustomEvent) => void;
}

export interface UseAgentReturn {
  sessionId: string | null;
  sendMessage: (text: string) => Promise<void>;
  respondToPermission: (response: PermissionResponse) => Promise<void>;
}

export function useAgent(store: ChatStore, config?: UseAgentConfig): UseAgentReturn {
  const endpoint = config?.endpoint ?? "/api";
  const onCustomEvent = config?.onCustomEvent;
  const eventSourceRef = useRef<EventSource | null>(null);

  const sessionId = useSyncExternalStore(store.subscribe, () => store.getState().sessionId);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const res = await fetch(`${endpoint}/sessions`, { method: "POST" });
      const data = await res.json();
      if (!cancelled) store.getState().setSessionId(data.sessionId);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [endpoint, store]);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`${endpoint}/sessions/${sessionId}/events`);
    eventSourceRef.current = es;

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
      const { toolUseId, result } = JSON.parse(e.data);
      store.getState().completeToolCall(toolUseId, result);
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
      const { subtype } = JSON.parse(e.data);
      store.getState().addSystemMessage(`Session ended: ${subtype}`);
      store.getState().setStreaming(false);
    });

    es.addEventListener("turn_complete", () => {
      store.getState().flushStreamingThinking();
      store.getState().flushStreamingText();
      store.getState().setThinking(false);
      store.getState().setStreaming(false);
    });

    es.addEventListener("error", () => {
      if (es.readyState === EventSource.CLOSED) {
        store.getState().flushStreamingThinking();
        store.getState().flushStreamingText();
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

  return { sessionId, sendMessage, respondToPermission };
}
