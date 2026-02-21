import { serve } from "@hono/node-server";
import { createAgentRouter, MessageTranslator, SessionManager } from "@neeter/server";

const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-20250514",
  systemPrompt: "You are a helpful assistant.",
  permissionMode: "bypassPermissions",
}));

const translator = new MessageTranslator();

const app = createAgentRouter({ sessions, translator });

const port = Number(process.env.PORT ?? 3000);
console.log(`Server listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
