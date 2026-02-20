import Markdown from "react-markdown";
import { cn } from "./cn.js";
import { markdownComponents } from "./markdown-overrides.js";

export function TextMessage({
  role,
  content,
  className,
}: {
  role: "user" | "assistant";
  content: string;
  className?: string;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start", className)}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm overflow-hidden break-words",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Markdown components={markdownComponents}>{content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
