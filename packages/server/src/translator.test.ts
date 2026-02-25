import { describe, expect, it } from "vitest";
import { PermissionGate } from "./permission-gate.js";
import type { Session } from "./session.js";
import { MessageTranslator, sseEncode } from "./translator.js";

function stubSession(ctx = {}): Session<Record<string, unknown>> {
  return {
    id: "sess-1",
    context: ctx,
    pushMessage: () => {},
    messageIterator: (async function* () {})() as unknown as Session<
      Record<string, unknown>
    >["messageIterator"],
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
      {
        event: "tool_result",
        data: JSON.stringify({ toolUseId: "t-2", result: "42", isError: false }),
      },
    ]);
  });

  it("emits tool_result with isError true when is_error is set", () => {
    const t = new MessageTranslator();
    t.translate(
      {
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "t-err", name: "Write", input: {} }] },
      },
      session,
    );
    const events = t.translate(
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "t-err",
              is_error: true,
              content: "Access outside sandbox directory is not allowed",
            },
          ],
        },
      },
      session,
    );
    expect(events).toEqual([
      {
        event: "tool_result",
        data: JSON.stringify({
          toolUseId: "t-err",
          result: "Access outside sandbox directory is not allowed",
          isError: true,
        }),
      },
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
      data: JSON.stringify({ toolUseId: "t-3", result: "ok", isError: false }),
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

  it("emits turn_complete on success result without usage", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "result",
        subtype: "success",
        num_turns: 3,
        total_cost_usd: 0.05,
        stop_reason: "end_turn",
      },
      session,
    );
    expect(events).toEqual([
      {
        event: "turn_complete",
        data: JSON.stringify({
          numTurns: 3,
          cost: 0.05,
          stopReason: "end_turn",
          usage: null,
          modelUsage: null,
        }),
      },
    ]);
  });

  it("emits turn_complete with stopReason null when stop_reason absent", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      { type: "result", subtype: "success", num_turns: 1, total_cost_usd: 0.01 },
      session,
    );
    const data = JSON.parse(events[0].data);
    expect(data.stopReason).toBeNull();
  });

  it("falls back to stream stop_reason when result stop_reason is null", () => {
    const t = new MessageTranslator();
    // Simulate message_delta with stop_reason (as the SDK streams it)
    t.translate(
      {
        type: "stream_event",
        event: { type: "message_delta", delta: { stop_reason: "end_turn" } },
      },
      session,
    );
    // Result arrives with stop_reason: null (SDK bug)
    const events = t.translate(
      { type: "result", subtype: "success", num_turns: 1, total_cost_usd: 0.01, stop_reason: null },
      session,
    );
    const data = JSON.parse(events[0].data);
    expect(data.stopReason).toBe("end_turn");
  });

  it("prefers result stop_reason over stream fallback when both present", () => {
    const t = new MessageTranslator();
    // Stream says end_turn
    t.translate(
      {
        type: "stream_event",
        event: { type: "message_delta", delta: { stop_reason: "end_turn" } },
      },
      session,
    );
    // Result explicitly says refusal
    const events = t.translate(
      {
        type: "result",
        subtype: "success",
        num_turns: 1,
        total_cost_usd: 0.01,
        stop_reason: "refusal",
      },
      session,
    );
    const data = JSON.parse(events[0].data);
    expect(data.stopReason).toBe("refusal");
  });

  it("uses stream stop_reason for error results when result stop_reason is null", () => {
    const t = new MessageTranslator();
    t.translate(
      {
        type: "stream_event",
        event: { type: "message_delta", delta: { stop_reason: "end_turn" } },
      },
      session,
    );
    const events = t.translate(
      { type: "result", subtype: "error_max_turns", stop_reason: null },
      session,
    );
    const data = JSON.parse(events[0].data);
    expect(data.stopReason).toBe("end_turn");
  });

  it("emits turn_complete with usage and modelUsage when present", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "result",
        subtype: "success",
        num_turns: 5,
        total_cost_usd: 0.12,
        stop_reason: "end_turn",
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_creation_input_tokens: 200,
          cache_read_input_tokens: 300,
        },
        modelUsage: {
          "claude-sonnet-4-20250514": {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationInputTokens: 200,
            cacheReadInputTokens: 300,
            webSearchRequests: 0,
            costUSD: 0.12,
            contextWindow: 200000,
          },
        },
      },
      session,
    );
    const data = JSON.parse(events[0].data);
    expect(data.numTurns).toBe(5);
    expect(data.cost).toBe(0.12);
    expect(data.usage).toEqual({
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 200,
      cacheReadInputTokens: 300,
    });
    expect(data.modelUsage["claude-sonnet-4-20250514"].costUSD).toBe(0.12);
  });

  it("emits session_error on non-success result with stopReason", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      { type: "result", subtype: "error_max_turns", stop_reason: "end_turn" },
      session,
    );
    expect(events).toEqual([
      {
        event: "session_error",
        data: JSON.stringify({ subtype: "error_max_turns", stopReason: "end_turn" }),
      },
    ]);
  });

  it("emits session_error with null stopReason when stop_reason absent", () => {
    const t = new MessageTranslator();
    const events = t.translate({ type: "result", subtype: "max_turns" }, session);
    const data = JSON.parse(events[0].data);
    expect(data.subtype).toBe("max_turns");
    expect(data.stopReason).toBeNull();
  });

  it("emits text_delta from assistant message when no prior stream text (non-streaming fallback)", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Hello from non-streaming path" }],
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "text_delta", data: JSON.stringify({ text: "Hello from non-streaming path" }) },
    ]);
  });

  it("skips assistant text when stream text already emitted (dedup)", () => {
    const t = new MessageTranslator();
    // Simulate stream: message_start → text_delta
    t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "streamed text" },
        },
      },
      session,
    );
    // Now the assistant message arrives with the full text block
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "streamed text" }],
        },
      },
      session,
    );
    expect(events).toEqual([]);
  });

  it("emits all content from assistant message in non-streaming mode (thinking suppresses stream_event)", () => {
    const t = new MessageTranslator();
    // No stream events — simulates thinking-enabled mode where SDK skips StreamEvent
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "Let me reason about this..." },
            { type: "text", text: "Here is my answer." },
            { type: "tool_use", id: "t-1", name: "Read", input: { file_path: "/a.ts" } },
          ],
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "thinking_delta", data: JSON.stringify({ text: "Let me reason about this..." }) },
      { event: "text_delta", data: JSON.stringify({ text: "Here is my answer." }) },
      {
        event: "tool_call",
        data: JSON.stringify({ id: "t-1", name: "Read", input: { file_path: "/a.ts" } }),
      },
    ]);
  });

  it("resets hadStreamText on new message_start", () => {
    const t = new MessageTranslator();
    // First turn: stream text
    t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "first" },
        },
      },
      session,
    );
    // New turn: message_start resets the flag
    t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    // Assistant message with text should emit (no stream text this turn)
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "second turn text" }],
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "text_delta", data: JSON.stringify({ text: "second turn text" }) },
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
    // Thinking is skipped (already streamed), but text was never streamed — fallback emits it
    expect(events).toEqual([{ event: "text_delta", data: JSON.stringify({ text: "response" }) }]);
  });

  it("skips both thinking and text when both were already streamed (full dedup)", () => {
    const t = new MessageTranslator();
    // Simulate full streaming: message_start → thinking → text
    t.translate({ type: "stream_event", event: { type: "message_start" } }, session);
    t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "thought" },
        },
      },
      session,
    );
    t.translate(
      {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "response" },
        },
      },
      session,
    );
    // Assistant message with both — both should be skipped
    const events = t.translate(
      {
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "thought" },
            { type: "text", text: "response" },
          ],
        },
      },
      session,
    );
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

  it("emits session_init on system init message and sets sdkSessionId on session", () => {
    const t = new MessageTranslator();
    const s = stubSession();
    const events = t.translate(
      {
        type: "system",
        subtype: "init",
        session_id: "sdk-abc-123",
        model: "claude-sonnet-4-20250514",
        tools: ["Read", "Write", "Bash"],
        mcp_servers: [
          { name: "github", status: "connected" },
          { name: "db", status: "failed" },
        ],
      },
      s,
    );
    expect(events).toEqual([
      {
        event: "session_init",
        data: JSON.stringify({
          sdkSessionId: "sdk-abc-123",
          model: "claude-sonnet-4-20250514",
          tools: ["Read", "Write", "Bash"],
          mcpServers: [
            { name: "github", status: "connected" },
            { name: "db", status: "failed" },
          ],
        }),
      },
    ]);
    expect(s.sdkSessionId).toBe("sdk-abc-123");
  });

  it("emits empty mcpServers when system init has no mcp_servers", () => {
    const t = new MessageTranslator();
    const s = stubSession();
    const events = t.translate(
      {
        type: "system",
        subtype: "init",
        session_id: "sdk-no-mcp",
        model: "claude-sonnet-4-20250514",
        tools: [],
      },
      s,
    );
    expect(events).toEqual([
      {
        event: "session_init",
        data: JSON.stringify({
          sdkSessionId: "sdk-no-mcp",
          model: "claude-sonnet-4-20250514",
          tools: [],
          mcpServers: [],
        }),
      },
    ]);
  });

  it("emits checkpoint event for real user messages only", () => {
    const t = new MessageTranslator();

    // Real user message (string content) → checkpoint emitted
    const realEvents = t.translate(
      {
        type: "user",
        uuid: "cp-uuid-real",
        message: { role: "user", content: "Hello" },
      },
      session,
    );
    expect(realEvents).toEqual([
      { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-uuid-real" }) },
    ]);

    // Tool-result round-trip (array content) → no checkpoint
    t.translate(
      {
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "t-cp", name: "Bash", input: {} }] },
      },
      session,
    );
    const toolEvents = t.translate(
      {
        type: "user",
        uuid: "cp-uuid-tool",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t-cp", content: "done" }],
        },
      },
      session,
    );
    expect(toolEvents).toEqual([
      {
        event: "tool_result",
        data: JSON.stringify({ toolUseId: "t-cp", result: "done", isError: false }),
      },
    ]);
  });

  it("does not emit checkpoint when user message has no uuid", () => {
    const t = new MessageTranslator();
    t.translate(
      {
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "t-no", name: "Read", input: {} }] },
      },
      session,
    );
    const events = t.translate(
      {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t-no", content: "ok" }],
        },
      },
      session,
    );
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("tool_result");
  });

  it("ignores non-init system messages", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      { type: "system", subtype: "status", status: "compacting" },
      session,
    );
    expect(events).toEqual([]);
  });

  it("returns empty array for unknown message types", () => {
    const t = new MessageTranslator();
    const events = t.translate({ type: "unknown_type" }, session);
    expect(events).toEqual([]);
  });

  it("emits checkpoint for user messages with content-array (text + image blocks)", () => {
    const t = new MessageTranslator();
    const events = t.translate(
      {
        type: "user",
        uuid: "cp-uuid-multimodal",
        message: {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: "iVBOR..." },
            },
          ],
        },
      },
      session,
    );
    expect(events).toEqual([
      { event: "checkpoint", data: JSON.stringify({ userMessageUuid: "cp-uuid-multimodal" }) },
    ]);
  });

  it("does not emit checkpoint for tool-result arrays (unchanged behavior)", () => {
    const t = new MessageTranslator();
    t.translate(
      {
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "t-tr", name: "Bash", input: {} }] },
      },
      session,
    );
    const events = t.translate(
      {
        type: "user",
        uuid: "cp-uuid-tool-result",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t-tr", content: "done" }],
        },
      },
      session,
    );
    // Should get tool_result but NOT a checkpoint
    expect(events).toEqual([
      {
        event: "tool_result",
        data: JSON.stringify({ toolUseId: "t-tr", result: "done", isError: false }),
      },
    ]);
  });
});

describe("sseEncode", () => {
  it("formats as SSE with event and data fields", () => {
    expect(sseEncode({ event: "text_delta", data: '{"text":"hi"}' })).toBe(
      'event: text_delta\ndata: {"text":"hi"}\n\n',
    );
  });
});
