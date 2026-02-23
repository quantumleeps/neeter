# Custom Widgets

> Part of [neeter](../README.md). See [all docs](../README.md#documentation).

Register your own components for MCP tools or any tool the agent can call. When a tool completes, `ToolCallCard` looks up the matching widget and renders it instead of the default JSON fallback.

<!-- TODO: re-record with pokemon example -->
https://github.com/user-attachments/assets/0b0d5a9c-27e2-4e8f-9f4a-e3d60f4a01e2

## End-to-end example

A custom widget has three parts: the MCP server tool, the session config that wires it in, and the React component that renders it. This example builds a Pokémon lookup — see [`examples/basic-chat/`](../examples/basic-chat/) for the full working code.

### 1. Define the MCP tool

```typescript
// server/pokemon-server.ts
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

export function createPokemonServer() {
  return createSdkMcpServer({
    name: "pokemon",
    tools: [
      tool(
        "pokemon_lookup",
        "Look up a Pokémon by name or Pokédex number",
        { query: z.string() },
        async ({ query }) => {
          const res = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(query.toLowerCase())}`,
          );
          const data = await res.json();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                name: data.name,
                id: data.id,
                sprite: data.sprites.front_default,
                types: data.types.map((t: any) => t.type.name),
                stats: data.stats.map((s: any) => ({ name: s.stat.name, value: s.base_stat })),
              }),
            }],
          };
        },
      ),
    ],
  });
}
```

### 2. Wire it into your session

```typescript
// server/index.ts
import { createPokemonServer } from "./pokemon-server.js";

const sessions = new SessionManager(() => ({
  context: {},
  model: "claude-sonnet-4-20250514",
  systemPrompt: "You are a helpful assistant that can look up Pokémon.",
  mcpServers: { pokemon: createPokemonServer() },
  allowedTools: ["mcp__pokemon__*"],
}));
```

The MCP server name (`"pokemon"`) becomes the middle segment of the tool's fully-qualified name: `mcp__pokemon__pokemon_lookup`.

### 3. Register the widget

```tsx
// client/widgets/PokemonLookupWidget.tsx
import { registerWidget, type WidgetProps } from "@neeter/react";

interface PokemonResult {
  name: string;
  id: number;
  sprite: string;
  types: string[];
  stats: { name: string; value: number }[];
}

function PokemonLookupWidget({ result, phase }: WidgetProps<PokemonResult>) {
  if (phase === "running" || phase === "pending") {
    return <span className="animate-pulse text-xs">Looking up Pokémon…</span>;
  }
  if (!result) return null;
  return (
    <div className="flex gap-3 py-2 text-sm">
      <img src={result.sprite} alt={result.name} width={64} height={64} />
      <div>
        <span className="font-semibold capitalize">{result.name}</span>
        <span className="text-muted-foreground ml-1">#{result.id}</span>
        <div className="text-xs text-muted-foreground">{result.types.join(" · ")}</div>
      </div>
    </div>
  );
}

registerWidget<PokemonResult>({
  toolName: "pokemon_lookup",
  label: "Pokémon",
  richLabel: (r) => `${r.name.charAt(0).toUpperCase() + r.name.slice(1)} #${r.id}`,
  component: PokemonLookupWidget,
});
```

The full widget in [`examples/basic-chat/`](../examples/basic-chat/) adds stat bars, type-colored badges, official artwork, abilities, and an `inputRenderer` for approval previews.

### 4. Import the widget

```tsx
// client/main.tsx
import "./widgets/PokemonLookupWidget.js";
```

Add a side-effect import in your app's entry point. This ensures `registerWidget` runs at module load time, before any tool calls render.

## How it works

**Tool name matching** — `toolName` in your registration matches the *short* name of the tool, not the fully-qualified MCP name. neeter strips the `mcp__server__` prefix automatically, so `mcp__pokemon__pokemon_lookup` matches `toolName: "pokemon_lookup"`.

**Result parsing** — MCP tools return results as `content: [{ type: "text", text: "..." }]`. neeter parses the JSON string for you — your widget receives the parsed object directly as `result`.

**Registration timing** — `registerWidget` must run before React renders any tool calls. Side-effect imports (`import "./widgets/PokemonLookupWidget.js"`) at the top of your entry point guarantee this. If you have multiple widgets, barrel-import a `widgets/` directory.

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

## Scaffolding with Claude Code

neeter ships an `add-widget` [Claude Code skill](https://code.claude.com/docs/en/skills) in `.claude/skills/`. Invoke it to scaffold the full stack — MCP server, session wiring, and widget — in one shot:

```
/add-widget pokemon_lookup
```

The skill detects whether the tool name matches a built-in (replacement mode) or is custom (creation mode), then walks through each step. The Pokémon example in these docs was built this way.

---

See also: [Built-in Widgets](built-in-widgets.md) | [Client Guide](client.md) | [API Reference](api-reference.md)
