import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJsonSessionStore } from "./json-store.js";

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "neeter-store-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("createJsonSessionStore", () => {
  it("save and load round-trips", async () => {
    const store = createJsonSessionStore(dataDir);
    await store.save("sess-1", {
      meta: { sdkSessionId: "sess-1", description: "hello", createdAt: 1000, lastActivityAt: 2000 },
      events: [
        { event: "text_delta", data: JSON.stringify({ text: "hi" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      ],
    });

    const record = await store.load("sess-1");
    if (!record) throw new Error("expected record");
    expect(record.meta.sdkSessionId).toBe("sess-1");
    expect(record.meta.description).toBe("hello");
    expect(record.events).toHaveLength(2);
    expect(record.events[0].event).toBe("text_delta");
  });

  it("appends events across multiple saves", async () => {
    const store = createJsonSessionStore(dataDir);
    const meta = { sdkSessionId: "sess-2", description: "", createdAt: 1000, lastActivityAt: 2000 };

    await store.save("sess-2", {
      meta,
      events: [{ event: "text_delta", data: JSON.stringify({ text: "a" }) }],
    });
    await store.save("sess-2", {
      meta: { ...meta, lastActivityAt: 3000 },
      events: [{ event: "text_delta", data: JSON.stringify({ text: "b" }) }],
    });

    const record = await store.load("sess-2");
    if (!record) throw new Error("expected record");
    expect(record.events).toHaveLength(2);
    expect(record.meta.lastActivityAt).toBe(3000);
  });

  it("load returns null for unknown session", async () => {
    const store = createJsonSessionStore(dataDir);
    expect(await store.load("nonexistent")).toBeNull();
  });

  it("list returns all sessions sorted by lastActivityAt descending", async () => {
    const store = createJsonSessionStore(dataDir);
    await store.save("old", {
      meta: {
        sdkSessionId: "old",
        description: "old session",
        createdAt: 100,
        lastActivityAt: 100,
      },
      events: [],
    });
    await store.save("new", {
      meta: {
        sdkSessionId: "new",
        description: "new session",
        createdAt: 200,
        lastActivityAt: 200,
      },
      events: [],
    });

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].sdkSessionId).toBe("new");
    expect(list[1].sdkSessionId).toBe("old");
  });

  it("delete removes both files", async () => {
    const store = createJsonSessionStore(dataDir);
    await store.save("doomed", {
      meta: { sdkSessionId: "doomed", description: "", createdAt: 1, lastActivityAt: 1 },
      events: [{ event: "text_delta", data: "{}" }],
    });

    await store.delete("doomed");
    expect(await store.load("doomed")).toBeNull();
    expect(await store.list()).toHaveLength(0);
  });

  it("delete is safe for nonexistent session", async () => {
    const store = createJsonSessionStore(dataDir);
    await store.delete("ghost");
  });
});
