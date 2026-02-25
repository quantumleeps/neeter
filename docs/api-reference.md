# API Reference

> Part of [neeter](../README.md). See [all docs](../README.md#documentation).

For usage examples, see the [Server Guide](server.md) and [Client Guide](client.md).

## `@neeter/server`

| Export | Description |
|--------|-------------|
| `SessionManager<TCtx>` | Manages agent sessions — create, resume, list history, optional persistence |
| `SessionManagerOptions` | Constructor options — `idleTimeoutMs`, `store` |
| `Session<TCtx>` | A single session — `id`, `sdkSessionId`, `context`, `pushMessage()`, `permissionGate`, `abort()` |
| `SessionInit<TCtx>` | Factory return type — `model`, `systemPrompt`, `permissionMode`, `mcpServers`, `extraArgs`, `env`, etc. |
| `ResumeOptions` | Options for `SessionManager.resume()` — `sdkSessionId`, `forkSession`, `resumeSessionAt` |
| `sessionMeta(session)` | Extract a `SessionHistoryEntry` from a `Session` |
| `createJsonSessionStore(dataDir)` | File-based `SessionStore` using append-only JSONL + JSON metadata |
| `MessageTranslator<TCtx>` | Converts SDK messages to SSE events |
| `TranslatorConfig<TCtx>` | Translator options — `onToolResult` hook |
| `createAgentRouter<TCtx>(config)` | Returns a Hono app with session, SSE, resume, and permission routes |
| `PermissionGate` | Per-session deferred-promise map for tool approval and user questions |
| `PushChannel<T>` | Async iterable queue for feeding messages to the SDK |
| `sseEncode(event)` | Formats an `SSEEvent` as an SSE string |
| `createSandboxHook(dir, resolve)` | PreToolUse hook that blocks file operations outside a sandbox directory |
| `streamSession(session, translator, onEvent?)` | Async generator yielding `SSEEvent`s, with optional persistence callback |

## `@neeter/react`

| Export | Description |
|--------|-------------|
| `AgentProvider` | Context provider — wraps store + SSE connection. Props: `endpoint`, `resumeSessionId`, `onCustomEvent` |
| `useAgentContext()` | Returns `{ sessionId, sdkSessionId, sessionHistory, sendMessage, stopSession, respondToPermission, resumeSession, newSession, refreshHistory }` |
| `useChatStore(selector)` | Zustand selector hook into chat state |
| `createChatStore()` | Creates a vanilla Zustand store (for advanced use) |
| `useAgent(store, config?)` | SSE connection hook (used internally by `AgentProvider`). Config: `endpoint`, `resumeSessionId`, `onCustomEvent` |
| `replayEvents(store, events, options?)` | Reconstruct chat store state from persisted `SSEEvent[]`. Pass `stopAtCheckpoint` to truncate at a checkpoint |
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

## Types

Re-exported from both `@neeter/server` and `@neeter/react`:

| Type | Description |
|------|-------------|
| `SSEEvent` | `{ event: string, data: string }` |
| `ChatMessage` | `{ id, role, content, thinking?, toolCalls? }` |
| `ToolCallInfo` | `{ id, name, input, partialInput?, result?, error?, status }` |
| `ToolCallPhase` | `"pending" \| "streaming_input" \| "running" \| "complete" \| "error"` |
| `WidgetProps<TResult>` | Props passed to widget components |
| `WidgetRegistration<TResult>` | Widget registration — `toolName`, `label`, `richLabel?`, `inputRenderer?`, `component` |
| `ChatStore` | `StoreApi<ChatStoreShape>` — vanilla Zustand store |
| `ChatStoreShape` | Full state + actions interface (includes `totalCost`, `totalTurns`, `totalInputTokens`, `totalOutputTokens`, `modelUsage`, `lastStopReason`) |
| `CustomEvent<T>` | `{ name: string, value: T }` — structured app-level event |
| `SessionInitEvent` | `{ sdkSessionId, model, tools }` — session initialization payload |
| `SessionHistoryEntry` | `{ sdkSessionId, description, createdAt, lastActivityAt }` — session metadata |
| `SessionRecord` | `{ meta: SessionHistoryEntry, events: SSEEvent[] }` — persistable session data |
| `SessionStore` | Pluggable persistence backend — `save`, `load`, `list`, `delete` |
| `PermissionRequest` | `ToolApprovalRequest \| UserQuestionRequest` — pending permission |
| `PermissionResponse` | `ToolApprovalResponse \| UserQuestionResponse` — user's answer |
| `ToolApprovalRequest` | `{ kind, requestId, toolName, toolUseId?, input, description? }` |
| `ToolApprovalResponse` | `{ kind, requestId, behavior: "allow" \| "deny", message? }` |
| `UserQuestion` | `{ question, header?, options?, multiSelect? }` |
| `UserQuestionOption` | `{ label, description, markdown? }` — single option in a `UserQuestion` |
| `UserQuestionRequest` | `{ kind, requestId, questions: UserQuestion[] }` |
| `UserQuestionResponse` | `{ kind, requestId, answers: Record<string, string> }` |
| `TokenUsage` | `{ inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens }` |
| `ModelUsage` | `TokenUsage` + `{ webSearchRequests, costUSD, contextWindow }` — per-model breakdown |
| `StopReason` | `"end_turn" \| "max_tokens" \| "stop_sequence" \| "refusal" \| "tool_use" \| null` |
| `TurnCompleteData` | `{ numTurns, cost, stopReason: StopReason, usage: TokenUsage \| null, modelUsage: Record<string, ModelUsage> \| null }` |

---

See also: [Server Guide](server.md) | [Client Guide](client.md)
