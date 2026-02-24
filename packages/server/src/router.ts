import type { PermissionResponse, RewindFilesRequest, SSEEvent } from "@neeter/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Session, type SessionManager, sessionMeta } from "./session.js";
import { type MessageTranslator, sseEncode, streamSession } from "./translator.js";

const PERSISTED_EVENTS = new Set([
  "text_delta",
  "thinking_delta",
  "tool_start",
  "tool_call",
  "tool_result",
  "turn_complete",
  "session_init",
  "session_error",
  "custom",
  "checkpoint",
]);

/**
 * Returns a Hono app with eight routes for session management, SSE streaming,
 * permissions, and abort. Mounts under `basePath` (default: `"/api"`).
 */
export function createAgentRouter<TCtx>(config: {
  sessions: SessionManager<TCtx>;
  translator: MessageTranslator<TCtx>;
  /** URL prefix for all routes. Defaults to `"/api"`. */
  basePath?: string;
}): Hono {
  const { sessions, translator, basePath = "/api" } = config;
  const app = new Hono();
  const pendingUserMessages = new WeakMap<Session<TCtx>, string[]>();

  app.use(`${basePath}/*`, cors({ origin: "*" }));

  app.get(`${basePath}/sessions/history`, async (c) => {
    return c.json(await sessions.listHistory());
  });

  app.post(`${basePath}/sessions`, (c) => {
    const session = sessions.create();
    return c.json({ sessionId: session.id });
  });

  app.post(`${basePath}/sessions/resume`, async (c) => {
    const body = await c.req.json<{ sdkSessionId: string; forkSession?: boolean }>();
    if (!body.sdkSessionId?.trim()) {
      return c.json({ error: "sdkSessionId is required" }, 400);
    }
    const session = sessions.resume({
      sdkSessionId: body.sdkSessionId.trim(),
      forkSession: body.forkSession,
    });
    return c.json({ sessionId: session.id });
  });

  app.post(`${basePath}/sessions/:id/messages`, async (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const body = await c.req.json<{ text: string }>();
    if (!body.text?.trim()) return c.json({ error: "Message text required" }, 400);

    const text = body.text.trim();
    session.pushMessage(text);

    const store = sessions.getStore();
    if (store && session.sdkSessionId) {
      void store.save(session.sdkSessionId, {
        meta: sessionMeta(session),
        events: [{ event: "user_message", data: JSON.stringify({ text }) }],
      });
    } else if (store) {
      const pending = pendingUserMessages.get(session) ?? [];
      pending.push(text);
      pendingUserMessages.set(session, pending);
    }

    return c.json({ ok: true });
  });

  app.get(`${basePath}/sessions/:id/events`, (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const store = sessions.getStore();
    const persistEvent = store
      ? (evt: SSEEvent) => {
          if (!session.sdkSessionId || !PERSISTED_EVENTS.has(evt.event)) return;
          if (evt.event === "session_init") {
            const pending = pendingUserMessages.get(session);
            if (pending) {
              const userEvents = pending.map((text) => ({
                event: "user_message",
                data: JSON.stringify({ text }),
              }));
              void store.save(session.sdkSessionId, {
                meta: sessionMeta(session),
                events: [...userEvents, evt],
              });
              pendingUserMessages.delete(session);
              return;
            }
          }
          void store.save(session.sdkSessionId, {
            meta: sessionMeta(session),
            events: [evt],
          });
        }
      : undefined;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const evt of streamSession(session, translator, persistEvent)) {
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

  app.get(`${basePath}/sessions/replay/:sdkSessionId`, async (c) => {
    const events = await sessions.loadEvents(c.req.param("sdkSessionId"));
    return c.json(events);
  });

  app.post(`${basePath}/sessions/:id/permissions`, async (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const body = await c.req.json<PermissionResponse>();
    if (!body.requestId || !body.kind) {
      return c.json({ error: "Invalid permission response" }, 400);
    }

    const resolved = session.permissionGate.respond(body);
    if (!resolved) {
      return c.json({ error: "No pending request with this ID" }, 404);
    }

    session.lastActivityAt = Date.now();
    return c.json({ ok: true });
  });

  app.post(`${basePath}/sessions/:id/rewind`, async (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const body = await c.req.json<RewindFilesRequest>();
    if (!body.userMessageId?.trim()) {
      return c.json({ error: "userMessageId is required" }, 400);
    }

    const result = await session.messageIterator.rewindFiles(body.userMessageId.trim(), {
      dryRun: body.dryRun,
    });
    session.lastActivityAt = Date.now();
    return c.json(result);
  });

  app.post(`${basePath}/sessions/:id/abort`, (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    session.abort();
    return c.json({ ok: true });
  });

  return app;
}
