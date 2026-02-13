import type { ToolCallPhase } from "../types.js";
import { cn } from "./cn.js";

const phaseClasses: Record<ToolCallPhase, string> = {
  pending: "bg-muted-foreground/40",
  streaming_input: "bg-warning animate-pulse",
  running: "bg-warning animate-pulse",
  complete: "bg-success",
  error: "bg-destructive",
};

export function StatusDot({ status, className }: { status: ToolCallPhase; className?: string }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", phaseClasses[status], className)} />;
}

export function PulsingDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full bg-warning animate-pulse",
        className,
      )}
    />
  );
}
