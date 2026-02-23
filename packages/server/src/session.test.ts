import { describe, expect, it, vi } from "vitest";

let lastQueryOptions: Record<string, unknown> | undefined;

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: ({ options }: { options: Record<string, unknown> }) => {
    lastQueryOptions = options;
    return (async function* () {
      // no-op
    })();
  },
}));

import { SessionManager } from "./session.js";

function createManager(
  factory?: (original?: { context: { n: number } }) => {
    context: { n: number };
    model: string;
    systemPrompt: string;
  },
) {
  return new SessionManager<{ n: number }>(
    factory ??
      (() => ({
        context: { n: 1 },
        model: "test",
        systemPrompt: "test",
      })),
  );
}

describe("SessionManager.resume", () => {
  it("passes resume sdkSessionId to query options", () => {
    const mgr = createManager();
    mgr.resume({ sdkSessionId: "sdk-abc" });

    expect(lastQueryOptions?.resume).toBe("sdk-abc");
    expect(lastQueryOptions?.forkSession).toBeUndefined();
  });

  it("passes forkSession when requested", () => {
    const mgr = createManager();
    mgr.resume({ sdkSessionId: "sdk-abc", forkSession: true });

    expect(lastQueryOptions?.resume).toBe("sdk-abc");
    expect(lastQueryOptions?.forkSession).toBe(true);
  });

  it("passes original session to factory when in-memory session exists", () => {
    let receivedOriginal: unknown = "not-called";
    const mgr = createManager((original) => {
      receivedOriginal = original;
      return { context: { n: original ? 99 : 1 }, model: "test", systemPrompt: "test" };
    });

    const session = mgr.create();
    session.sdkSessionId = "sdk-existing";

    mgr.resume({ sdkSessionId: "sdk-existing" });

    expect(receivedOriginal).toBeDefined();
    expect((receivedOriginal as { id: string }).id).toBe(session.id);
  });

  it("passes undefined to factory when no in-memory session matches", () => {
    let receivedOriginal: unknown = "not-called";
    const mgr = createManager((original) => {
      receivedOriginal = original;
      return { context: { n: 1 }, model: "test", systemPrompt: "test" };
    });

    mgr.resume({ sdkSessionId: "sdk-nonexistent" });

    expect(receivedOriginal).toBeUndefined();
  });

  it("creates a new session with a different id", () => {
    const mgr = createManager();
    const original = mgr.create();
    original.sdkSessionId = "sdk-abc";

    const resumed = mgr.resume({ sdkSessionId: "sdk-abc" });
    expect(resumed.id).not.toBe(original.id);
    expect(mgr.get(resumed.id)).toBe(resumed);
  });
});

describe("SessionInit passthrough", () => {
  it("forwards extraArgs to query options", () => {
    const mgr = new SessionManager<{ n: number }>(() => ({
      context: { n: 1 },
      model: "test",
      systemPrompt: "test",
      extraArgs: { "replay-user-messages": null },
    }));
    mgr.create();

    expect(lastQueryOptions?.extraArgs).toEqual({ "replay-user-messages": null });
  });

  it("forwards env to query options", () => {
    const mgr = new SessionManager<{ n: number }>(() => ({
      context: { n: 1 },
      model: "test",
      systemPrompt: "test",
      env: { CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: "1" },
    }));
    mgr.create();

    expect(lastQueryOptions?.env).toEqual({ CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: "1" });
  });

  it("omits extraArgs and env when not provided", () => {
    const mgr = createManager();
    mgr.create();

    expect(lastQueryOptions).not.toHaveProperty("extraArgs");
    expect(lastQueryOptions).not.toHaveProperty("env");
  });
});

describe("SessionManager.listHistory", () => {
  it("returns empty when no sessions exist", async () => {
    const mgr = createManager();
    expect(await mgr.listHistory()).toEqual([]);
  });

  it("excludes sessions without sdkSessionId", async () => {
    const mgr = createManager();
    mgr.create();
    expect(await mgr.listHistory()).toEqual([]);
  });

  it("includes sessions with sdkSessionId", async () => {
    const mgr = createManager();
    const session = mgr.create();
    session.sdkSessionId = "sdk-123";

    const history = await mgr.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0].sdkSessionId).toBe("sdk-123");
    expect(history[0].description).toBe("");
    expect(history[0].createdAt).toBeTypeOf("number");
    expect(history[0].lastActivityAt).toBeTypeOf("number");
  });

  it("captures firstPrompt from pushMessage", async () => {
    const mgr = createManager();
    const session = mgr.create();
    session.sdkSessionId = "sdk-456";
    session.pushMessage("Build a blue card");
    session.pushMessage("Now make it green");

    const history = await mgr.listHistory();
    expect(history[0].description).toBe("Build a blue card");
  });

  it("sorts by lastActivityAt descending", async () => {
    const mgr = createManager();

    const s1 = mgr.create();
    s1.sdkSessionId = "sdk-old";
    s1.lastActivityAt = 1000;

    const s2 = mgr.create();
    s2.sdkSessionId = "sdk-new";
    s2.lastActivityAt = 2000;

    const history = await mgr.listHistory();
    expect(history[0].sdkSessionId).toBe("sdk-new");
    expect(history[1].sdkSessionId).toBe("sdk-old");
  });
});
