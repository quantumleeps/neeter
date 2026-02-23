# Server Guide

> Part of [neeter](../README.md). See [all docs](../README.md#documentation).

`@neeter/server` gives you a Hono router that manages Agent SDK sessions and streams events to the client over SSE.

## Endpoints

`createAgentRouter` mounts eight endpoints (default base path: `/api`):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create a session, returns `{ sessionId }` |
| `POST` | `/api/sessions/resume` | Resume or fork a session by SDK session ID |
| `GET` | `/api/sessions/history` | List previous sessions |
| `GET` | `/api/sessions/replay/:sdkSessionId` | Load persisted events for UI replay |
| `POST` | `/api/sessions/:id/messages` | Send `{ text }` to a session |
| `GET` | `/api/sessions/:id/events` | SSE stream of agent events |
| `POST` | `/api/sessions/:id/permissions` | Respond to a permission request (see [Permissions](#permissions)) |
| `POST` | `/api/sessions/:id/abort` | Abort the current agent turn |

## Extended thinking

Enable Claude's chain-of-thought reasoning by setting `thinking` in your session config:

```typescript
const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  thinking: { type: "enabled", budgetTokens: 10000 },
}));
```

When enabled, thinking blocks stream to the client as `thinking_delta` SSE events and render as collapsible cards in `MessageList`. Set `{ type: "disabled" }` to explicitly turn thinking off (it's off by default).

<p>
  <img src="assets/thinking.png" alt="Extended thinking block with chain-of-thought reasoning" width="600" />
</p>

## Session context

`SessionManager` takes a factory function that runs once per session. The generic type parameter lets you attach per-session state:

```typescript
interface MyContext {
  history: string[];
}

const sessions = new SessionManager<MyContext>(() => ({
  context: { history: [] },
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  mcpServers: { myServer: createMyServer() },
  allowedTools: ["mcp__myServer__*"],
  maxTurns: 100,
}));
```

The context is available in translator hooks (see below).

## Reacting to tool results

Use `onToolResult` to inspect what the agent did and emit structured custom events:

```typescript
const translator = new MessageTranslator<MyContext>({
  onToolResult: (toolName, result, session) => {
    if (toolName === "save_note") {
      session.context.history.push(result);
      return [{ name: "notes_updated", value: session.context.history }];
    }
    return [];
  },
});
```

Each returned `{ name, value }` object is sent to the client as a `custom` SSE event. See [Custom events](client.md#custom-events) for the client-side handling.

## Permissions

By default sessions run with `permissionMode: "bypassPermissions"` — all tools execute automatically. Set `permissionMode` to `"default"` (or `"acceptEdits"`) to require browser-side approval before each tool runs:

```typescript
const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  permissionMode: "default",
}));
```

<p>
  <img src="assets/permission-card.png" alt="Tool approval card with inline diff preview" width="600" />
</p>

When `permissionMode` is not `"bypassPermissions"`:

1. Every tool call blocks the SDK until the user responds
2. `AskUserQuestion` calls surface as structured questions with options
3. `permission_request` SSE events fire to the client
4. The user's response is POSTed back to `/api/sessions/:id/permissions`

The `PermissionGate` on each session manages the deferred promises internally — no additional wiring needed.

| Mode | Behavior |
|------|----------|
| `"bypassPermissions"` | All tools auto-approved (default) |
| `"default"` | Every tool call requires explicit approval |
| `"acceptEdits"` | File edits auto-approved, other tools require approval |
| `"plan"` | Planning mode — SDK-defined behavior |

## Session resume & persistence

<p>
  <img src="assets/session-resume.png" alt="Session history sidebar with resumable past conversations" width="600" />
</p>

The Claude Agent SDK persists conversations on disk and supports resuming them. `SessionManager` captures the SDK-assigned session ID (delivered via a `session_init` SSE event) and exposes methods for resuming past sessions and browsing history.

**In-memory history** works out of the box — `listHistory()` returns sessions that are still in memory:

```typescript
const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
}));
```

**Persistent history** survives server restarts. Pass a `SessionStore` implementation to the constructor:

```typescript
import { createJsonSessionStore, SessionManager } from "@neeter/server";

const sessions = new SessionManager(
  () => ({
    context: {},
    model: "claude-sonnet-4-5-20250929",
    systemPrompt: "You are a helpful assistant.",
  }),
  { store: createJsonSessionStore("./data") },
);
```

`createJsonSessionStore` writes append-only JSONL event logs and JSON metadata sidecars to the given directory. On the client, `replayEvents` reconstructs the chat UI from stored events — the same store actions used by the live SSE stream, so rendering is identical.

The `SessionStore` interface is pluggable — implement `save`, `load`, `list`, and `delete` to back it with a database instead of the filesystem.

> **Security note:** `createJsonSessionStore` writes conversation data — including tool inputs and outputs — to disk unencrypted. Use it for development and trusted environments. Gate it behind an opt-in flag (like `--persist`) to keep the default workflow side-effect-free. The [live-preview](../examples/live-preview) example implements this pattern.

## Sandbox hook

`createSandboxHook` restricts file operations to a specific directory. It inspects `file_path` and `path` fields in tool input and blocks any resolved path that falls outside the sandbox:

```typescript
import { resolve } from "node:path";
import { createSandboxHook, SessionManager } from "@neeter/server";

const sandboxDir = resolve("./sandboxes/user-123");

const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  hooks: { PreToolUse: createSandboxHook(sandboxDir, resolve) },
}));
```

Bash is blocked by default — shell commands can reference paths outside the sandbox in ways that can't be reliably detected. Set `{ allowBash: true }` only when using OS-level isolation (containers, VMs, or `@anthropic-ai/sandbox-runtime`).

See the [live-preview](../examples/live-preview) example for a complete sandboxing setup.

---

See also: [Client Guide](client.md) | [API Reference](api-reference.md) | [Built-in Widgets](built-in-widgets.md)
