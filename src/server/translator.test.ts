import { describe, expect, it } from "vitest";
import { PermissionGate } from "./permission-gate.js";
import type { Session } from "./session.js";
import { MessageTranslator, sseEncode } from "./translator.js";

function stubSession(ctx = {}): Session<Record<string, unknown>> {
  return {
    id: "sess-1",
    context: ctx,
    pushMessage: () => {},
    messageIterator: (async function* () {})(),
    permissionGate: new PermissionGate(),
    abort: () => {},
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

describe("MessageTranslator", () => {
  const session = stubSession();

  it("emits message_start on stream_event/message_start", () => {
    const t = new MessageTranslator();
    const events = t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    expect(events).toEqual([{ event: "message_start", data: "{}" }]);
  });

  it("emits tool_start on content_block_start with tool_use", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_start",
          content_block: { type: "tool_use", id: "tool-1", name: "search" },
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "tool_start", data: JSON.stringify({ id: "tool-1", name: "search" }) },
    ]);
  });

  it("emits text_delta on content_block_delta with text_delta", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "hello" } },
      },
      session,
    );
    expect(events).toEqual([{ event: "text_delta", data: JSON.stringify({ text: "hello" }) }]);
  });

  it("emits tool_input_delta on content_block_delta with input_json_delta", () => {
    const t = new MessageTranslator();
    // First register a tool so lastToolId works
    t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_start",
          content_block: { type: "tool_use", id: "tool-2", name: "read" },
        },
      },
      session,
    );
    const events = t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "input_json_delta", partial_json: '{"q":' },
        },
      },
      session,
    );
    expect(events).toEqual([
      {
        event: "tool_input_delta",
        data: JSON.stringify({ id: "tool-2", partialJson: '{"q":' }),
      },
    ]);
  });

  it("emits tool_call on assistant message with tool_use blocks", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [{ type: "tool_use", id: "t-1", name: "fetch", input: { url: "https://x" } }],
        },
      },
      session,
    );
    expect(events).toEqual([
      {
        event: "tool_call",
        data: JSON.stringify({ id: "t-1", name: "fetch", input: { url: "https://x" } }),
      },
    ]);
  });

  it("emits tool_result on user message with tool_result blocks", () => {
    const t = new MessageTranslator();
    // Register tool name first
    t.translate(
      {
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "t-2", name: "calc", input: {} }] },
      },
      session,
    );
    const events = t.translate(
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t-2", content: "42" }],
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "tool_result", data: JSON.stringify({ toolUseId: "t-2", result: "42" }) },
    ]);
  });

  it("wraps onToolResult return values as custom SSE events", () => {
    const t = new MessageTranslator({
      onToolResult: (toolName, result) => [{ name: "data_updated", value: { toolName, result } }],
    });
    // Register tool name
    t.translate(
      {
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "t-3", name: "save", input: {} }] },
      },
      session,
    );
    const events = t.translate(
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t-3", content: "ok" }],
        },
      },
      session,
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      event: "tool_result",
      data: JSON.stringify({ toolUseId: "t-3", result: "ok" }),
    });
    expect(events[1]).toEqual({
      event: "custom",
      data: JSON.stringify({ name: "data_updated", value: { toolName: "save", result: "ok" } }),
    });
  });

  it("emits tool_progress", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      { type: "tool_progress", tool_name: "build", elapsed_time_seconds: 5.2 },
      session,
    );
    expect(events).toEqual([
      { event: "tool_progress", data: JSON.stringify({ toolName: "build", elapsed: 5.2 }) },
    ]);
  });

  it("emits turn_complete on success result", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      { type: "result", subtype: "success", num_turns: 3, total_cost_usd: 0.05 },
      session,
    );
    expect(events).toEqual([
      { event: "turn_complete", data: JSON.stringify({ numTurns: 3, cost: 0.05 }) },
    ]);
  });

  it("emits session_error on non-success result", () => {
    const t = new MessageTranslator();
    const events = t.translate({ type: "result", subtype: "max_turns" }, session);
    expect(events).toEqual([
      { event: "session_error", data: JSON.stringify({ subtype: "max_turns" }) },
    ]);
  });

  it("emits thinking_start on content_block_start with thinking", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_start",
          content_block: { type: "thinking" },
        },
      },
      session,
    );
    expect(events).toEqual([{ event: "thinking_start", data: "{}" }]);
  });

  it("emits thinking_delta on content_block_delta with thinking_delta", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "Let me analyze..." },
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "thinking_delta", data: JSON.stringify({ text: "Let me analyze..." }) },
    ]);
  });

  it("emits thinking_delta from assistant message with thinking content block (no prior stream)", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [{ type: "thinking", thinking: "I need to consider..." }],
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "thinking_delta", data: JSON.stringify({ text: "I need to consider..." }) },
    ]);
  });

  it("skips assistant thinking when stream thinking already emitted (dedup)", () => {
    const t = new MessageTranslator();
    // Simulate stream: message_start → thinking_delta
    t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "stream thought" },
        },
      },
      session,
    );
    // Now the assistant message arrives with the full thinking block
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "stream thought" },
            { type: "text", text: "response" },
          ],
        },
      },
      session,
    );
    // Should NOT emit thinking_delta again — only non-thinking blocks pass through
    expect(events).toEqual([]);
  });

  it("resets hadStreamThinking on new message_start", () => {
    const t = new MessageTranslator();
    // First turn: stream thinking
    t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "first" },
        },
      },
      session,
    );
    // New turn: message_start resets the flag
    t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    // Assistant message with thinking should emit (no stream thinking this turn)
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [{ type: "thinking", thinking: "second turn thought" }],
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "thinking_delta", data: JSON.stringify({ text: "second turn thought" }) },
    ]);
  });

  it("returns empty array for unknown message types", () => {
    const t = new MessageTranslator();
    const events = t.translate({ type: "unknown_type" }, session);
    expect(events).toEqual([]);
  });
});

describe("sseEncode", () => {
  it("formats as SSE with event and data fields", () => {
    expect(sseEncode({ event: "text_delta", data: '{"text":"hi"}' })).toBe(
      'event: text_delta\ndata: {"text":"hi"}\n\n',
    );
  });
});
