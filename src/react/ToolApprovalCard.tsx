import type { ToolApprovalRequest } from "../types.js";
import { ApprovalButtons } from "./ApprovalButtons.js";
import { cn } from "./cn.js";
import { getWidget, stripMcpPrefix } from "./registry.js";
import { PulsingDot } from "./StatusDot.js";

export function ToolApprovalCard({
  request,
  onApprove,
  onDeny,
  className,
}: {
  request: ToolApprovalRequest;
  onApprove: () => void;
  onDeny: (message?: string) => void;
  className?: string;
}) {
  const reg = getWidget(stripMcpPrefix(request.toolName));
  const label = reg?.label ?? request.toolName;
  const InputRenderer = reg?.inputRenderer;

  return (
    <div
      className={cn(
        "rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <PulsingDot />
        <span className="font-medium">{label}</span>
        {request.description && (
          <span className="ml-1 opacity-70">&mdash; {request.description}</span>
        )}
      </div>

      {InputRenderer ? (
        <InputRenderer input={request.input} />
      ) : (
        Object.keys(request.input).length > 0 && (
          <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(request.input, null, 2)}
          </pre>
        )
      )}

      <ApprovalButtons onApprove={onApprove} onDeny={() => onDeny()} />
    </div>
  );
}
