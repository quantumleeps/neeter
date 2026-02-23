# neeter

[![CI](https://github.com/quantumleeps/neeter/actions/workflows/ci.yml/badge.svg)](https://github.com/quantumleeps/neeter/actions/workflows/ci.yml)
[![npm @neeter/server](https://img.shields.io/npm/v/@neeter/server?label=%40neeter%2Fserver)](https://www.npmjs.com/package/@neeter/server)
[![npm @neeter/react](https://img.shields.io/npm/v/@neeter/react?label=%40neeter%2Freact)](https://www.npmjs.com/package/@neeter/react)
[![license](https://img.shields.io/npm/l/@neeter/server)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

A React + Hono toolkit that puts a browser UI on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) — the same agentic framework that powers Claude Code. Streams tool calls, file edits, permissions, and multi-turn sessions over SSE into ready-made React components.

<p align="center">
  <img src="docs/assets/hero.png" alt="A multi-turn conversation with streaming tool calls, built with neeter" width="600" />
</p>

## Why neeter

The Claude Agent SDK gives you a powerful agentic loop — but it's a server-side `AsyncGenerator` with no opinion on how to get those events to a browser. neeter bridges that gap:

- **Multi-turn persistent sessions** — `PushChannel` + `SessionManager` let users send messages at any time. Messages queue and the SDK picks them up when ready — no "wait for the agent to finish" lockout.
- **Named SSE event routing** — The SDK yields a flat stream of internal message types. The `MessageTranslator` reshapes them into semantically named SSE events (`text_delta`, `tool_start`, `tool_call`, `tool_result`, ...) that the browser's `EventSource` can route with native `addEventListener`.
- **UI-friendly tool lifecycle** — Tool calls move through `pending` → `streaming_input` → `running` → `complete` phases with streaming JSON input, giving your UI fine-grained control over loading states and progressive rendering.
- **Structured custom events** — Hook into tool results with `onToolResult` and emit typed `{ name, value }` events for app-specific reactivity (e.g. "document saved", "data refreshed") without touching the core protocol.
- **Browser-side tool approval** — The SDK's `canUseTool` callback fires on the server, but your users are in the browser. `PermissionGate` bridges the gap with deferred promises, SSE events, and an HTTP POST endpoint — the agent blocks until the user clicks Allow/Deny or answers a clarifying question.
- **Session resume & persistence** — The SDK persists conversations on disk. `SessionManager` captures the SDK session ID, exposes `resume()` for continuing past conversations, and accepts a pluggable `SessionStore` for persisting event history across server restarts. The built-in `createJsonSessionStore` writes append-only JSONL files; on resume, `replayEvents` reconstructs the UI from stored events.
- **Client-server separation** — Server handles transport (SSE encoding, session routing). Client handles state (Zustand store, React components). The translator is the clean seam between them.

## Install

```bash
# Server
pnpm add @neeter/server

# Client
pnpm add @neeter/react
```

Peer dependencies — **server**:

```json
{
  "@anthropic-ai/claude-agent-sdk": ">=0.2.0",
  "hono": ">=4.0.0"
}
```

Peer dependencies — **client**:

```json
{
  "react": ">=18.0.0",
  "react-markdown": ">=10.0.0",
  "zustand": ">=5.0.0",
  "immer": ">=10.0.0",
  "tailwindcss": ">=4.0.0"
}
```

## Quick start

### Server

The Claude Agent SDK reads your API key from the environment automatically. Make sure it's set before starting your server:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

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

> Endpoints, session context, permissions, extended thinking, persistence, and sandbox hooks are covered in the [Server Guide](docs/server.md).

### Client

```tsx
import { AgentProvider, MessageList, ChatInput, useAgentContext } from "@neeter/react";

function App() {
  return (
    <AgentProvider>
      <Chat />
    </AgentProvider>
  );
}

function Chat() {
  const { sendMessage } = useAgentContext();

  return (
    <div className="flex h-screen flex-col">
      <MessageList className="flex-1" />
      <ChatInput onSend={sendMessage} />
    </div>
  );
}
```

Components use Tailwind utility classes and accept `className` for overrides.

> Styling, custom events, widgets, and the SSE protocol are covered in the [Client Guide](docs/client.md).

## Examples

| Example | Description |
|---------|-------------|
| **[basic-chat](examples/basic-chat)** | Minimal chat UI — `AgentProvider` + `MessageList` + `ChatInput` |
| **[live-preview](examples/live-preview)** | Split-pane coding assistant with live React preview, per-session sandboxes, and code viewer |

## Documentation

| Guide | What it covers |
|-------|----------------|
| [Server Guide](docs/server.md) | Endpoints, session context, permissions, thinking, persistence, sandbox |
| [Client Guide](docs/client.md) | Styling, custom events, widgets, tool lifecycle, SSE protocol |
| [Built-in Widgets](docs/built-in-widgets.md) | The 11 SDK tool widgets and how to override them |
| [Custom Widgets](docs/custom-widgets.md) | Registering your own tool widgets |
| [API Reference](docs/api-reference.md) | All exports and types for server, react, and types packages |
| [Development](docs/development.md) | Local setup, pre-commit hooks, CI |

## License

MIT
