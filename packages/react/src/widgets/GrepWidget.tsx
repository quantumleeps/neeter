import { registerWidget } from "../registry.js";
import type { WidgetProps } from "../types.js";

function GrepInputRenderer({ input }: { input: Record<string, unknown> }) {
  const pattern = typeof input.pattern === "string" ? input.pattern : null;
  const path = typeof input.path === "string" ? input.path : null;
  const glob = typeof input.glob === "string" ? input.glob : null;
  const outputMode = typeof input.output_mode === "string" ? input.output_mode : null;
  if (!pattern) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <pre className="text-[11px] leading-snug text-muted-foreground bg-accent rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
        <code>
          /{pattern}/{path ? ` in ${path}` : ""}
          {glob ? ` --glob ${glob}` : ""}
          {outputMode && outputMode !== "files_with_matches" ? ` (${outputMode})` : ""}
        </code>
      </pre>
    </div>
  );
}

function GrepWidget({ result, input, phase }: WidgetProps<string>) {
  const pattern = typeof input.pattern === "string" ? input.pattern : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Searching {pattern ? `/${pattern}/` : ""}&hellip;</span>
      </div>
    );
  }

  if (typeof result !== "string" || !result) return null;

  return (
    <div className="py-1 text-xs">
      <pre className="leading-snug text-foreground bg-accent rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
        <code>{result}</code>
      </pre>
    </div>
  );
}

registerWidget<string>({
  toolName: "Grep",
  label: "Grep",
  richLabel: (_r, input) => {
    const pattern = typeof input.pattern === "string" ? input.pattern : null;
    if (!pattern) return null;
    const type = typeof input.type === "string" ? input.type : null;
    const glob = typeof input.glob === "string" ? input.glob : null;
    const scope = type ? ` in ${type} files` : glob ? ` in ${glob}` : "";
    const pat = pattern.length > 40 ? `${pattern.slice(0, 37)}…` : pattern;
    return `${pat}${scope}`;
  },
  inputRenderer: GrepInputRenderer,
  component: GrepWidget,
});
