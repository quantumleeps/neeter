# @neeter/react

React components and hooks for building chat UIs on top of the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk). Connects to an `@neeter/server` backend over SSE with a Zustand store, drop-in components, and a widget system for tool call rendering.

Part of the [neeter](https://github.com/quantumleeps/neeter) toolkit.

## Install

```bash
pnpm add @neeter/react
```

Peer dependencies:

```json
{
  "react": ">=18.0.0",
  "react-markdown": ">=10.0.0",
  "zustand": ">=5.0.0",
  "immer": ">=10.0.0"
}
```

Components use [Tailwind CSS v4](https://tailwindcss.com/) utility classes.

## Quick start

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

## Styling

Components use [shadcn/ui](https://ui.shadcn.com)-compatible CSS variable names. If you already have a shadcn theme, add one line:

```css
@import "tailwindcss";
@source "../node_modules/@neeter/react/dist";
```

Without shadcn, import the bundled theme:

```css
@import "tailwindcss";
@import "@neeter/react/theme.css";
```

## Key features

- **11 built-in widgets** — Diff views for edits, code blocks for reads, expandable pills for web searches, and more. Auto-registered on import.
- **Custom widgets** — Register your own components for MCP tools or app-specific rendering with `registerWidget()`.
- **Tool call lifecycle** — Each tool moves through `pending` → `streaming_input` → `running` → `complete` with streaming JSON input.
- **Permissions UI** — `ToolApprovalCard` and `UserQuestionCard` for browser-side tool approval.
- **Extended thinking** — Collapsible thinking blocks with streaming text.
- **Custom events** — Handle app-specific events from `onToolResult` via `AgentProvider`'s `onCustomEvent` prop.
- **Abort** — Stop the agent mid-turn with `stopSession()` from `useAgentContext()`.

## Examples

| Example | Description |
|---------|-------------|
| [basic-chat](https://github.com/quantumleeps/neeter/tree/main/examples/basic-chat) | Minimal component setup |
| [live-preview](https://github.com/quantumleeps/neeter/tree/main/examples/live-preview) | Custom events, widgets, split-pane preview |

## Documentation

- [Full API reference](https://github.com/quantumleeps/neeter#readme)
- [Built-in widgets](https://github.com/quantumleeps/neeter/blob/main/docs/built-in-widgets.md)
- [Custom widgets](https://github.com/quantumleeps/neeter/blob/main/docs/custom-widgets.md)

## License

MIT
