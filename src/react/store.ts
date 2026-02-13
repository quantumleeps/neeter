import { immer } from "zustand/middleware/immer";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { ChatMessage, PermissionRequest, ToolCallInfo } from "../types.js";

interface ChatStoreState {
  sessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  isThinking: boolean;
  streamingText: string;
  streamingThinking: string;
  pendingPermissions: PermissionRequest[];
}

interface ChatStoreActions {
  setSessionId: (id: string) => void;
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

export function createChatStore(): ChatStore {
  return createStore<ChatStoreShape>()(
    immer((set) => ({
      sessionId: null,
      messages: [],
      isStreaming: false,
      isThinking: false,
      streamingText: "",
      streamingThinking: "",
      pendingPermissions: [],

      setSessionId: (id) =>
        set((s) => {
          s.sessionId = id;
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

      reset: () =>
        set((s) => {
          s.sessionId = null;
          s.messages = [];
          s.isStreaming = false;
          s.isThinking = false;
          s.streamingText = "";
          s.streamingThinking = "";
          s.pendingPermissions = [];
        }),
    })),
  );
}
