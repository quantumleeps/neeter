import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import { cn } from "./cn.js";
import { SendIcon } from "./icons.js";

export function ChatInput({
  onSend,
  placeholder = "Type a message...",
  disabled,
  className,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDisabled = disabled ?? false;

  const MAX_H = 160; // matches max-h-40 (10rem)

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > MAX_H ? "auto" : "hidden";
  }, []);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setText("");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
      }
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={cn("flex items-end gap-2 p-3", className)}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          autoResize();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-h-40 overflow-y-hidden"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || isDisabled}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        <SendIcon />
      </button>
    </div>
  );
}
