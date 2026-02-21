# Basic Chat

A minimal chat UI built with Neeter — React + Hono on the Claude Agent SDK.

## Prerequisites

- Node.js 18+
- An `ANTHROPIC_API_KEY` environment variable

## Running

From the monorepo root:

```sh
pnpm install
pnpm build
cd examples/basic-chat
pnpm dev
```

This starts:

- **Server** on `http://localhost:3000` (Hono + Claude Agent SDK)
- **Client** on `http://localhost:5173` (Vite + React)

Open `http://localhost:5173` in your browser.

## How it works

The server creates a Claude Agent SDK session for each browser tab.
Messages flow over Server-Sent Events (SSE):

```
Browser ──POST /api/sessions──▸ Server (creates session)
Browser ──POST /api/sessions/:id/messages──▸ Server (sends user message)
Browser ◂──GET /api/sessions/:id/events (SSE)── Server (streams responses)
```

The React side uses `<AgentProvider>` to manage sessions and
`<MessageList>` / `<ChatInput>` to render the conversation.
