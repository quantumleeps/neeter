# neeter

[![npm version](https://img.shields.io/npm/v/@neeter/server)](https://www.npmjs.com/package/@neeter/server)
[![license](https://img.shields.io/npm/l/@neeter/server)](./LICENSE)

A React + Hono toolkit that puts a browser UI on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) — the same agentic framework that powers Claude Code. Streams tool calls, file edits, permissions, and multi-turn sessions over SSE into ready-made React components.

## Why neeter

The Claude Agent SDK gives you a powerful agentic loop — but it's a server-side `AsyncGenerator` with no opinion on how to get those events to a browser. neeter bridges that gap:

- **Multi-turn persistent sessions** — `PushChannel` + `SessionManager` let users send messages at any time. Messages queue and the SDK picks them up when ready — no "wait for the agent to finish" lockout.
- **Named SSE event routing** — The SDK yields a flat stream of internal message types. The `MessageTranslator` reshapes them into semantically named SSE events (`text_delta`, `tool_start`, `tool_call`, `tool_result`, ...) that the browser's `EventSource` can route with native `addEventListener`.
- **UI-friendly tool lifecycle** — Tool calls move through `pending` → `streaming_input` → `running` → `complete` phases with streaming JSON input, giving your UI fine-grained control over loading states and progressive rendering.
- **Structured custom events** — Hook into tool results with `onToolResult` and emit typed `{ name, value }` events for app-specific reactivity (e.g. "document saved", "data refreshed") without touching the core protocol.
- **Browser-side tool approval** — The SDK's `canUseTool` callback fires on the server, but your users are in the browser. `PermissionGate` bridges the gap with deferred promises, SSE events, and an HTTP POST endpoint — the agent blocks until the user clicks Allow/Deny or answers a clarifying question.
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

## Server

`@neeter/server` gives you a Hono router that manages Agent SDK sessions and streams events to the client over SSE.

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

### Extended thinking

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

This gives you five endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create a session, returns `{ sessionId }` |
| `POST` | `/api/sessions/:id/messages` | Send `{ text }` to a session |
| `GET` | `/api/sessions/:id/events` | SSE stream of agent events |
| `POST` | `/api/sessions/:id/permissions` | Respond to a permission request (see [Permissions](#permissions)) |
| `POST` | `/api/sessions/:id/abort` | Abort the current agent turn |

### Session context

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

### Reacting to tool results

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

Each returned `{ name, value }` object is sent to the client as a `custom` SSE event.

### Permissions

By default sessions run with `permissionMode: "bypassPermissions"` — all tools execute automatically. Set `permissionMode` to `"default"` (or `"acceptEdits"`) to require browser-side approval before each tool runs:

```typescript
const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  permissionMode: "default",
}));
```

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

## Client

`@neeter/react` provides a drop-in chat UI that connects to your server.

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

### Custom events

If your server emits custom events (via `onToolResult`), handle them with `onCustomEvent`:

```tsx
<AgentProvider
  onCustomEvent={(e) => {
    if (e.name === "notes_updated") {
      myStore.getState().setNotes(e.value);
    }
  }}
>
  <Chat />
</AgentProvider>
```

Each event is a typed `CustomEvent<T>` with `name` and `value` fields.

### Widgets

When you add tools to your `SessionManager`, neeter automatically renders them with purpose-built widgets — diff views for edits, code blocks for file reads, expandable link pills for web searches, and so on. No configuration needed.

- **[Built-in widgets](docs/built-in-widgets.md)** — what ships out of the box for the 11 supported SDK tools, how approval previews work, and how to extend or override them
- **[Custom widgets](docs/custom-widgets.md)** — register your own components for MCP tools or app-specific rendering

Tool calls without a registered widget fall back to a minimal status indicator.

### Tool call lifecycle

Each tool call moves through phases, reflected in `WidgetProps.phase`:

| Phase | Trigger | What's available |
|-------|---------|-----------------:|
| `pending` | `tool_start` SSE event | `input: {}` |
| `streaming_input` | `tool_input_delta` events | `partialInput` accumulates |
| `running` | `tool_call` event (input finalized) | `input` is complete |
| `complete` | `tool_result` event | `result` is JSON-parsed |
| `error` | Error during execution | `error` message |

## Styling

Neeter components use Tailwind v4 utility classes and [shadcn/ui](https://ui.shadcn.com)-compatible CSS variable names (`bg-primary`, `text-muted-foreground`, `border-border`, etc.).

### With shadcn/ui

Your existing theme variables are already compatible. Add one line to your main CSS so Tailwind scans neeter's component source for utility classes:

```css
@import "tailwindcss";
@source "../node_modules/@neeter/react/dist";
```

The `@source` path is relative to your CSS file — adjust if your stylesheet lives in a nested directory (e.g. `../../node_modules/@neeter/react/dist`).

### Without shadcn/ui

Import the bundled theme, which includes source scanning automatically:

```css
@import "tailwindcss";
@import "@neeter/react/theme.css";
```

This provides a neutral OKLCH palette with light + dark mode support and the Tailwind v4 `@theme inline` variable bridge.

### Dark mode

Dark mode activates via:
- `.dark` class on `<html>` (recommended), or
- `prefers-color-scheme: dark` system preference (automatic)

Add `.light` to `<html>` to force light mode when using system preference detection.

### Switching to shadcn later

Drop the `@neeter/react/theme.css` import and add `@source` — your shadcn theme takes over with zero migration.

## Examples

| Example | Description |
|---------|-------------|
| **[basic-chat](examples/basic-chat)** | Minimal chat UI — `AgentProvider` + `MessageList` + `ChatInput` |
| **[live-preview](examples/live-preview)** | Split-pane coding assistant with live React preview, per-session sandboxes, and code viewer |

## API Reference

### `@neeter/server`

| Export | Description |
|--------|-------------|
| `SessionManager<TCtx>` | Manages agent sessions with per-session context |
| `Session<TCtx>` | A single session — `id`, `context`, `pushMessage()`, `permissionGate`, `abort()` |
| `SessionInit<TCtx>` | Factory return type — `model`, `systemPrompt`, `permissionMode`, `mcpServers`, etc. |
| `MessageTranslator<TCtx>` | Converts SDK messages to SSE events |
| `TranslatorConfig<TCtx>` | Translator options — `onToolResult` hook |
| `createAgentRouter<TCtx>(config)` | Returns a Hono app with session, SSE, and permission routes |
| `PermissionGate` | Per-session deferred-promise map for tool approval and user questions |
| `PushChannel<T>` | Async iterable queue for feeding messages to the SDK |
| `sseEncode(event)` | Formats an `SSEEvent` as an SSE string |
| `createSandboxHook(dir, resolve)` | PreToolUse hook that blocks file operations outside a sandbox directory |
| `streamSession(session, translator)` | Async generator yielding `SSEEvent`s |

### `@neeter/react`

| Export | Description |
|--------|-------------|
| `AgentProvider` | Context provider — wraps store + SSE connection |
| `useAgentContext()` | Returns `{ sessionId, sendMessage, stopSession, respondToPermission, store }` |
| `useChatStore(selector)` | Zustand selector hook into chat state |
| `createChatStore()` | Creates a vanilla Zustand store (for advanced use) |
| `useAgent(store, config?)` | SSE connection hook (used internally by `AgentProvider`) |
| `MessageList` | Auto-scrolling message list with pending permissions and thinking indicator |
| `TextMessage` | Markdown-rendered message bubble |
| `ChatInput` | Textarea + send/stop button (accepts `onStop`, `isStreaming`) |
| `ToolCallCard` | Lifecycle-aware tool call display with inline approval |
| `PendingPermissions` | Renders pending tool approval and user question cards |
| `ToolApprovalCard` | Tool approval card with Allow/Deny buttons |
| `UserQuestionCard` | Structured question card with option selection |
| `ThinkingBlock` | Collapsible card displaying extended thinking text |
| `ThinkingIndicator` | Animated dots shown while agent is generating |
| `CollapsibleCard` | Expandable card wrapper |
| `StopIcon` | Square stop icon SVG component |
| `StatusDot` | Phase-colored status indicator |
| `cn(...inputs)` | `clsx` + `tailwind-merge` utility for class merging |
| `registerWidget(registration)` | Register a component for a tool name |
| `getWidget(toolName)` | Look up a registered widget |
| `stripMcpPrefix(name)` | `"mcp__server__tool"` → `"tool"` |

### Types (re-exported from both entry points)

| Type | Description |
|------|-------------|
| `SSEEvent` | `{ event: string, data: string }` |
| `ChatMessage` | `{ id, role, content, thinking?, toolCalls? }` |
| `ToolCallInfo` | `{ id, name, input, partialInput?, result?, error?, status }` |
| `ToolCallPhase` | `"pending" \| "streaming_input" \| "running" \| "complete" \| "error"` |
| `WidgetProps<TResult>` | Props passed to widget components |
| `WidgetRegistration<TResult>` | Widget registration — `toolName`, `label`, `richLabel?`, `inputRenderer?`, `component` |
| `ChatStore` | `StoreApi<ChatStoreShape>` — vanilla Zustand store |
| `ChatStoreShape` | Full state + actions interface |
| `CustomEvent<T>` | `{ name: string, value: T }` — structured app-level event |
| `PermissionRequest` | `ToolApprovalRequest \| UserQuestionRequest` — pending permission |
| `PermissionResponse` | `ToolApprovalResponse \| UserQuestionResponse` — user's answer |
| `ToolApprovalRequest` | `{ kind, requestId, toolName, toolUseId?, input, description? }` |
| `ToolApprovalResponse` | `{ kind, requestId, behavior: "allow" \| "deny", message? }` |
| `UserQuestion` | `{ question, header?, options?, multiSelect? }` |
| `UserQuestionRequest` | `{ kind, requestId, questions: UserQuestion[] }` |
| `UserQuestionResponse` | `{ kind, requestId, answers: Record<string, string> }` |

## SSE Events

Events emitted by the server, handled automatically by `useAgent`:

| Event | Payload | Description |
|-------|---------|-------------|
| `message_start` | `{}` | Agent began generating a response |
| `thinking_start` | `{}` | Extended thinking block began |
| `thinking_delta` | `{ text }` | Streaming thinking text chunk |
| `text_delta` | `{ text }` | Streaming text chunk |
| `tool_start` | `{ id, name }` | Agent began calling a tool |
| `tool_input_delta` | `{ id, partialJson }` | Streaming tool input JSON |
| `tool_call` | `{ id, name, input }` | Tool input finalized |
| `tool_result` | `{ toolUseId, result }` | Tool execution result |
| `tool_progress` | `{ toolName, elapsed }` | Long-running tool heartbeat |
| `permission_request` | `PermissionRequest` | Tool approval or user question awaiting response |
| `turn_complete` | `{ numTurns, cost }` | Agent turn finished |
| `custom` | `{ name, value }` | App-specific event from `onToolResult` |
| `session_error` | `{ subtype }` | Session ended with error |

## Development

See [docs/development.md](docs/development.md) for local setup, pre-commit hooks, and CI.

## License

MIT
