# @neeter/server

A Hono server toolkit that puts a browser UI on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk). Manages multi-turn sessions, translates SDK messages into named SSE events, and handles tool-approval permissions — so your React client gets a clean event stream out of the box.

Part of the [neeter](https://github.com/quantumleeps/neeter) toolkit.

## Install

```bash
pnpm add @neeter/server
```

Peer dependencies:

```json
{
  "@anthropic-ai/claude-agent-sdk": ">=0.2.0",
  "hono": ">=4.0.0"
}
```

## Quick start

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  createAgentRouter,
  SessionManager,
  MessageTranslator,
} from "@neeter/server";

const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  maxTurns: 50,
}));

const translator = new MessageTranslator();

const app = new Hono();
app.route("/", createAgentRouter({ sessions, translator }));

serve({ fetch: app.fetch, port: 3000 });
```

## Examples

| Example | Description |
|---------|-------------|
| [basic-chat](https://github.com/quantumleeps/neeter/tree/main/examples/basic-chat) | Minimal server + client setup |
| [code-workbench](https://github.com/quantumleeps/neeter/tree/main/examples/code-workbench) | Per-session sandboxes, persistence, file checkpointing, custom events |

## Documentation

- [Server Guide](https://github.com/quantumleeps/neeter/blob/main/docs/server.md) — endpoints, permissions, persistence, session context, sandbox hooks
- [API Reference](https://github.com/quantumleeps/neeter/blob/main/docs/api-reference.md) — all exports and types

## License

MIT
