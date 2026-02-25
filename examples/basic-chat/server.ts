import { serve } from "@hono/node-server";
import { createAgentRouter, MessageTranslator, SessionManager } from "@neeter/server";
import { createPokemonServer } from "./pokemon-server.js";

// The Agent SDK spawns a Claude Code subprocess. If we're running inside
// a Claude Code session, CLAUDECODE causes the subprocess to refuse to start.
delete process.env.CLAUDECODE;

const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-20250514",
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: "You are a helpful assistant that can look up Pokémon.",
  },
  mcpServers: { pokemon: createPokemonServer() },
  allowedTools: ["mcp__pokemon__*"],
}));

const translator = new MessageTranslator();

const app = createAgentRouter({ sessions, translator });

const port = Number(process.env.PORT ?? 3000);
console.log(`Server listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
