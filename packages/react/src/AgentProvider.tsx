import { type ChatStore, type ChatStoreShape, createChatStore } from "@neeter/core";
import type { CustomEvent } from "@neeter/types";
import { createContext, type ReactNode, useContext, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { type UseAgentConfig, type UseAgentReturn, useAgent } from "./use-agent.js";

interface AgentContextValue extends UseAgentReturn {
  store: ChatStore;
}

const AgentContext = createContext<AgentContextValue | null>(null);

/**
 * Context provider that creates a Zustand store and wires up the SSE connection.
 * Wrap your chat UI with this — children access the store via `useAgentContext()`.
 */
export function AgentProvider(props: {
  /** Base URL for the neeter server routes. Defaults to `"/api"`. */
  endpoint?: string;
  /** SDK session ID to resume on mount. Replays persisted events then reconnects. */
  resumeSessionId?: string;
  /** Handler for custom events emitted by `onToolResult` on the server. */
  onCustomEvent?: (event: CustomEvent) => void;
  children: ReactNode;
}) {
  const storeRef = useRef<ChatStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createChatStore();
  }
  const store = storeRef.current;

  const agentConfig = useMemo<UseAgentConfig>(
    () => ({
      endpoint: props.endpoint,
      resumeSessionId: props.resumeSessionId,
      onCustomEvent: props.onCustomEvent,
    }),
    [props.endpoint, props.resumeSessionId, props.onCustomEvent],
  );

  const agent = useAgent(store, agentConfig);

  const value = useMemo<AgentContextValue>(() => ({ ...agent, store }), [agent, store]);

  return <AgentContext value={value}>{props.children}</AgentContext>;
}

export function useAgentContext(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgentContext must be used within <AgentProvider>");
  return ctx;
}

export function useChatStore<T>(selector: (state: ChatStoreShape) => T): T {
  const { store } = useAgentContext();
  return useStore(store, selector);
}
