import { useCallback, useState } from "react";
import Markdown from "react-markdown";
import { cn } from "./cn.js";
import { ChevronIcon } from "./icons.js";
import { markdownComponents } from "./markdown-overrides.js";
import { PulsingDot } from "./StatusDot.js";

const STORAGE_KEY = "neeter-thinking-open";

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePref(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    /* SSR / restricted env */
  }
}

export function ThinkingBlock({
  thinking,
  streaming = false,
  className,
}: {
  thinking: string;
  streaming?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(readPref);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writePref(next);
      return next;
    });
  }, []);

  return (
    <div className={cn("flex justify-start", className)}>
      <div className="rounded-md border border-border/40 bg-accent/20 overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:bg-accent/30 transition-colors"
        >
          <ChevronIcon open={open} />
          {streaming && !open && <PulsingDot />}
          <span className="truncate min-w-0">Thinking</span>
        </button>
        {open && (
          <div className="px-2.5 pt-1 pb-2">
            <ThinkingContent>{thinking}</ThinkingContent>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingContent({ children }: { children: string }) {
  return (
    <div className="text-xs text-muted-foreground/70 italic [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <Markdown components={markdownComponents}>{children}</Markdown>
    </div>
  );
}
