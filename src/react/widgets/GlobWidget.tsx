import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

function GlobInputRenderer({ input }: { input: Record<string, unknown> }) {
  const pattern = typeof input.pattern === "string" ? input.pattern : null;
  const path = typeof input.path === "string" ? input.path : null;
  if (!pattern) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <pre className="text-[11px] leading-snug text-muted-foreground bg-accent rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
        <code>
          {pattern}
          {path ? ` in ${path}` : ""}
        </code>
      </pre>
    </div>
  );
}

function GlobWidget({ result, input, phase }: WidgetProps<string>) {
  const pattern = typeof input.pattern === "string" ? input.pattern : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Matching {pattern ? pattern : "files"}&hellip;</span>
      </div>
    );
  }

  if (typeof result !== "string" || !result) return null;

  const lines = result.split("\n").filter(Boolean);

  return (
    <div className="py-1 text-xs">
      <div className="text-muted-foreground mb-1">
        {lines.length} {lines.length === 1 ? "match" : "matches"}
      </div>
      <pre className="leading-snug text-foreground bg-accent rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
        <code>{lines.join("\n")}</code>
      </pre>
    </div>
  );
}

registerWidget<string>({
  toolName: "Glob",
  label: "Glob",
  richLabel: (_r, input) => {
    const pattern = typeof input.pattern === "string" ? input.pattern : null;
    if (pattern) return pattern.length > 50 ? `${pattern.slice(0, 47)}...` : pattern;
    return null;
  },
  inputRenderer: GlobInputRenderer,
  component: GlobWidget,
});
