import { AgentClient, type ChatStore } from "@neeter/core";
import type { PermissionResponse, RewindFilesResult, SessionHistoryEntry } from "@neeter/types";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface UseAgentConfig {
  endpoint?: string;
  resumeSessionId?: string;
  onCustomEvent?: (event: import("@neeter/types").CustomEvent) => void;
}

export interface UseAgentReturn {
  sessionId: string | null;
  sdkSessionId: string | null;
  sessionHistory: SessionHistoryEntry[];
  sendMessage: (text: string) => Promise<void>;
  stopSession: () => Promise<void>;
  respondToPermission: (response: PermissionResponse) => Promise<void>;
  resumeSession: (options?: {
    fork?: boolean;
    sdkSessionId?: string;
    resumeSessionAt?: string;
  }) => Promise<void>;
  rewindSession: (
    checkpointId: string,
    options?: { dryRun?: boolean },
  ) => Promise<RewindFilesResult>;
  newSession: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

/**
 * Low-level hook that manages the AgentClient lifecycle and feeds SSE events
 * into the Zustand store. Most apps should use `AgentProvider` instead —
 * this hook is for custom provider implementations.
 */
export function useAgent(store: ChatStore, config?: UseAgentConfig): UseAgentReturn {
  const endpoint = config?.endpoint ?? "/api";
  const resumeSessionId = config?.resumeSessionId;
  const onCustomEvent = config?.onCustomEvent;

  const clientRef = useRef<AgentClient | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);

  const sessionId = useSyncExternalStore(store.subscribe, () => store.getState().sessionId);
  const sdkSessionId = useSyncExternalStore(store.subscribe, () => store.getState().sdkSessionId);

  // Effect 1: Create client, connect session, destroy on cleanup
  // onCustomEvent is NOT a dep — changing it shouldn't create a new session
  useEffect(() => {
    const client = new AgentClient(store, { endpoint });
    client.onHistoryChange = setSessionHistory;
    clientRef.current = client;

    client.connect(resumeSessionId).catch(() => {
      // Error already surfaced via store.addSystemMessage in AgentClient.connect
    });

    return () => {
      client.destroy();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [endpoint, resumeSessionId, store]);

  // Effect 2: Attach EventSource with explicit cleanup (Strict Mode safe)
  // endpoint and store are intentional deps — matches the original hook behavior
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-attach ES when endpoint/store change
  useEffect(() => {
    if (!sessionId) return;
    const client = clientRef.current;
    if (!client) return;

    client.onCustomEvent = onCustomEvent;
    client.attachEventSource();

    return () => {
      client.closeEventSource();
    };
  }, [sessionId, endpoint, store, onCustomEvent]);

  const sendMessage = useCallback(async (text: string) => {
    await clientRef.current?.sendMessage(text);
  }, []);

  const stopSession = useCallback(async () => {
    await clientRef.current?.stopSession();
  }, []);

  const respondToPermission = useCallback(async (response: PermissionResponse) => {
    await clientRef.current?.respondToPermission(response);
  }, []);

  const resumeSession = useCallback(
    async (options?: { fork?: boolean; sdkSessionId?: string; resumeSessionAt?: string }) => {
      await clientRef.current?.resumeSession(options);
    },
    [],
  );

  const refreshHistory = useCallback(async () => {
    await clientRef.current?.refreshHistory();
  }, []);

  const rewindSession = useCallback(
    async (checkpointId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult> => {
      const client = clientRef.current;
      if (!client) return { canRewind: false, error: "No active session" };
      return client.rewindSession(checkpointId, options);
    },
    [],
  );

  const newSession = useCallback(async () => {
    await clientRef.current?.newSession();
  }, []);

  return {
    sessionId,
    sdkSessionId,
    sessionHistory,
    sendMessage,
    stopSession,
    respondToPermission,
    resumeSession,
    rewindSession,
    newSession,
    refreshHistory,
  };
}
