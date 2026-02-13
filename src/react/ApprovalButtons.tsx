import { useEffect, useRef } from "react";
import { cn } from "./cn.js";

export function ApprovalButtons({
  onApprove,
  onDeny,
  className,
}: {
  onApprove: () => void;
  onDeny: () => void;
  className?: string;
}) {
  const allowRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the Allow button when mounted
  useEffect(() => {
    allowRef.current?.focus();
  }, []);

  // Keyboard shortcuts: 1 = Allow, 2 = Deny (skip when typing in inputs)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        onApprove();
      } else if (e.key === "2") {
        e.preventDefault();
        onDeny();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onApprove, onDeny]);

  return (
    <div className={cn("mt-2 flex items-center gap-2", className)}>
      <button
        ref={allowRef}
        type="button"
        onClick={onApprove}
        className="rounded bg-primary px-3 py-1 text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        Allow
        <kbd className="ml-1.5 text-[9px] opacity-60">1</kbd>
      </button>
      <button
        type="button"
        onClick={onDeny}
        className="rounded border border-border px-3 py-1 text-muted-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-border"
      >
        Deny
        <kbd className="ml-1.5 text-[9px] opacity-60">2</kbd>
      </button>
    </div>
  );
}
