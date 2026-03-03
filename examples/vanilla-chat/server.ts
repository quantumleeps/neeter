import { serve } from "@hono/node-server";
import { createAgentRouter, MessageTranslator, SessionManager } from "@neeter/server";

delete process.env.CLAUDECODE;

const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-6",
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: "You are a helpful assistant.",
  },
}));

const translator = new MessageTranslator();

const app = createAgentRouter({ sessions, translator });

const port = Number(process.env.PORT ?? 3000);
console.log(`Server listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
