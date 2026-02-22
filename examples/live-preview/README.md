# Live Preview

A split-pane coding assistant: chat with Claude on the left, watch it build
a React app in real time on the right. Each session gets an isolated
sandbox with Tailwind CSS and a curated set of libraries — the agent
writes pure JSX and the preview updates on every edit.

> **Warning — experimental.** This example gives an AI agent access to a
> local filesystem directory. It is designed for experimentation only and
> is **not suitable for production use** without extensive hardening (see
> [Safety & sandboxing](#safety--sandboxing) below).

## Prerequisites

- Node.js 18+
- An `ANTHROPIC_API_KEY` environment variable

## Running

From the monorepo root:

```sh
pnpm install
pnpm build
cd examples/live-preview
pnpm dev
```

This starts:

- **Server** on `http://localhost:3000` (Hono + Claude Agent SDK)
- **Client** on `http://localhost:5173` (Vite + React)

Open `http://localhost:5173` and try prompts like:

- "Make a landing page for a high school student"
- "Fun generative art with spirals and lines"
- "A retro terminal-style portfolio page"

## How it works

Each browser tab gets its own **sandbox directory** (`./sandboxes/{uuid}/`)
containing a single `app.jsx` file — a complete React component tree that
the agent reads and edits. The sandbox never contains HTML; instead, the
server composes a full page on-the-fly by injecting `app.jsx` into an HTML
shell template that loads Tailwind CSS, Babel standalone, and an import map.

This split keeps the agent's context lean — it only ever sees pure React
code, never the `<head>` boilerplate, CDN scripts, or import map config.

### Available libraries

The import map makes these packages available via bare specifiers
(`import * as d3 from "d3"`). The agent can also use any package from
`esm.sh` by URL.

| Package | Use |
| --- | --- |
| `react`, `react-dom/client` | Already mounted — write JSX directly |
| `d3` | Data visualization |
| `chart.js`, `chart.js/auto` | Charts |
| `recharts` | React chart components |
| `react-markdown` | Markdown rendering |
| `three` | 3D graphics |
| `framer-motion` | Animations |

### Architecture

```
Browser
├── Left pane: chat (MessageList + ChatInput)
├── Right pane: <iframe> showing composed preview
└── Code viewer: syntax-highlighted app.jsx overlay

Server
├── POST /api/sessions              → create session + sandbox dir
├── POST /api/sessions/:id/messages → send user message
├── POST /api/sessions/:id/abort    → stop the agent mid-turn
├── GET  /api/sessions/:id/events   → SSE stream
├── GET  /api/sessions/:id/source   → raw app.jsx for code viewer
└── GET  /api/sessions/:id/preview/* → composed HTML for iframe
```

When the agent's Write or Edit tool completes, the server emits a
`preview_reload` custom event via SSE. The client catches it and
reloads the iframe — no file watcher needed.

The agent has access to `Read`, `Write`, `Edit`, `Glob`, `Grep`, and
`TodoWrite`, with its `cwd` set to the sandbox directory. The system
prompt instructs it to read `app.jsx` first, then use the Edit tool
to modify the React app — never overwriting the whole file.

## Safety & sandboxing

This example applies several layers of protection, but none of them
constitute a security boundary suitable for untrusted users.

### What's in place

- **PreToolUse sandbox hook** — A `createSandboxHook()` hook (from
  `@neeter/server`) intercepts every tool call and blocks any file
  operation whose resolved path falls outside the sandbox directory.
  This prevents path traversal (`../../etc/passwd`) and sibling-directory
  access.

- **Permission mode** — The session runs in `"default"` permission mode
  with `allowedTools: ["Read", "Glob", "Grep", "Edit", "TodoWrite"]`.
  Read-only and edit operations are auto-approved. `Write` and any
  unlisted tool require explicit human approval in the browser before
  the agent can proceed.

- **Disallowed tools** — `WebFetch`, `WebSearch`, and `NotebookEdit` are
  explicitly blocked via `disallowedTools`, so the agent cannot reach the
  network or execute arbitrary code through notebooks.

- **No shell access** — `Bash` is not included in the tools list, so the
  agent cannot execute shell commands.

- **Preview path validation** — The `/preview/*` endpoint normalizes the
  requested path and rejects any traversal attempt before serving files.

### What production use would require

The protections above are best-effort application-level checks. For a
production deployment with untrusted users, you would need at minimum:

- **Container or VM isolation** — Run each sandbox in a throwaway
  container with a read-only root filesystem and no host mounts.
- **Network restrictions** — Block outbound network access from the
  sandbox environment.
- **Resource limits** — Cap CPU, memory, disk, and process count per
  sandbox.
- **Authentication & rate limiting** — Gate session creation behind
  auth and enforce per-user rate limits.
- **Ephemeral sandboxes** — Auto-destroy sandbox directories after a
  timeout or on session close.
- **Content Security Policy** — Serve preview iframes with a strict CSP
  and sandbox attribute to limit what rendered pages can do.

See [Securely deploying AI agents](https://platform.claude.com/docs/en/agent-sdk/secure-deployment)
for comprehensive guidance on isolation, credential management, and
network controls.
