import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

/** Show path relative to likely project root, falling back to last 3 segments. */
function shortPath(filePath: string): string {
  const parts = filePath.split("/");
  // Heuristic: strip up to the first segment after common prefixes
  // e.g. /Users/dan/Documents/my-project/src/server/index.ts → src/server/index.ts
  // Look for common root markers and take everything after
  const markers = ["Documents", "Projects", "repos", "src", "home"];
  for (let i = 0; i < parts.length - 1; i++) {
    if (markers.includes(parts[i])) {
      // Take from the segment AFTER the marker's child (the project dir)
      const projectStart = i + 2; // marker + project-name
      if (projectStart < parts.length) {
        return parts.slice(projectStart).join("/");
      }
    }
  }
  // Fallback: last 3 segments
  return parts.slice(-3).join("/");
}

function ReadInputRenderer({ input }: { input: Record<string, unknown> }) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;
  if (!filePath) return null;
  return <div className="mt-1.5 text-xs text-muted-foreground font-mono truncate">{filePath}</div>;
}

function ReadWidget({ result, input, phase }: WidgetProps<string>) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">
          Reading {filePath ? shortPath(filePath) : "file"}&hellip;
        </span>
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
  toolName: "Read",
  label: "Read",
  richLabel: (_r, input) => {
    const filePath = typeof input.file_path === "string" ? input.file_path : null;
    return filePath ? shortPath(filePath) : null;
  },
  inputRenderer: ReadInputRenderer,
  component: ReadWidget,
});
