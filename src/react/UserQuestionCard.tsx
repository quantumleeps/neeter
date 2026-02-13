import { useEffect, useRef, useState } from "react";
import type { UserQuestionRequest } from "../types.js";
import { cn } from "./cn.js";

const OTHER_LABEL = "__other__";

export function UserQuestionCard({
  request,
  onSubmit,
  className,
}: {
  request: UserQuestionRequest;
  onSubmit: (answers: Record<string, string>) => void;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const otherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Auto-focus wrapper so number-key shortcuts work immediately
  useEffect(() => {
    wrapperRef.current?.focus();
  }, []);

  const allAnswered = request.questions.every((q) => {
    const val = answers[q.question];
    if (!val) return false;
    if (val === OTHER_LABEL) return !!otherText[q.question]?.trim();
    return true;
  });

  function resolvedAnswers() {
    const resolved: Record<string, string> = {};
    for (const q of request.questions) {
      const val = answers[q.question] ?? "";
      resolved[q.question] = val === OTHER_LABEL ? (otherText[q.question] ?? "") : val;
    }
    return resolved;
  }

  function selectOption(question: string, label: string, multiSelect?: boolean) {
    setAnswers((prev) => {
      if (!multiSelect) return { ...prev, [question]: label };
      const current = prev[question] ?? "";
      const labels = current ? current.split(", ") : [];
      const next = labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label];
      return { ...prev, [question]: next.join(", ") };
    });
    if (label === OTHER_LABEL) {
      setTimeout(() => otherInputRefs.current[question]?.focus(), 0);
    }
  }

  // Keyboard shortcuts: number keys select options, Enter submits
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (request.questions.length !== 1) return;
      const q = request.questions[0];
      if (!q.options?.length) return;

      if (e.key === "Enter" && allAnswered) {
        e.preventDefault();
        onSubmit(resolvedAnswers());
        return;
      }

      const totalOptions = q.options.length + 1; // +1 for "Other"
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= totalOptions) {
        e.preventDefault();
        if (num <= q.options.length) {
          if (!q.multiSelect) {
            // Single-select: submit immediately (matches ApprovalButtons)
            onSubmit({ [q.question]: q.options[num - 1].label });
          } else {
            selectOption(q.question, q.options[num - 1].label, true);
          }
        } else {
          selectOption(q.question, OTHER_LABEL, q.multiSelect);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      className={cn(
        "rounded-md border border-blue-500/40 bg-blue-500/5 px-3 py-2.5 text-xs focus:outline-none",
        className,
      )}
    >
      {request.questions.map((q) => {
        const hasOptions = q.options && q.options.length > 0;
        const isSingleQuestion = request.questions.length === 1;

        return (
          <div key={q.question} className="mb-3 last:mb-0">
            {q.header && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {q.header}
              </span>
            )}
            <p className="mt-0.5 text-foreground">{q.question}</p>

            {hasOptions && (
              <div className="mt-1.5 flex flex-col gap-1">
                {q.options?.map((opt, idx) => {
                  const selected = (answers[q.question] ?? "").split(", ").includes(opt.label);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        if (!q.multiSelect && isSingleQuestion) {
                          onSubmit({ [q.question]: opt.label });
                        } else {
                          selectOption(q.question, opt.label, q.multiSelect);
                        }
                      }}
                      className={cn(
                        "flex items-start gap-2 rounded border px-2 py-1.5 text-left transition-colors",
                        selected
                          ? "border-blue-500 bg-blue-500/15 text-foreground ring-1 ring-blue-500/30"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <span className="mt-px shrink-0">
                        {q.multiSelect ? (selected ? "☑" : "☐") : selected ? "●" : "○"}
                      </span>
                      <span className="flex-1">
                        <span className="font-medium">{opt.label}</span>
                        {opt.description && (
                          <span className="ml-1 opacity-70">&mdash; {opt.description}</span>
                        )}
                      </span>
                      {isSingleQuestion && (
                        <kbd className="ml-auto shrink-0 text-[9px] opacity-40">{idx + 1}</kbd>
                      )}
                    </button>
                  );
                })}

                {/* "Other" option */}
                {(() => {
                  const isOther = answers[q.question] === OTHER_LABEL;
                  const otherIdx = (q.options?.length ?? 0) + 1;
                  return (
                    <div>
                      <button
                        type="button"
                        onClick={() => selectOption(q.question, OTHER_LABEL, q.multiSelect)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left transition-colors",
                          isOther
                            ? "border-blue-500 bg-blue-500/15 text-foreground ring-1 ring-blue-500/30"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <span className="mt-px shrink-0">
                          {q.multiSelect ? (isOther ? "☑" : "☐") : isOther ? "●" : "○"}
                        </span>
                        <span className="font-medium">Other</span>
                        {isSingleQuestion && (
                          <kbd className="ml-auto shrink-0 text-[9px] opacity-40">{otherIdx}</kbd>
                        )}
                      </button>
                      {isOther && (
                        <input
                          ref={(el) => {
                            otherInputRefs.current[q.question] = el;
                          }}
                          type="text"
                          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                          placeholder="Type your answer…"
                          value={otherText[q.question] ?? ""}
                          onChange={(e) =>
                            setOtherText((prev) => ({ ...prev, [q.question]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && otherText[q.question]?.trim()) {
                              e.preventDefault();
                              onSubmit(resolvedAnswers());
                            }
                          }}
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {!hasOptions && (
              <input
                type="text"
                className="mt-1.5 w-full rounded border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                placeholder="Type your answer…"
                value={answers[q.question] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.question]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (answers[q.question] ?? "").trim()) {
                    e.preventDefault();
                    onSubmit(resolvedAnswers());
                  }
                }}
              />
            )}
          </div>
        );
      })}

      <button
        type="button"
        disabled={!allAnswered}
        onClick={() => onSubmit(resolvedAnswers())}
        className={cn(
          "mt-2 rounded bg-primary px-3 py-1 text-primary-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
          allAnswered ? "hover:bg-primary/90" : "opacity-50 cursor-not-allowed",
        )}
      >
        Submit
      </button>
    </div>
  );
}
