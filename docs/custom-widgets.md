# Custom Widgets

Register your own components for MCP tools or any tool the agent can call. When a tool completes, `ToolCallCard` looks up the matching widget and renders it instead of the default JSON fallback.

<video src="custom-widget-demo.mp4" autoplay loop muted playsinline></video>

## End-to-end example

A custom widget has three parts: the MCP server tool, the session config that wires it in, and the React component that renders it.

### 1. Define the MCP tool

```typescript
// server/dice-server.ts
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

export function createDiceServer() {
  return createSdkMcpServer({
    name: "dice",
    tools: [
      tool(
        "roll",
        "Roll dice and return the results",
        { sides: z.number(), count: z.number() },
        async ({ sides, count }) => {
          const rolls = Array.from({ length: count }, () =>
            Math.ceil(Math.random() * sides)
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ rolls, total: rolls.reduce((a, b) => a + b, 0) }),
            }],
          };
        }
      ),
    ],
  });
}
```

### 2. Wire it into your session

```typescript
// server/index.ts
import { createDiceServer } from "./dice-server.js";

const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant that can roll dice.",
  mcpServers: { dice: createDiceServer() },
  allowedTools: ["mcp__dice__*"],
}));
```

The MCP server name (`"dice"`) becomes the middle segment of the tool's fully-qualified name: `mcp__dice__roll`.

### 3. Register the widget

```tsx
// client/widgets/DiceWidget.tsx
import { registerWidget, type WidgetProps } from "fireworks-ai/react";

interface DiceResult {
  rolls: number[];
  total: number;
}

function DiceWidget({ result }: WidgetProps<DiceResult>) {
  if (!result) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-mono">[{result.rolls.join(", ")}]</span>
      <span className="text-muted-foreground">= {result.total}</span>
    </div>
  );
}

registerWidget<DiceResult>({
  toolName: "roll",
  label: "Dice",
  richLabel: (r) => `Rolled ${r.total}`,
  component: DiceWidget,
});
```

### 4. Import the widget

```tsx
// client/App.tsx
import "./widgets/DiceWidget.js";
```

Add a side-effect import in your app's entry point. This ensures `registerWidget` runs at module load time, before any tool calls render.

## How it works

**Tool name matching** — `toolName` in your registration matches the *short* name of the tool, not the fully-qualified MCP name. fireworks-ai strips the `mcp__server__` prefix automatically, so `mcp__dice__roll` matches `toolName: "roll"`.

**Result parsing** — MCP tools return results as `content: [{ type: "text", text: "..." }]`. fireworks-ai parses the JSON string for you — your widget receives the parsed object directly as `result`.

**Registration timing** — `registerWidget` must run before React renders any tool calls. Side-effect imports (`import "./widgets/DiceWidget.js"`) at the top of your entry point guarantee this. If you have multiple widgets, barrel-import a `widgets/` directory.

## Rich labels

The `richLabel` function runs when the tool completes and produces a short string for the collapsed card header. Return `null` to fall back to `label`.

```tsx
richLabel: (result, input) => {
  const path = input.file_path as string;
  return path ? path.split("/").pop()! : null;
},
```

Both `result` (parsed from JSON) and `input` (the tool's input object) are available.

## Input preview

Widgets can provide an `inputRenderer` to show what the tool is about to do. This renders in two places:

1. **Approval cards** — when `permissionMode` requires user approval before a tool runs
2. **Queued tool calls** — when multiple same-name tools are waiting in sequence

```tsx
registerWidget({
  toolName: "deploy",
  label: "Deploy",
  inputRenderer: ({ input }) => (
    <div className="mt-1.5 text-xs text-muted-foreground">
      Deploying <span className="font-mono">{input.service as string}</span> to{" "}
      <span className="font-mono">{input.environment as string}</span>
    </div>
  ),
  component: DeployWidget,
});
```

Without an `inputRenderer`, the approval card falls back to a raw JSON dump of the input.

## Phase-aware rendering

`WidgetProps.phase` tells you where the tool call is in its lifecycle:

| Phase | What's available |
|-------|-----------------|
| `pending` | `input: {}` (empty) |
| `streaming_input` | `partialInput` accumulates |
| `running` | `input` is complete |
| `complete` | `result` is JSON-parsed |
| `error` | `error` message |

The `component` only renders for `complete` status by default (via `ToolCallCard`). If you want custom loading states, check `phase`:

```tsx
function MyWidget({ result, phase, input }: WidgetProps<MyResult>) {
  if (phase === "running" || phase === "pending") {
    return <span className="animate-pulse">Processing...</span>;
  }
  // render result
}
```

## API reference

### `WidgetProps<TResult>`

```ts
interface WidgetProps<TResult = unknown> {
  phase: ToolCallPhase;
  toolUseId: string;
  input: Record<string, unknown>;
  partialInput?: string;
  result?: TResult;
  error?: string;
}
```

### `WidgetRegistration<TResult>`

```ts
interface WidgetRegistration<TResult = unknown> {
  toolName: string;
  label: string;
  richLabel?: (result: TResult, input: Record<string, unknown>) => string | null;
  inputRenderer?: ComponentType<{ input: Record<string, unknown> }>;
  component: ComponentType<WidgetProps<TResult>>;
}
```

### `registerWidget(registration)`

Register a widget for a tool name. Later registrations overwrite earlier ones for the same `toolName`.

### `getWidget(toolName)`

Look up a registered widget. Returns `WidgetRegistration | undefined`.

### `stripMcpPrefix(name)`

`"mcp__server__tool"` → `"tool"`. Used internally to normalize tool names before widget lookup.
