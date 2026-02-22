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

This gives you five endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create a session |
| `POST` | `/api/sessions/:id/messages` | Send a message |
| `GET` | `/api/sessions/:id/events` | SSE event stream |
| `POST` | `/api/sessions/:id/permissions` | Respond to a permission request |
| `POST` | `/api/sessions/:id/abort` | Abort the current turn |

## Key features

- **Multi-turn sessions** — `SessionManager` + `PushChannel` let users send messages at any time, even while the agent is running.
- **Named SSE events** — `MessageTranslator` reshapes the SDK's flat message stream into `text_delta`, `tool_start`, `tool_call`, `tool_result`, and more.
- **Tool result hooks** — `onToolResult` lets you inspect what the agent did and emit structured custom events.
- **Permission modes** — `bypassPermissions`, `default`, `acceptEdits`, or `plan` — with browser-side approval via `PermissionGate`.
- **Extended thinking** — Pass `thinking: { type: "enabled", budgetTokens: N }` to stream chain-of-thought reasoning.
- **Abort** — Cancel the current agent turn mid-stream.
- **Sandbox hooks** — `createSandboxHook` restricts file operations to a directory.

## Examples

| Example | Description |
|---------|-------------|
| [basic-chat](https://github.com/quantumleeps/neeter/tree/main/examples/basic-chat) | Minimal server + client setup |
| [live-preview](https://github.com/quantumleeps/neeter/tree/main/examples/live-preview) | Per-session sandboxes, custom events, abort |

## Documentation

See the [neeter README](https://github.com/quantumleeps/neeter#readme) for full API reference, session context examples, and permission configuration.

## License

MIT
