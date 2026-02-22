import { describe, expect, it } from "vitest";
import { createChatStore } from "./store.js";

function firstToolCall(store: ReturnType<typeof createChatStore>) {
  const tc = store.getState().messages[0].toolCalls?.[0];
  expect(tc).toBeDefined();
  return tc as NonNullable<typeof tc>;
}

describe("ChatStore", () => {
  it("addUserMessage appends a user message", () => {
    const store = createChatStore();
    store.getState().addUserMessage("hello");
    const { messages } = store.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("hello");
    expect(messages[0].id).toMatch(/^msg-/);
  });

  it("appendStreamingText + flushStreamingText creates assistant message", () => {
    const store = createChatStore();
    store.getState().appendStreamingText("hel");
    store.getState().appendStreamingText("lo");
    expect(store.getState().streamingText).toBe("hello");

    store.getState().flushStreamingText();
    const { messages, streamingText } = store.getState();
    expect(streamingText).toBe("");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toBe("hello");
  });

  it("flushStreamingText appends to existing assistant message without tool calls", () => {
    const store = createChatStore();
    store.getState().appendStreamingText("first ");
    store.getState().flushStreamingText();
    store.getState().appendStreamingText("second");
    store.getState().flushStreamingText();

    const { messages } = store.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("first second");
  });

  it("flushStreamingText is a no-op when streamingText is empty", () => {
    const store = createChatStore();
    store.getState().flushStreamingText();
    expect(store.getState().messages).toHaveLength(0);
  });

  it("startToolCall creates assistant message with pending tool call", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "search");
    const { messages } = store.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].toolCalls).toHaveLength(1);
    expect(messages[0].toolCalls?.[0]).toMatchObject({
      id: "tc-1",
      name: "search",
      status: "pending",
    });
  });

  it("appendToolInput accumulates partialInput and sets streaming_input status", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "search");
    store.getState().appendToolInput("tc-1", '{"q":');
    store.getState().appendToolInput("tc-1", '"test"}');

    const tc = firstToolCall(store);
    expect(tc.partialInput).toBe('{"q":"test"}');
    expect(tc.status).toBe("streaming_input");
  });

  it("finalizeToolCall sets input and running status", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "search");
    store.getState().finalizeToolCall("tc-1", "search", { q: "test" });

    const tc = firstToolCall(store);
    expect(tc.input).toEqual({ q: "test" });
    expect(tc.status).toBe("running");
  });

  it("completeToolCall sets result and complete status", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "search");
    store.getState().completeToolCall("tc-1", '{"results":[]}');

    const tc = firstToolCall(store);
    expect(tc.result).toBe('{"results":[]}');
    expect(tc.status).toBe("complete");
  });

  it("errorToolCall sets error and error status", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "search");
    store.getState().errorToolCall("tc-1", "timeout");

    const tc = firstToolCall(store);
    expect(tc.error).toBe("timeout");
    expect(tc.status).toBe("error");
  });

  it("reset clears all state", () => {
    const store = createChatStore();
    store.getState().setSessionId("sess-1");
    store.getState().addUserMessage("hi");
    store.getState().setStreaming(true);
    store.getState().setThinking(true);

    store.getState().reset();
    const s = store.getState();
    expect(s.sessionId).toBeNull();
    expect(s.messages).toHaveLength(0);
    expect(s.isStreaming).toBe(false);
    expect(s.isThinking).toBe(false);
    expect(s.streamingText).toBe("");
  });

  it("appendStreamingThinking + flushStreamingThinking stores thinking on assistant message", () => {
    const store = createChatStore();
    store.getState().appendStreamingText("response");
    store.getState().flushStreamingText();

    store.getState().appendStreamingThinking("Let me ");
    store.getState().appendStreamingThinking("think...");
    expect(store.getState().streamingThinking).toBe("Let me think...");

    store.getState().flushStreamingThinking();
    const { messages, streamingThinking } = store.getState();
    expect(streamingThinking).toBe("");
    expect(messages[0].thinking).toBe("Let me think...");
  });

  it("flushStreamingThinking creates assistant message if none exists", () => {
    const store = createChatStore();
    store.getState().appendStreamingThinking("thinking first");
    store.getState().flushStreamingThinking();

    const { messages } = store.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].thinking).toBe("thinking first");
    expect(messages[0].content).toBe("");
  });

  it("flushStreamingThinking creates new message instead of appending to tool call message", () => {
    const store = createChatStore();
    // Turn 1: thinking → text → tool
    store.getState().appendStreamingThinking("Turn 1 thinking");
    store.getState().flushStreamingThinking();
    store.getState().appendStreamingText("I'll use a tool.");
    store.getState().flushStreamingText();
    store.getState().startToolCall("tool-1", "search");
    store.getState().completeToolCall("tool-1", "result");

    // Turn 2: thinking arrives after tool call message
    store.getState().appendStreamingThinking("Turn 2 thinking");
    store.getState().flushStreamingThinking();

    const { messages } = store.getState();
    expect(messages).toHaveLength(3);
    // Turn 1 text+thinking message
    expect(messages[0].thinking).toBe("Turn 1 thinking");
    expect(messages[0].content).toBe("I'll use a tool.");
    expect(messages[0].toolCalls).toBeUndefined();
    // Tool call message — no thinking attached
    expect(messages[1].toolCalls).toHaveLength(1);
    expect(messages[1].thinking).toBeUndefined();
    // Turn 2 thinking in its own renderable message
    expect(messages[2].thinking).toBe("Turn 2 thinking");
    expect(messages[2].toolCalls).toBeUndefined();
  });

  it("flushStreamingThinking is a no-op when streamingThinking is empty", () => {
    const store = createChatStore();
    store.getState().flushStreamingThinking();
    expect(store.getState().messages).toHaveLength(0);
  });

  it("reset clears streamingThinking", () => {
    const store = createChatStore();
    store.getState().appendStreamingThinking("thinking");
    store.getState().reset();
    expect(store.getState().streamingThinking).toBe("");
  });

  it("addSystemMessage appends a system message", () => {
    const store = createChatStore();
    store.getState().addSystemMessage("Session ended");
    const { messages } = store.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toBe("Session ended");
  });

  it("addPermissionRequest adds and deduplicates by requestId", () => {
    const store = createChatStore();
    const req = { kind: "tool_approval" as const, requestId: "r1", toolName: "t", input: {} };
    store.getState().addPermissionRequest(req);
    store.getState().addPermissionRequest(req);

    expect(store.getState().pendingPermissions).toHaveLength(1);
  });

  it("removePermissionRequest removes by requestId", () => {
    const store = createChatStore();
    const req = { kind: "tool_approval" as const, requestId: "r1", toolName: "t", input: {} };
    store.getState().addPermissionRequest(req);
    store.getState().removePermissionRequest("r1");

    expect(store.getState().pendingPermissions).toHaveLength(0);
  });

  it("completeToolCall does not overwrite error status", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "search");
    store.getState().errorToolCall("tc-1", "denied");
    store.getState().completeToolCall("tc-1", "late result");

    const tc = firstToolCall(store);
    expect(tc.status).toBe("error");
    expect(tc.result).toBeUndefined();
  });

  it("finalizeToolCall is a no-op for unknown toolUseId", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "search");
    store.getState().finalizeToolCall("unknown", "search", { q: "test" });

    const tc = firstToolCall(store);
    expect(tc.status).toBe("pending");
  });

  it("addCost accumulates cost and turns", () => {
    const store = createChatStore();
    store.getState().addCost(0.005, 1);
    store.getState().addCost(0.012, 2);

    const s = store.getState();
    expect(s.totalCost).toBeCloseTo(0.017);
    expect(s.totalTurns).toBe(3);
  });

  it("reset clears cost and turns", () => {
    const store = createChatStore();
    store.getState().addCost(0.01, 1);
    store.getState().reset();

    const s = store.getState();
    expect(s.totalCost).toBe(0);
    expect(s.totalTurns).toBe(0);
  });

  it("cancelInflightToolCalls marks pending/streaming/running as error", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "Read");
    store.getState().startToolCall("tc-2", "Edit");
    store.getState().appendToolInput("tc-2", '{"file":');
    store.getState().startToolCall("tc-3", "Write");
    store.getState().finalizeToolCall("tc-3", "Write", { file: "a.txt" });
    store.getState().startToolCall("tc-4", "Glob");
    store.getState().completeToolCall("tc-4", "done");

    // tc-1: pending, tc-2: streaming_input, tc-3: running, tc-4: complete
    store.getState().cancelInflightToolCalls();

    const tcs = store.getState().messages.flatMap((m) => m.toolCalls ?? []);
    expect(tcs.find((t) => t.id === "tc-1")?.status).toBe("error");
    expect(tcs.find((t) => t.id === "tc-1")?.error).toBe("Interrupted");
    expect(tcs.find((t) => t.id === "tc-2")?.status).toBe("error");
    expect(tcs.find((t) => t.id === "tc-3")?.status).toBe("error");
    // already-complete tool call is untouched
    expect(tcs.find((t) => t.id === "tc-4")?.status).toBe("complete");
  });

  it("cancelInflightToolCalls is a no-op when no inflight calls exist", () => {
    const store = createChatStore();
    store.getState().startToolCall("tc-1", "Read");
    store.getState().completeToolCall("tc-1", "ok");

    store.getState().cancelInflightToolCalls();

    const tc = firstToolCall(store);
    expect(tc.status).toBe("complete");
    expect(tc.error).toBeUndefined();
  });
});
