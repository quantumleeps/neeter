import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

function basename(filePath: string) {
  return filePath.split("/").pop() ?? filePath;
}

function WriteInputRenderer({ input }: { input: Record<string, unknown> }) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;
  const content = typeof input.content === "string" ? input.content : null;
  if (!filePath) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="text-xs text-muted-foreground font-mono truncate">{filePath}</div>
      {content && (
        <pre className="text-[11px] leading-snug text-muted-foreground bg-accent rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
}

function WriteWidget({ input, phase }: WidgetProps<string>) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Writing {filePath ? basename(filePath) : "file"}&hellip;</span>
      </div>
    );
  }

  const content = typeof input.content === "string" ? input.content : null;

  return (
    <div className="py-1 space-y-1.5">
      {content && (
        <pre className="text-[11px] leading-snug text-foreground bg-accent rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
          <code>{content}</code>
        </pre>
      )}
    </div>
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
