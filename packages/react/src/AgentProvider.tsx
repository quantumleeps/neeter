import type { CustomEvent } from "@neeter/types";
import { createContext, type ReactNode, useContext, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { type ChatStore, type ChatStoreShape, createChatStore } from "./store.js";
import { type UseAgentConfig, type UseAgentReturn, useAgent } from "./use-agent.js";

interface AgentContextValue extends UseAgentReturn {
  store: ChatStore;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider(props: {
  endpoint?: string;
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
      onCustomEvent: props.onCustomEvent,
    }),
    [props.endpoint, props.onCustomEvent],
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
