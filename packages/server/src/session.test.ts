import { describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: () =>
    (async function* () {
      // no-op
    })(),
}));

import { SessionManager } from "./session.js";

function createManager() {
  return new SessionManager<{ n: number }>(() => ({
    context: { n: 1 },
    model: "test",
    systemPrompt: "test",
  }));
}

describe("SessionManager.listHistory", () => {
  it("returns empty when no sessions exist", () => {
    const mgr = createManager();
    expect(mgr.listHistory()).toEqual([]);
  });

  it("excludes sessions without sdkSessionId", () => {
    const mgr = createManager();
    mgr.create();
    expect(mgr.listHistory()).toEqual([]);
  });

  it("includes sessions with sdkSessionId", () => {
    const mgr = createManager();
    const session = mgr.create();
    session.sdkSessionId = "sdk-123";

    const history = mgr.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0].sdkSessionId).toBe("sdk-123");
    expect(history[0].description).toBe("");
    expect(history[0].createdAt).toBeTypeOf("number");
    expect(history[0].lastActivityAt).toBeTypeOf("number");
  });

  it("captures firstPrompt from pushMessage", () => {
    const mgr = createManager();
    const session = mgr.create();
    session.sdkSessionId = "sdk-456";
    session.pushMessage("Build a blue card");
    session.pushMessage("Now make it green");

    const history = mgr.listHistory();
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

    const history = mgr.listHistory();
    expect(history[0].sdkSessionId).toBe("sdk-new");
    expect(history[1].sdkSessionId).toBe("sdk-old");
  });
});
