// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChatStore } from "./store.js";
import { useAgent } from "./use-agent.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  method?: string;
  body?: unknown;
}

let fetchCalls: FetchCall[] = [];
let fetchSessionId = "new-session-1";
let fetchHistoryResponse: unknown[] = [];
let fetchReplayResponse: unknown[] = [];

const mockFetch = vi.fn(async (url: string | URL | Request, opts?: RequestInit) => {
  const body = opts?.body ? JSON.parse(opts.body as string) : undefined;
  fetchCalls.push({ url: url as string, method: opts?.method, body });
  if ((url as string).endsWith("/sessions/history")) {
    return { ok: true, json: async () => fetchHistoryResponse } as Response;
  }
  if ((url as string).includes("/sessions/replay/")) {
    return { ok: true, json: async () => fetchReplayResponse } as Response;
  }
  return { json: async () => ({ sessionId: fetchSessionId }) } as Response;
});

class MockEventSource {
  static instances: MockEventSource[] = [];
  closed = false;
  addEventListener = vi.fn();
  close = vi.fn(() => {
    this.closed = true;
  });
  constructor() {
    MockEventSource.instances.push(this);
  }
}

beforeEach(() => {
  fetchCalls = [];
  fetchSessionId = "new-session-1";
  fetchHistoryResponse = [];
  fetchReplayResponse = [];
  MockEventSource.instances = [];
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgent", () => {
  describe("mount", () => {
    it("creates a new session by default", async () => {
      const store = createChatStore();
      renderHook(() => useAgent(store, { endpoint: "/api" }));

      await waitFor(() => expect(fetchCalls).toHaveLength(1));
      expect(fetchCalls[0].url).toBe("/api/sessions");
      expect(fetchCalls[0].method).toBe("POST");
      expect(fetchCalls[0].body).toBeUndefined();
      expect(store.getState().sessionId).toBe("new-session-1");
    });

    it("resumes when resumeSessionId is provided", async () => {
      const store = createChatStore();
      renderHook(() => useAgent(store, { endpoint: "/api", resumeSessionId: "sdk-abc" }));

      await waitFor(() => expect(fetchCalls).toHaveLength(2));
      expect(fetchCalls[0].url).toBe("/api/sessions/replay/sdk-abc");
      expect(fetchCalls[1].url).toBe("/api/sessions/resume");
      expect(fetchCalls[1].body).toEqual({ sdkSessionId: "sdk-abc" });
      expect(store.getState().sessionId).toBe("new-session-1");
    });
  });

  describe("resumeSession", () => {
    it("uses explicit sdkSessionId over the store value", async () => {
      const store = createChatStore();
      store.getState().setSdkSessionId("store-sdk-id");

      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      fetchCalls = [];
      fetchSessionId = "resumed-session";

      await act(() => result.current.resumeSession({ sdkSessionId: "explicit-id" }));

      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0].url).toBe("/api/sessions/replay/explicit-id");
      expect(fetchCalls[1].url).toBe("/api/sessions/resume");
      expect(fetchCalls[1].body).toEqual({ sdkSessionId: "explicit-id", forkSession: undefined });
      expect(store.getState().sessionId).toBe("resumed-session");
    });

    it("falls back to the store sdkSessionId when none is passed", async () => {
      const store = createChatStore();
      store.getState().setSdkSessionId("store-sdk-id");

      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      fetchCalls = [];
      fetchSessionId = "resumed-session";

      await act(() => result.current.resumeSession());

      expect(fetchCalls[0].url).toBe("/api/sessions/replay/store-sdk-id");
      expect(fetchCalls[1].body).toEqual({ sdkSessionId: "store-sdk-id", forkSession: undefined });
    });

    it("no-ops when no sdkSessionId is available", async () => {
      const store = createChatStore();
      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      fetchCalls = [];
      await act(() => result.current.resumeSession());

      expect(fetchCalls).toHaveLength(0);
    });

    it("resets store before resuming", async () => {
      const store = createChatStore();
      store.getState().setSdkSessionId("sdk-1");
      store.getState().addUserMessage("hello");

      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      fetchCalls = [];
      fetchSessionId = "resumed-session";
      fetchReplayResponse = [];
      await act(() => result.current.resumeSession());

      expect(store.getState().messages).toHaveLength(0);
      expect(store.getState().sessionId).toBe("resumed-session");
    });

    it("replays stored events into the store on resume", async () => {
      const store = createChatStore();
      store.getState().setSdkSessionId("sdk-1");

      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      fetchCalls = [];
      fetchSessionId = "resumed-session";
      fetchReplayResponse = [
        { event: "user_message", data: JSON.stringify({ text: "Hello" }) },
        { event: "text_delta", data: JSON.stringify({ text: "Hi!" }) },
        { event: "turn_complete", data: JSON.stringify({ cost: 0.01, numTurns: 1 }) },
      ];

      await act(() => result.current.resumeSession());

      expect(store.getState().messages).toHaveLength(2);
      expect(store.getState().messages[0]).toMatchObject({ role: "user", content: "Hello" });
      expect(store.getState().messages[1]).toMatchObject({ role: "assistant", content: "Hi!" });
    });
  });

  describe("newSession", () => {
    it("resets store and creates a fresh session", async () => {
      const store = createChatStore();
      store.getState().setSdkSessionId("sdk-old");
      store.getState().addUserMessage("old message");

      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      fetchCalls = [];
      fetchSessionId = "fresh-session";

      await act(() => result.current.newSession());

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe("/api/sessions");
      expect(fetchCalls[0].method).toBe("POST");
      expect(store.getState().messages).toHaveLength(0);
      expect(store.getState().sdkSessionId).toBeNull();
      expect(store.getState().sessionId).toBe("fresh-session");
    });

    it("closes the existing EventSource", async () => {
      const store = createChatStore();
      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      // The mount effect sets sessionId, which triggers the EventSource effect
      await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0));
      const es = MockEventSource.instances[MockEventSource.instances.length - 1];

      fetchSessionId = "fresh-session";
      await act(() => result.current.newSession());

      expect(es.close).toHaveBeenCalled();
    });
  });

  describe("refreshHistory", () => {
    it("fetches session history from the endpoint", async () => {
      fetchHistoryResponse = [
        { sdkSessionId: "sdk-1", description: "Blue card", createdAt: 1000, lastActivityAt: 2000 },
      ];

      const store = createChatStore();
      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      fetchCalls = [];
      await act(() => result.current.refreshHistory());

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe("/api/sessions/history");
      expect(result.current.sessionHistory).toEqual([
        { sdkSessionId: "sdk-1", description: "Blue card", createdAt: 1000, lastActivityAt: 2000 },
      ]);
    });

    it("starts with empty session history", async () => {
      const store = createChatStore();
      const { result } = renderHook(() => useAgent(store, { endpoint: "/api" }));
      await waitFor(() => expect(store.getState().sessionId).toBe("new-session-1"));

      expect(result.current.sessionHistory).toEqual([]);
    });
  });
});
