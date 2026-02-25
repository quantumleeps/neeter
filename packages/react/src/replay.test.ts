import { describe, expect, it } from "vitest";
import { createChatStore, replayEvents } from "./store.js";

describe("replayEvents", () => {
  it("replays a text-only turn", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "user_message", data: JSON.stringify({ text: "Hello" }) },
      {
        event: "session_init",
        data: JSON.stringify({
          sdkSessionId: "sdk-1",
          model: "test",
          tools: [],
          mcpServers: [{ name: "github", status: "connected" }],
        }),
      },
      { event: "text_delta", data: JSON.stringify({ text: "Hi " }) },
      { event: "text_delta", data: JSON.stringify({ text: "there!" }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
    ]);

    const { messages, sdkSessionId, mcpServers, totalCost, totalTurns } = store.getState();
    expect(sdkSessionId).toBe("sdk-1");
    expect(mcpServers).toEqual([{ name: "github", status: "connected" }]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "Hello" });
    expect(messages[1]).toMatchObject({ role: "assistant", content: "Hi there!" });
    expect(totalCost).toBe(0.01);
    expect(totalTurns).toBe(1);
  });

  it("replays a tool call turn", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "user_message", data: JSON.stringify({ text: "List files" }) },
      { event: "tool_start", data: JSON.stringify({ id: "tu-1", name: "Bash" }) },
      {
        event: "tool_call",
        data: JSON.stringify({ id: "tu-1", name: "Bash", input: { command: "ls" } }),
      },
      { event: "tool_result", data: JSON.stringify({ toolUseId: "tu-1", result: "file.txt" }) },
      { event: "text_delta", data: JSON.stringify({ text: "Done." }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0.02, numTurns: 1 }) },
    ]);

    const { messages } = store.getState();
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({ role: "user", content: "List files" });
    expect(messages[1].toolCalls?.[0]).toMatchObject({
      id: "tu-1",
      name: "Bash",
      input: { command: "ls" },
      result: "file.txt",
      status: "complete",
    });
    expect(messages[2]).toMatchObject({ role: "assistant", content: "Done." });
  });

  it("replays thinking blocks", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "thinking_delta", data: JSON.stringify({ text: "Let me think..." }) },
      { event: "text_delta", data: JSON.stringify({ text: "Answer." }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0, numTurns: 1 }) },
    ]);

    const { messages } = store.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].thinking).toBe("Let me think...");
    expect(messages[0].content).toBe("Answer.");
  });

  it("replays multi-turn conversation", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "user_message", data: JSON.stringify({ text: "First" }) },
      { event: "text_delta", data: JSON.stringify({ text: "Reply 1" }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      { event: "user_message", data: JSON.stringify({ text: "Second" }) },
      { event: "text_delta", data: JSON.stringify({ text: "Reply 2" }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
    ]);

    const { messages, totalCost, totalTurns } = store.getState();
    expect(messages).toHaveLength(4);
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Reply 1");
    expect(messages[2].content).toBe("Second");
    expect(messages[3].content).toBe("Reply 2");
    expect(totalCost).toBe(0.02);
    expect(totalTurns).toBe(2);
  });

  it("replays stop_reason from turn_complete", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "text_delta", data: JSON.stringify({ text: "Hi" }) },
      {
        event: "turn_complete",
        data: JSON.stringify({ cost: 0.01, numTurns: 1, stopReason: "end_turn" }),
      },
    ]);

    expect(store.getState().lastStopReason).toBe("end_turn");
  });

  it("replays stop_reason from session_error", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "text_delta", data: JSON.stringify({ text: "partial" }) },
      {
        event: "session_error",
        data: JSON.stringify({ subtype: "error_max_turns", stopReason: "end_turn" }),
      },
    ]);

    expect(store.getState().lastStopReason).toBe("end_turn");
  });

  it("replays session_error", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "text_delta", data: JSON.stringify({ text: "partial" }) },
      { event: "session_error", data: JSON.stringify({ subtype: "error" }) },
    ]);

    const { messages } = store.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("partial");
    expect(messages[1]).toMatchObject({ role: "system", content: "Session ended: error" });
  });

  it("replays an errored tool result", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "user_message", data: JSON.stringify({ text: "Write to /etc" }) },
      { event: "tool_start", data: JSON.stringify({ id: "tu-e", name: "Write" }) },
      {
        event: "tool_call",
        data: JSON.stringify({ id: "tu-e", name: "Write", input: { file_path: "/etc/passwd" } }),
      },
      {
        event: "tool_result",
        data: JSON.stringify({
          toolUseId: "tu-e",
          result: "Access outside sandbox directory is not allowed",
          isError: true,
        }),
      },
      { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
    ]);

    const { messages } = store.getState();
    expect(messages[1].toolCalls?.[0]).toMatchObject({
      id: "tu-e",
      name: "Write",
      status: "error",
      error: "Access outside sandbox directory is not allowed",
    });
  });

  it("replays checkpoint events", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "uuid-1" }) },
      { event: "text_delta", data: JSON.stringify({ text: "Hi" }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0, numTurns: 1 }) },
      { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "uuid-2" }) },
    ]);

    const { checkpoints } = store.getState();
    expect(checkpoints).toEqual(["uuid-1", "uuid-2"]);
  });

  it("handles empty events array", () => {
    const store = createChatStore();
    replayEvents(store, []);
    expect(store.getState().messages).toHaveLength(0);
  });

  // stopAtCheckpoint uses "before" semantics: replay everything BEFORE the
  // checkpoint's user message. This matches rewindFiles() which restores files
  // to their state before that message's turn.

  it("stopAtCheckpoint on first message yields empty conversation", () => {
    const store = createChatStore();
    replayEvents(
      store,
      [
        { event: "user_message", data: JSON.stringify({ text: "First" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-1" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 1" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
        { event: "user_message", data: JSON.stringify({ text: "Second" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-2" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 2" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      ],
      { stopAtCheckpoint: "cp-1" },
    );

    const { messages, checkpoints, totalCost } = store.getState();
    expect(messages).toHaveLength(0);
    expect(checkpoints).toEqual([]);
    expect(totalCost).toBe(0);
  });

  it("stopAtCheckpoint on second message keeps first message and reply", () => {
    const store = createChatStore();
    replayEvents(
      store,
      [
        { event: "user_message", data: JSON.stringify({ text: "First" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-1" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 1" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
        { event: "user_message", data: JSON.stringify({ text: "Second" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-2" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 2" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      ],
      { stopAtCheckpoint: "cp-2" },
    );

    const { messages, checkpoints, totalCost } = store.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Reply 1");
    expect(checkpoints).toEqual(["cp-1"]);
    expect(totalCost).toBe(0.01);
  });

  it("stopAtCheckpoint on third message keeps first two turns", () => {
    const store = createChatStore();
    replayEvents(
      store,
      [
        { event: "user_message", data: JSON.stringify({ text: "First" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-1" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 1" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
        { event: "user_message", data: JSON.stringify({ text: "Second" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-2" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 2" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.02, numTurns: 1 }) },
        { event: "user_message", data: JSON.stringify({ text: "Third" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-3" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 3" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.03, numTurns: 1 }) },
      ],
      { stopAtCheckpoint: "cp-3" },
    );

    const { messages, checkpoints, totalCost } = store.getState();
    expect(messages).toHaveLength(4);
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Reply 1");
    expect(messages[2].content).toBe("Second");
    expect(messages[3].content).toBe("Reply 2");
    expect(checkpoints).toEqual(["cp-1", "cp-2"]);
    expect(totalCost).toBe(0.03);
  });

  it("stopAtCheckpoint preserves session_init that precedes the target", () => {
    const store = createChatStore();
    replayEvents(
      store,
      [
        { event: "user_message", data: JSON.stringify({ text: "First" }) },
        {
          event: "session_init",
          data: JSON.stringify({ sdkSessionId: "sdk-1", model: "test", tools: [] }),
        },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-1" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 1" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      ],
      { stopAtCheckpoint: "cp-1" },
    );

    // session_init comes between user_message and checkpoint — both excluded
    expect(store.getState().messages).toHaveLength(0);
    expect(store.getState().sdkSessionId).toBeNull();
  });

  it("replays everything when stopAtCheckpoint is not provided", () => {
    const store = createChatStore();
    replayEvents(store, [
      { event: "user_message", data: JSON.stringify({ text: "First" }) },
      { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-1" }) },
      { event: "text_delta", data: JSON.stringify({ text: "Reply 1" }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      { event: "user_message", data: JSON.stringify({ text: "Second" }) },
      { event: "text_delta", data: JSON.stringify({ text: "Reply 2" }) },
      { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
    ]);

    expect(store.getState().messages).toHaveLength(4);
    expect(store.getState().totalCost).toBe(0.02);
  });

  it("replays everything when stopAtCheckpoint does not match", () => {
    const store = createChatStore();
    replayEvents(
      store,
      [
        { event: "user_message", data: JSON.stringify({ text: "First" }) },
        { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-1" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Reply 1" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      ],
      { stopAtCheckpoint: "nonexistent" },
    );

    expect(store.getState().messages).toHaveLength(2);
    expect(store.getState().totalCost).toBe(0.01);
  });
});
