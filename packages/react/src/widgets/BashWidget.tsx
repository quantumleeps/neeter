import { registerWidget } from "../registry.js";
import type { WidgetProps } from "../types.js";

function BashInputRenderer({ input }: { input: Record<string, unknown> }) {
  const command = typeof input.command === "string" ? input.command : null;
  const description = typeof input.description === "string" ? input.description : null;
  if (!command) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {description && <div className="text-xs text-muted-foreground">{description}</div>}
      <pre className="text-[11px] leading-snug text-muted-foreground bg-accent rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
        <code>{command}</code>
      </pre>
    </div>
  );
}

function BashWidget({ result, input, phase }: WidgetProps<string>) {
  const command = typeof input.command === "string" ? input.command : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="py-1 space-y-1 text-xs">
        {command && (
          <pre className="leading-snug text-muted-foreground bg-accent rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
            <code>$ {command}</code>
          </pre>
        )}
        <span className="animate-pulse text-muted-foreground">Running&hellip;</span>
      </div>
    );
  }

  if (typeof result !== "string" || !result) return null;

  return (
    <div className="py-1 text-xs">
      <pre className="leading-snug text-foreground bg-accent rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
        <code>
          {command && (
            <span className="text-muted-foreground">
              $ {command}
              {"\n"}
            </span>
          )}
          {result}
        </code>
      </pre>
    </div>
  );
}

registerWidget<string>({
  toolName: "Bash",
  label: "Bash",
  richLabel: (_r, input) => {
    const desc = typeof input.description === "string" ? input.description : null;
    const cmd = typeof input.command === "string" ? input.command : null;
    if (desc) return desc;
    if (cmd) return cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
    return null;
  },
  inputRenderer: BashInputRenderer,
  component: BashWidget,
});
