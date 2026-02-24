import type { RewindFilesResult } from "@neeter/types";
import { useEffect, useRef, useState } from "react";
import { useAgentContext, useChatStore } from "./AgentProvider.js";

export function RollbackButton({
  checkpointId,
  isFirstCheckpoint,
  onFilesRewound,
}: {
  checkpointId: string;
  isFirstCheckpoint: boolean;
  onFilesRewound?: (result: RewindFilesResult) => void;
}) {
  const { resumeSession, rewindSession, newSession } = useAgentContext();
  const isStreaming = useChatStore((s) => s.isStreaming);
  const fileCheckpointing = useChatStore((s) => s.fileCheckpointing);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const withClose = (fn: () => Promise<void>) => async () => {
    setOpen(false);
    await fn();
  };

  const handleRewind = withClose(async () => {
    if (isFirstCheckpoint) {
      if (fileCheckpointing) await rewindSession(checkpointId);
      await newSession();
    } else {
      await resumeSession({ resumeSessionAt: checkpointId });
    }
  });

  const handleFilesOnly = withClose(async () => {
    const result: RewindFilesResult = await rewindSession(checkpointId);
    if (result.canRewind) {
      onFilesRewound?.(result);
      const n = result.filesChanged?.length ?? 0;
      setFeedback(`${n} file${n !== 1 ? "s" : ""} restored`);
      setTimeout(() => setFeedback(null), 2500);
    } else {
      setFeedback(result.error ?? "Cannot rewind");
      setTimeout(() => setFeedback(null), 2500);
    }
  });

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 -mt-1 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
        {feedback && (
          <span className="whitespace-nowrap text-[10px] text-emerald-600 dark:text-emerald-400 animate-pulse">
            {feedback}
          </span>
        )}
        <button
          type="button"
          disabled={isStreaming}
          onClick={() => setOpen((v) => !v)}
          className="rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-30 transition-colors"
          title="Rollback to just prior to this message"
        >
          <svg
            aria-hidden="true"
            className="size-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-7 z-20 flex flex-col rounded-md border bg-popover p-1 shadow-md min-w-[200px]">
          <button
            type="button"
            onClick={handleRewind}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-popover-foreground hover:bg-muted text-left"
          >
            <svg
              aria-hidden="true"
              className="size-3 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            {fileCheckpointing ? "Rewind conversation and files" : "Rewind conversation"}
          </button>
          {fileCheckpointing && (
            <button
              type="button"
              onClick={handleFilesOnly}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-popover-foreground hover:bg-muted text-left"
            >
              <svg
                aria-hidden="true"
                className="size-3 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
              Rewind files only
            </button>
          )}
        </div>
      )}
    </div>
  );
}
