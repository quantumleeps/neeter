import { type ReactNode, useState } from "react";
import type { ToolCallPhase } from "../types.js";
import { cn } from "./cn.js";
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {status && <StatusDot status={status} />}
        <span className="truncate min-w-0">{label}</span>
      </button>
      {open && <div className="px-2.5 pb-2">{children}</div>}
    </div>
  );
}
