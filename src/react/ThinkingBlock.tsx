import { useCallback, useState } from "react";
import Markdown from "react-markdown";
import { cn } from "./cn.js";

const STORAGE_KEY = "fireworks-thinking-open";

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
          {streaming && !open && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-500 animate-pulse" />
          )}
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
      <Markdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
