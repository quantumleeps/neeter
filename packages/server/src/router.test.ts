import { describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: ({ options }: { options: Record<string, unknown> }) => {
    void options;
    return (async function* () {})();
  },
}));

import type { ContentBlock } from "@neeter/types";
import { createAgentRouter } from "./router.js";
import { SessionManager } from "./session.js";
import { MessageTranslator } from "./translator.js";

function createApp() {
  const sessions = new SessionManager<Record<string, unknown>>(() => ({
    context: {},
    model: "test",
    systemPrompt: "test",
  }));
  const translator = new MessageTranslator();
  const app = createAgentRouter({ sessions, translator });
  return { app, sessions };
}

async function postMessage(
  app: ReturnType<typeof createApp>["app"],
  sessionId: string,
  body: Record<string, unknown>,
) {
  return app.request(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /sessions/:id/messages", () => {
  it("accepts a plain text message", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, { text: "Hello" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("accepts a content array with text + image blocks", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const content: ContentBlock[] = [
      { type: "text", text: "Describe this" },
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "iVBOR..." },
      },
    ];
    const res = await postMessage(app, session.id, { content });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("prefers content over text when both provided", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const content: ContentBlock[] = [{ type: "text", text: "From content array" }];
    const res = await postMessage(app, session.id, {
      text: "From text field",
      content,
    });
    expect(res.status).toBe(200);
    // firstPrompt should come from the content array
    expect(session.firstPrompt).toBe("From content array");
  });

  it("rejects empty content array", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, { content: [] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/must not be empty/i);
  });

  it("rejects text blocks with empty text", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, {
      content: [{ type: "text", text: "  " }],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non-empty text/i);
  });

  it("rejects image blocks without base64 source", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, {
      content: [{ type: "image", source: { type: "url", url: "https://example.com/img.png" } }],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base64 source/i);
  });

  it("rejects unsupported image media types", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, {
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/bmp", data: "abc" },
        },
      ],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported media type/i);
  });

  it("rejects image blocks with empty data", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, {
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: "" },
        },
      ],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non-empty base64 data/i);
  });

  it("rejects unknown content block types", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, {
      content: [{ type: "video", url: "https://example.com/v.mp4" }],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown content block type/i);
  });

  it("rejects when neither text nor content is provided", async () => {
    const { app, sessions } = createApp();
    const session = sessions.create();

    const res = await postMessage(app, session.id, {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/text or content required/i);
  });

  it("returns 404 for unknown session", async () => {
    const { app } = createApp();

    const res = await postMessage(app, "nonexistent", { text: "Hello" });
    expect(res.status).toBe(404);
  });

  it("accepts all four supported image media types", async () => {
    const { app, sessions } = createApp();

    for (const mediaType of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
      const session = sessions.create();
      const res = await postMessage(app, session.id, {
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: "abc123" },
          },
        ],
      });
      expect(res.status).toBe(200);
    }
  });
});
