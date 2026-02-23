---
name: add-widget
description: Create a neeter widget — custom for an MCP tool or a replacement for a built-in SDK widget.
---

# Add Widget

Create a purpose-built React component for a tool call. Replaces the default raw-JSON fallback in `ToolCallCard` with a widget that shows structured, phase-aware output.

Two modes:
- **Custom widget** — for an MCP tool the user has built
- **Built-in replacement** — override one of the SDK tool widgets shipped by `@neeter/react`

## Mode detection

If the user passed a tool name as an argument, check it against the 11 built-in tool names:

> Bash, Edit, Read, Write, Glob, Grep, WebFetch, WebSearch, AskUserQuestion, TodoWrite, NotebookEdit

Match → **replacement mode**. No match → **custom widget mode**. If no argument was provided, ask the user which tool the widget is for.

---

## Custom widget

### 1. Find or create the MCP tool

Search the project for existing server code that defines the tool (grep for the tool name, `createSdkMcpServer`, or `tool(`).

**If the tool already exists:** read the handler to determine:
- MCP server name and tool name
- Fully-qualified name (`mcp__{server}__{tool}`)
- Short name after `stripMcpPrefix` (this is what `toolName` must match)
- Input parameters (zod schema)
- Return shape (the JSON stringified in `content[0].text`)

**If the tool doesn't exist:** create it using the Claude Agent SDK's in-process MCP server pattern:

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

export function create{Server}Server() {
  return createSdkMcpServer({
    name: "{server}",
    tools: [
      tool(
        "{tool_name}",
        "{description}",
        { /* zod schema for input */ },
        async (input) => {
          // tool logic here
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ /* result shape */ }),
            }],
          };
        }
      ),
    ],
  });
}
```

Then wire it into the session config:

```typescript
mcpServers: { {server}: create{Server}Server() },
allowedTools: ["mcp__{server}__*"],
```

Reference: [Claude Agent SDK MCP guide](https://platform.claude.com/docs/en/agent-sdk/mcp) (SDK MCP servers section) for the canonical pattern.

### 2. Define the result type

Create a TypeScript interface for the parsed result. neeter JSON-parses MCP `text` content automatically — the widget receives the parsed object.

### 3. Create the widget file

Create `{widgetDir}/{Name}Widget.tsx` **with debug logging**:

```tsx
console.log("[{Name}Widget debug]", { phase, result, input, resultType: typeof result });
```

Follow the established pattern:
- `inputRenderer` — render the tool's key input fields for approval previews
- `richLabel(result, input)` — short string for the collapsed `CollapsibleCard` header
- Phase-aware `component` — loading state for `pending`/`running`, full render for `complete`
- `registerWidget<ResultType>({...})` at module bottom
- Use `react-markdown` + `markdownComponents` from `../markdown-overrides.js` if the result contains markdown

### 4. Add side-effect import

In the app's entry point:

```tsx
import "./widgets/{Name}Widget.js";
```

### 5. Build

Run the project's build command to verify compilation.

### 6. Test with real data

Ask the user to trigger the tool and paste the debug log output from the browser console. Fix the parser to match the real data shape.

### 7. Clean up

- Remove the `console.log` from step 3
- Build again
- Grep the widget file for `console.log` — there should be none

### 8. Commit

`feat(react): add {Name} widget` — body explains *why* (what was wrong with the default rendering), not *what*.

---

## Built-in replacement

### 1. Read the existing widget

Open `packages/react/src/widgets/{Name}Widget.tsx` to understand what it currently renders — its result parsing, `inputRenderer`, `richLabel`, and phase handling.

### 2. Discuss the override

Ask the user what should change: different layout, extra data, different styling, merged info, etc.

### 3. Create the override widget

Create the widget in the **user's project** (not in the neeter packages). Use the same `toolName` as the built-in — later registrations overwrite earlier ones.

Add debug logging as in the custom widget flow.

### 4. Import after neeter

The user's side-effect import must run **after** `@neeter/react`'s built-in imports so the override takes precedence:

```tsx
// Built-ins register when @neeter/react is imported
import "@neeter/react";
// Override registers after
import "./widgets/MyCustomBashWidget.js";
```

### 5. Test, clean, commit

Same as custom widget steps 5–8.

---

## Reference files

### neeter source (monorepo)
- `packages/react/src/widgets/WebSearchWidget.tsx` — parsing, favicon pills, expand/collapse
- `packages/react/src/widgets/WebFetchWidget.tsx` — plain-string result, markdown, input-based richLabel
- `packages/react/src/registry.ts` — `registerWidget()`, `getWidget()`, `stripMcpPrefix()`
- `packages/react/src/types.ts` — `WidgetProps<TResult>`, `WidgetRegistration`
- `packages/react/src/CollapsibleCard.tsx` — wrapper used by `ToolCallCard`
- `packages/react/src/markdown-overrides.tsx` — shared `markdownComponents`

### Claude Agent SDK
- [MCP guide](https://platform.claude.com/docs/en/agent-sdk/mcp) — `createSdkMcpServer`, `tool()`, zod schemas, session wiring
- [Skills guide](https://platform.claude.com/docs/en/agent-sdk/skills) — SKILL.md structure, `settingSources`, discovery

### neeter documentation
- `docs/custom-widgets.md` — end-to-end tutorial, API reference
- `docs/built-in-widgets.md` — all built-in widgets, override pattern, widget anatomy

## When something goes wrong

If the skill's instructions led you astray — the docs described a wrong pattern, the result shape guidance was incorrect, a step was missing, or the logic was faulty — **file an issue on neeter's GitHub** after resolving the problem:

```
gh issue create --repo quantumleeps/neeter \
  --title "add-widget skill: {brief description}" \
  --label "skill-feedback" \
  --body "## What happened
{What went wrong and how it was resolved}

## Suggestion
{Whether the skill steps, the docs, or both need updating}"
```

This ensures fixes flow back upstream so the next person doesn't hit the same problem.

## Rules

- One widget per invocation. Don't batch.
- Debug-first. Never trust docs or server code for the result shape — always verify with real data from the browser console.
- Reuse existing patterns. Don't invent new component structures.
- Commit message body is the *why*, not the *what*. See `.claude/CLAUDE.md`.
