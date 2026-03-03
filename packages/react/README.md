# @neeter/react

React components and hooks for building chat UIs on top of the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk). Builds on `@neeter/core` for state management and agent lifecycle — with drop-in components and a widget system for tool call rendering.

Part of the [neeter](https://github.com/quantumleeps/neeter) toolkit.

## Install

```bash
pnpm add @neeter/core @neeter/react
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

## Examples

| Example | Description |
|---------|-------------|
| [basic-chat](https://github.com/quantumleeps/neeter/tree/main/examples/basic-chat) | Minimal component setup |
| [code-workbench](https://github.com/quantumleeps/neeter/tree/main/examples/code-workbench) | Custom events, widgets, split-pane preview, file checkpointing |

## Documentation

- [Client Guide](https://quantumleeps.github.io/neeter/docs/client) — styling, custom events, widgets, tool lifecycle
- [API Reference](https://quantumleeps.github.io/neeter/docs/api-reference) — all exports and types
- [Built-in Widgets](https://quantumleeps.github.io/neeter/docs/built-in-widgets)
- [Custom Widgets](https://quantumleeps.github.io/neeter/docs/custom-widgets)

## License

MIT
