import { useEffect, useRef } from "react";
import { useChatStore } from "./AgentProvider.js";
import { cn } from "./cn.js";
import { PendingPermissions } from "./PendingPermissions.js";
import { TextMessage } from "./TextMessage.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import { ToolCallCard } from "./ToolCallCard.js";

export function MessageList({ className }: { className?: string }) {
  const messages = useChatStore((s) => s.messages);
  const streamingText = useChatStore((s) => s.streamingText);
  const isThinking = useChatStore((s) => s.isThinking);
  const bottomRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isThinking]);

  return (
    <div className={cn("flex-1 overflow-y-auto", className)}>
      <div className="flex flex-col gap-3 p-4 text-sm">
        {messages.map((msg) => {
          if (msg.toolCalls?.length) {
            return (
              <div key={msg.id} className="flex flex-col gap-1.5">
                {msg.toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} />
                ))}
              </div>
            );
          }
          if (msg.role === "system") {
            return (
              <div key={msg.id} className="text-center text-xs text-destructive">
                {msg.content}
              </div>
            );
          }
          if (msg.content) {
            return (
              <TextMessage
                key={msg.id}
                role={msg.role as "user" | "assistant"}
                content={msg.content}
              />
            );
          }
          return null;
        })}
        {streamingText && <TextMessage role="assistant" content={streamingText} />}
        <PendingPermissions />
        {isThinking && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
