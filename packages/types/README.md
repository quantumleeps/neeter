# @neeter/types

Shared TypeScript types for the [neeter](https://github.com/quantumleeps/neeter) toolkit.

## Install

```bash
pnpm add @neeter/types
```

> Most users don't need this package directly — all types are re-exported from `@neeter/server` and `@neeter/react`.

## What's inside

- **SSE protocol** — `SSEEvent`, `CustomEvent<T>`
- **Chat messages** — `ChatMessage`, `ToolCallInfo`, `ToolCallPhase`
- **Permissions** — `PermissionRequest`, `PermissionResponse`, `ToolApprovalRequest`, `ToolApprovalResponse`, `UserQuestion`, `UserQuestionRequest`, `UserQuestionResponse`

## Documentation

See the [neeter README](https://github.com/quantumleeps/neeter#readme) for full API reference and usage guides.

## License

MIT
