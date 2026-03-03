# @neeter/core

Framework-agnostic state management, agent lifecycle, and utilities for the [neeter](https://github.com/quantumleeps/neeter) toolkit. Use standalone for vanilla JS apps or as the foundation for `@neeter/react`.

Part of the [neeter](https://github.com/quantumleeps/neeter) toolkit.

## Install

```bash
pnpm add @neeter/core
```

Peer dependencies:

```json
{
  "zustand": ">=5.0.0",
  "immer": ">=10.0.0"
}
```

## What's inside

- **`AgentClient`** — manages EventSource lifecycle, session creation/resumption, message sending, and permissions
- **`createChatStore()`** — Zustand store for chat state, messages, tool calls, and streaming
- **`replayEvents(store, events, options?)`** — reconstruct UI state from persisted SSE events
- **`registerWidget` / `getWidget` / `stripMcpPrefix`** — widget registry for tool call rendering
- **`findMatchingApproval` / `isApprovalClaimedByToolCall`** — approval-matching utilities
- **`cn(...inputs)`** — `clsx` + `tailwind-merge` class merging utility

## Documentation

- [Client Guide](https://quantumleeps.github.io/neeter/docs/client) — styling, custom events, widgets, tool lifecycle
- [API Reference](https://quantumleeps.github.io/neeter/docs/api-reference) — all exports and types

## License

MIT
