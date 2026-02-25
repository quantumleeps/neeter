import type {
  ContentBlock,
  PermissionResponse,
  RewindFilesRequest,
  SSEEvent,
  UserMessageContent,
} from "@neeter/types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { extractText, type Session, type SessionManager, sessionMeta } from "./session.js";
import { type MessageTranslator, sseEncode, streamSession } from "./translator.js";

const VALID_IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function validateContentBlocks(
  blocks: unknown[],
): { ok: true; content: ContentBlock[] } | { ok: false; error: string } {
  if (blocks.length === 0) return { ok: false, error: "Content array must not be empty" };
  const validated: ContentBlock[] = [];
  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    switch (b.type) {
      case "text": {
        if (typeof b.text !== "string" || !b.text.trim()) {
          return { ok: false, error: "Text blocks must have non-empty text" };
        }
        validated.push({ type: "text", text: b.text });
        break;
      }
      case "image": {
        const src = b.source as Record<string, unknown> | undefined;
        if (!src || src.type !== "base64") {
          return { ok: false, error: "Image blocks must have a base64 source" };
        }
        if (!VALID_IMAGE_MEDIA_TYPES.has(src.media_type as string)) {
          return { ok: false, error: `Unsupported media type: ${src.media_type}` };
        }
        if (typeof src.data !== "string" || !src.data) {
          return { ok: false, error: "Image blocks must have non-empty base64 data" };
        }
        validated.push({
          type: "image",
          source: {
            type: "base64",
            media_type: src.media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: src.data,
          },
        });
        break;
      }
      default:
        return { ok: false, error: `Unknown content block type: ${b.type}` };
    }
  }
  return { ok: true, content: validated };
}

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
  const pendingUserMessages = new WeakMap<Session<TCtx>, UserMessageContent[]>();

  app.use(`${basePath}/*`, cors({ origin: "*" }));

  app.get(`${basePath}/sessions/history`, async (c) => {
    return c.json(await sessions.listHistory());
  });

  app.post(`${basePath}/sessions`, (c) => {
    const session = sessions.create();
    return c.json({ sessionId: session.id });
  });

  app.post(`${basePath}/sessions/resume`, async (c) => {
    const body = await c.req.json<{
      sdkSessionId: string;
      forkSession?: boolean;
      resumeSessionAt?: string;
    }>();
    if (!body.sdkSessionId?.trim()) {
      return c.json({ error: "sdkSessionId is required" }, 400);
    }

    const sdkId = body.sdkSessionId.trim();
    const checkpointId = body.resumeSessionAt?.trim() || undefined;

    // The SDK's resumeSessionAt uses "includes" semantics — the agent's
    // context retains the target message. Our UI and file rewind use
    // "before" semantics. For rewind (not fork), translate by passing the
    // previous checkpoint's UUID so the agent context ends before the
    // target message. Also truncate the persisted event log.
    let sdkResumeAt = checkpointId;
    if (checkpointId && !body.forkSession) {
      const store = sessions.getStore();
      if (store) {
        const record = await store.load(sdkId);
        if (record) {
          const allCheckpoints = record.events
            .filter((e) => e.event === "checkpoint")
            .map((e) => JSON.parse(e.data).userMessageUuid as string);
          const targetIdx = allCheckpoints.indexOf(checkpointId);
          if (targetIdx > 0) {
            sdkResumeAt = allCheckpoints[targetIdx - 1];
          } else if (targetIdx === 0) {
            sdkResumeAt = undefined;
          }

          const cpIdx = record.events.findIndex(
            (e) => e.event === "checkpoint" && JSON.parse(e.data).userMessageUuid === checkpointId,
          );
          if (cpIdx >= 0) {
            let cutIdx = cpIdx;
            for (let i = cpIdx - 1; i >= 0; i--) {
              if (record.events[i].event === "user_message") {
                cutIdx = i;
                break;
              }
            }
            const truncated = record.events.slice(0, cutIdx);
            await store.delete(sdkId);
            await store.save(sdkId, { meta: record.meta, events: truncated });
          }
        }
      }
    }

    const session = sessions.resume({
      sdkSessionId: sdkId,
      forkSession: body.forkSession,
      resumeSessionAt: sdkResumeAt,
    });
    // Wait for the SDK subprocess to initialize, then restore file
    // checkpoints before returning. resumeSessionAt only truncates
    // conversation context — files must be rewound explicitly.
    await session.messageIterator.initializationResult();
    if (checkpointId) {
      try {
        await session.messageIterator.rewindFiles(checkpointId);
      } catch (err) {
        console.warn("[resume] rewindFiles failed:", (err as Error).message);
      }
    }
    return c.json({ sessionId: session.id });
  });

  app.post(`${basePath}/sessions/:id/messages`, async (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);

    const body = await c.req.json<{ text?: string; content?: unknown[] }>();

    let messageContent: UserMessageContent;
    if (Array.isArray(body.content)) {
      const result = validateContentBlocks(body.content);
      if (!result.ok) return c.json({ error: result.error }, 400);
      messageContent = result.content;
    } else if (body.text?.trim()) {
      messageContent = body.text.trim();
    } else {
      return c.json({ error: "Message text or content required" }, 400);
    }

    session.pushMessage(messageContent);

    const text = extractText(messageContent);
    const persistData: Record<string, unknown> = { text };
    if (typeof messageContent !== "string") persistData.content = messageContent;

    const store = sessions.getStore();
    if (store && session.sdkSessionId) {
      void store.save(session.sdkSessionId, {
        meta: sessionMeta(session),
        events: [{ event: "user_message", data: JSON.stringify(persistData) }],
      });
    } else if (store) {
      const pending = pendingUserMessages.get(session) ?? [];
      pending.push(messageContent);
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
              const userEvents = pending.map((content) => {
                const text = extractText(content);
                const data: Record<string, unknown> = { text };
                if (typeof content !== "string") data.content = content;
                return { event: "user_message", data: JSON.stringify(data) };
              });
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
