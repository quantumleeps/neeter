import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

function basename(filePath: string) {
  return filePath.split("/").pop() ?? filePath;
}

function WriteInputRenderer({ input }: { input: Record<string, unknown> }) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;
  if (!filePath) return null;
  return (
    <div className="mt-1.5 text-xs text-muted-foreground font-mono truncate">{filePath}</div>
  );
}

function WriteWidget({ result, input, phase }: WidgetProps<string>) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Writing {filePath ? basename(filePath) : "file"}&hellip;</span>
      </div>
    );
  }

  if (typeof result !== "string" || !result) return null;

  return (
    <div className="py-1 text-xs text-muted-foreground">{result}</div>
  );
}

registerWidget<string>({
  toolName: "Write",
  label: "Write",
  richLabel: (_r, input) => {
    const filePath = typeof input.file_path === "string" ? input.file_path : null;
    return filePath ? basename(filePath) : null;
  },
  inputRenderer: WriteInputRenderer,
  component: WriteWidget,
});
