import { Hono } from "hono";
import { cors } from "hono/cors";
import type { SessionManager } from "./session.js";
import { type MessageTranslator, sseEncode, streamSession } from "./translator.js";

export function createAgentRouter<TCtx>(config: {
  sessions: SessionManager<TCtx>;
  translator: MessageTranslator<TCtx>;
  basePath?: string;
}): Hono {
  const { sessions, translator, basePath = "/api" } = config;
  const app = new Hono();

  app.use(`${basePath}/*`, cors({ origin: "*" }));

  app.post(`${basePath}/sessions`, (c) => {
    const session = sessions.create();
    return c.json({ sessionId: session.id });
  });

  app.post(`${basePath}/sessions/:id/messages`, async (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const body = await c.req.json<{ text: string }>();
    if (!body.text?.trim()) return c.json({ error: "Message text required" }, 400);

    session.pushMessage(body.text.trim());
    return c.json({ ok: true });
  });

  app.get(`${basePath}/sessions/:id/events`, (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const evt of streamSession(session, translator)) {
            controller.enqueue(encoder.encode(sseEncode(evt)));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            encoder.encode(sseEncode({ event: "error", data: JSON.stringify({ message }) })),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  return app;
}
