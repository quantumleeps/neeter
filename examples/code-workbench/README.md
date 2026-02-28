# Code Workbench

A split-pane coding assistant with live preview — built with Neeter on the Claude Agent SDK.

The agent writes React components in a sandboxed `app.jsx`. Each edit triggers a live preview reload in the right pane. Includes file checkpointing, session resume, and a code viewer overlay.

## Prerequisites

- Node.js 18+
- An `ANTHROPIC_API_KEY` environment variable

## Running

From the monorepo root:

```sh
pnpm install
pnpm build
cd examples/code-workbench
pnpm dev
```

This starts:

- **Server** on `http://localhost:3000` (Hono + Claude Agent SDK)
- **Client** on `http://localhost:5173` (Vite + React)

Open `http://localhost:5173` in your browser.

## How it works

Each session gets an isolated sandbox directory with an `app.jsx` file. The agent reads and edits this file using the SDK's built-in tools. A preview endpoint composes `app.jsx` into an HTML shell with Tailwind, Babel, and an import map (React, D3, Recharts, Three.js, Framer Motion).

```
Browser ──POST /api/sessions──▸ Server (creates session + sandbox)
Browser ──POST /api/sessions/:id/messages──▸ Server (sends user message)
Browser ◂──GET /api/sessions/:id/events (SSE)── Server (streams responses)
Browser ◂──GET /api/sessions/:id/preview/index.html── Server (live preview)
```

When the agent completes a Write or Edit tool call, the server emits a `preview_reload` custom event. The client listens for this and reloads the preview iframe.

File checkpointing is enabled — hover over any user message to rewind the conversation and/or filesystem state.
