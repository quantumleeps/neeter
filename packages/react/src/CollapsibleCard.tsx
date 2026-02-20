import type { ToolCallPhase } from "@neeter/types";
import { type ReactNode, useState } from "react";
import { cn } from "./cn.js";
import { ChevronIcon } from "./icons.js";
import { StatusDot } from "./StatusDot.js";

export function CollapsibleCard({
  label,
  status,
  defaultOpen = true,
  children,
  className,
}: {
  label: string;
  status?: ToolCallPhase;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("rounded-md border border-border bg-accent/50 overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
      >
        <ChevronIcon open={open} />
        {status && <StatusDot status={status} />}
        <span className="truncate min-w-0">{label}</span>
      </button>
      {open && <div className="px-2.5 pb-2">{children}</div>}
    </div>
  );
}
