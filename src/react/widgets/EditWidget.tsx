import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

function basename(filePath: string) {
  return filePath.split("/").pop() ?? filePath;
}

function EditInputRenderer({ input }: { input: Record<string, unknown> }) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;
  const oldStr = typeof input.old_string === "string" ? input.old_string : null;
  const newStr = typeof input.new_string === "string" ? input.new_string : null;
  if (!filePath || oldStr == null || newStr == null) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="text-xs text-muted-foreground font-mono truncate">{filePath}</div>
      <div className="text-[11px] leading-snug rounded overflow-hidden border border-border">
        {oldStr && (
          <pre className="bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
            <code>{oldStr.split("\n").map((line, i) => <span key={i}>{i > 0 && "\n"}- {line}</span>)}</code>
          </pre>
        )}
        {newStr && (
          <pre className="bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
            <code>{newStr.split("\n").map((line, i) => <span key={i}>{i > 0 && "\n"}+ {line}</span>)}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

function EditWidget({ result, input, phase }: WidgetProps<string>) {
  const filePath = typeof input.file_path === "string" ? input.file_path : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Editing {filePath ? basename(filePath) : "file"}&hellip;</span>
      </div>
    );
  }

  if (typeof result !== "string" || !result) return null;

  return (
    <div className="py-1 text-xs text-muted-foreground">{result}</div>
  );
}

registerWidget<string>({
  toolName: "Edit",
  label: "Edit",
  richLabel: (_r, input) => {
    const filePath = typeof input.file_path === "string" ? input.file_path : null;
    return filePath ? basename(filePath) : null;
  },
  inputRenderer: EditInputRenderer,
  component: EditWidget,
});
