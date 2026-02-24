import type {
  ChatMessage,
  McpServerStatus,
  PermissionRequest,
  SSEEvent,
  ToolCallInfo,
} from "@neeter/types";
import { immer } from "zustand/middleware/immer";
import { createStore, type StoreApi } from "zustand/vanilla";

interface ChatStoreState {
  sessionId: string | null;
  sdkSessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  isThinking: boolean;
  streamingText: string;
  streamingThinking: string;
  pendingPermissions: PermissionRequest[];
  mcpServers: McpServerStatus[];
  checkpoints: string[];
  totalCost: number;
  totalTurns: number;
}

interface ChatStoreActions {
  setSessionId: (id: string) => void;
  setSdkSessionId: (id: string) => void;
  addUserMessage: (text: string) => void;
  appendStreamingText: (text: string) => void;
  appendStreamingThinking: (text: string) => void;
  flushStreamingText: () => void;
  flushStreamingThinking: () => void;
  addSystemMessage: (text: string) => void;
  startToolCall: (toolUseId: string, name: string) => void;
  appendToolInput: (toolUseId: string, partialJson: string) => void;
  finalizeToolCall: (toolUseId: string, name: string, input: Record<string, unknown>) => void;
  completeToolCall: (toolUseId: string, result: string) => void;
  errorToolCall: (toolUseId: string, error: string) => void;
  setStreaming: (v: boolean) => void;
  setThinking: (v: boolean) => void;
  addPermissionRequest: (request: PermissionRequest) => void;
  removePermissionRequest: (requestId: string) => void;
  setMcpServers: (servers: McpServerStatus[]) => void;
  addCheckpoint: (uuid: string) => void;
  addCost: (cost: number, turns: number) => void;
  cancelInflightToolCalls: () => void;
  reset: () => void;
}

export type ChatStoreShape = ChatStoreState & ChatStoreActions;
export type ChatStore = StoreApi<ChatStoreShape>;

let nextId = 0;

function findToolCall(messages: ChatMessage[], toolUseId: string): ToolCallInfo | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const tc = messages[i].toolCalls;
    if (tc?.length) {
      const match = tc.find((t) => t.id === toolUseId);
      if (match) return match;
    }
  }
  return undefined;
}

/**
 * Creates a vanilla Zustand store for chat state. `AgentProvider` creates one
 * internally — use this directly only for custom provider implementations.
 */
