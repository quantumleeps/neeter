# Vanilla Chat

A minimal chat UI using `@neeter/core` directly — no React, no framework. Plain TypeScript + DOM APIs on the Claude Agent SDK.

This example demonstrates the same streaming chat experience as [basic-chat](../basic-chat), but built entirely with `@neeter/core`'s framework-agnostic `AgentClient` and Zustand store. Use it as a starting point for Vue, Svelte, Web Components, or any non-React environment.

## Prerequisites

- Node.js 18+
- An `ANTHROPIC_API_KEY` environment variable

## Running

From the monorepo root:

```sh
pnpm install
pnpm build
cd examples/vanilla-chat
pnpm dev
```

This starts:

- **Server** on `http://localhost:3000` (Hono + Claude Agent SDK)
- **Client** on `http://localhost:5173` (Vite — no framework plugin)

Open `http://localhost:5173` in your browser.

## How it works

The server is identical to any neeter backend — `SessionManager` + `MessageTranslator` + `createAgentRouter`. The client uses `@neeter/core` directly instead of `@neeter/react`:

```
Browser ──POST /api/sessions──▸ Server (creates session)
Browser ──POST /api/sessions/:id/messages──▸ Server (sends user message)
Browser ◂──GET /api/sessions/:id/events (SSE)── Server (streams responses)
```

On the client side:

```typescript
import { AgentClient, createChatStore } from "@neeter/core";

const store = createChatStore();
const client = new AgentClient(store, { endpoint: "/api" });

await client.connect();
client.attachEventSource();

store.subscribe((state) => render(state));

await client.sendMessage("Hello!");
```

The `store.subscribe()` callback fires on every state change — messages, streaming text, tool calls, permissions — and the `render()` function rebuilds the DOM. No virtual DOM, no JSX, no framework runtime.
