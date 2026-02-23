# @neeter/types

Shared TypeScript types for the [neeter](https://github.com/quantumleeps/neeter) toolkit.

## Install

```bash
pnpm add @neeter/types
```

> Most users don't need this package directly — all types are re-exported from `@neeter/server` and `@neeter/react`.

## What's inside

- **SSE protocol** — `SSEEvent`, `CustomEvent<T>`, `SessionInitEvent`
- **Chat messages** — `ChatMessage`, `ToolCallInfo`, `ToolCallPhase`
- **Permissions** — `PermissionRequest`, `PermissionResponse`, `ToolApprovalRequest`, `ToolApprovalResponse`, `UserQuestion`, `UserQuestionRequest`, `UserQuestionResponse`
- **Persistence** — `SessionStore`, `SessionRecord`, `SessionHistoryEntry`

## Documentation

See the [API Reference](https://github.com/quantumleeps/neeter/blob/main/docs/api-reference.md) for all type definitions and the [neeter README](https://github.com/quantumleeps/neeter#readme) for usage guides.

## License

MIT