export function createChatStore(): ChatStore {
  return createStore<ChatStoreShape>()(
    immer((set) => ({
      sessionId: null,
      sdkSessionId: null,
      messages: [],
      isStreaming: false,
      isThinking: false,
      streamingText: "",
      streamingThinking: "",
      pendingPermissions: [],
      mcpServers: [],
      checkpoints: [],
      totalCost: 0,
      totalTurns: 0,

      setSessionId: (id) =>
        set((s) => {
          s.sessionId = id;
        }),

      setSdkSessionId: (id) =>
        set((s) => {
          s.sdkSessionId = id;
        }),

      addUserMessage: (text) =>
        set((s) => {
          s.messages.push({
            id: `msg-${++nextId}`,
            role: "user",
            content: text,
          });
        }),

      addSystemMessage: (text) =>
        set((s) => {
          s.messages.push({
            id: `msg-${++nextId}`,
            role: "system",
            content: text,
          });
        }),

      appendStreamingText: (text) =>
        set((s) => {
          s.streamingText += text;
        }),

      appendStreamingThinking: (text) =>
        set((s) => {
          s.streamingThinking += text;
        }),

      flushStreamingThinking: () =>
        set((s) => {
          if (s.streamingThinking) {
            const last = s.messages[s.messages.length - 1];
            if (last?.role === "assistant" && !last.toolCalls?.length) {
              last.thinking = (last.thinking ?? "") + s.streamingThinking;
            } else {
              s.messages.push({
                id: `msg-${++nextId}`,
                role: "assistant",
                content: "",
                thinking: s.streamingThinking,
              });
            }
            s.streamingThinking = "";
          }
        }),

      flushStreamingText: () =>
        set((s) => {
          if (s.streamingText) {
            const last = s.messages[s.messages.length - 1];
            if (last?.role === "assistant" && !last.toolCalls?.length) {
              last.content += s.streamingText;
            } else {
              s.messages.push({
                id: `msg-${++nextId}`,
                role: "assistant",
                content: s.streamingText,
              });
            }
            s.streamingText = "";
          }
        }),

      startToolCall: (toolUseId, name) =>
        set((s) => {
          s.messages.push({
            id: `msg-${++nextId}`,
            role: "assistant",
            content: "",
            toolCalls: [{ id: toolUseId, name, input: {}, status: "pending" }],
          });
        }),

      appendToolInput: (toolUseId, partialJson) =>
        set((s) => {
          const tc = findToolCall(s.messages, toolUseId);
          if (tc) {
            tc.partialInput = (tc.partialInput ?? "") + partialJson;
            tc.status = "streaming_input";
          }
        }),

      finalizeToolCall: (toolUseId, name, input) =>
        set((s) => {
          const tc = findToolCall(s.messages, toolUseId);
          if (tc) {
            tc.name = name;
            tc.input = input;
            tc.status = "running";
          }
        }),

      completeToolCall: (toolUseId, result) =>
        set((s) => {
          const tc = findToolCall(s.messages, toolUseId);
          if (tc && tc.status !== "error") {
            tc.result = result;
            tc.status = "complete";
          }
        }),

      errorToolCall: (toolUseId, error) =>
        set((s) => {
          const tc = findToolCall(s.messages, toolUseId);
          if (tc) {
            tc.error = error;
            tc.status = "error";
          }
        }),

      setStreaming: (v) =>
        set((s) => {
          s.isStreaming = v;
        }),

      setThinking: (v) =>
        set((s) => {
          s.isThinking = v;
        }),

      addPermissionRequest: (request) =>
        set((s) => {
          if (!s.pendingPermissions.some((p) => p.requestId === request.requestId)) {
            s.pendingPermissions.push(request);
          }
        }),

      removePermissionRequest: (requestId) =>
        set((s) => {
          s.pendingPermissions = s.pendingPermissions.filter((p) => p.requestId !== requestId);
        }),

      setMcpServers: (servers) =>
        set((s) => {
          s.mcpServers = servers;
        }),

      addCheckpoint: (uuid) =>
        set((s) => {
          s.checkpoints.push(uuid);
        }),

      addCost: (cost, turns) =>
        set((s) => {
          s.totalCost += cost;
          s.totalTurns += turns;
        }),

      cancelInflightToolCalls: () =>
        set((s) => {
          for (const msg of s.messages) {
            if (msg.toolCalls) {
              for (const tc of msg.toolCalls) {
                if (
                  tc.status === "pending" ||
                  tc.status === "streaming_input" ||
                  tc.status === "running"
                ) {
                  tc.status = "error";
                  tc.error = "Interrupted";
                }
              }
            }
          }
        }),

      reset: () =>
        set((s) => {
          s.sessionId = null;
          s.sdkSessionId = null;
          s.messages = [];
          s.isStreaming = false;
          s.isThinking = false;
          s.streamingText = "";
          s.streamingThinking = "";
          s.pendingPermissions = [];
          s.mcpServers = [];
          s.checkpoints = [];
          s.totalCost = 0;
          s.totalTurns = 0;
        }),
    })),
  );
}

/**
 * Reconstructs chat store state from persisted SSE events. Uses the same
 * store actions as the live SSE stream, so rendering is identical.
 * Call before connecting the EventSource (e.g. during session resume).
 */
export function replayEvents(
  store: ChatStore,
  events: SSEEvent[],
  options?: { stopAtCheckpoint?: string },
): void {
  const s = store.getState();
  const stopAt = options?.stopAtCheckpoint;
  let foundTarget = false;

  for (const evt of events) {
    const data = JSON.parse(evt.data);
    switch (evt.event) {
      case "user_message":
        s.addUserMessage(data.text);
        break;
      case "session_init":
        s.setSdkSessionId(data.sdkSessionId);
        if (data.mcpServers) s.setMcpServers(data.mcpServers);
        break;
      case "thinking_delta":
        s.appendStreamingThinking(data.text);
        break;
      case "text_delta":
        s.flushStreamingThinking();
        s.appendStreamingText(data.text);
        break;
      case "tool_start":
        s.flushStreamingThinking();
        s.flushStreamingText();
        s.startToolCall(data.id, data.name);
        break;
      case "tool_call":
        s.flushStreamingText();
        s.finalizeToolCall(data.id, data.name, data.input);
        break;
      case "tool_result":
        if (data.isError) {
          s.errorToolCall(data.toolUseId, data.result);
        } else {
          s.completeToolCall(data.toolUseId, data.result);
        }
        break;
      case "checkpoint":
        s.addCheckpoint(data.userMessageUuid);
        if (stopAt && data.userMessageUuid === stopAt) foundTarget = true;
        break;
      case "turn_complete":
        s.flushStreamingThinking();
        s.flushStreamingText();
        s.addCost(data.cost ?? 0, data.numTurns ?? 0);
        if (foundTarget) return;
        break;
      case "session_error":
        s.flushStreamingThinking();
        s.flushStreamingText();
        s.addSystemMessage(`Session ended: ${data.subtype}`);
        if (foundTarget) return;
        break;
    }
  }
}
