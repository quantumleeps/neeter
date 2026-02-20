import { cn } from "./cn.js";

export function ThinkingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-start", className)}>
      <div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
