import type { ToolCallInfo, WidgetProps } from "../types.js";
import { useAgentContext, useChatStore } from "./AgentProvider.js";
import { ApprovalButtons } from "./ApprovalButtons.js";
import { findMatchingApproval } from "./approval-matching.js";
import { CollapsibleCard } from "./CollapsibleCard.js";
import { cn } from "./cn.js";
import { getWidget, stripMcpPrefix } from "./registry.js";
import { PulsingDot, StatusDot } from "./StatusDot.js";

export function ToolCallCard({
  toolCall,
  className,
}: {
  toolCall: ToolCallInfo;
  className?: string;
}) {
  const short = stripMcpPrefix(toolCall.name);
  const reg = getWidget(short);
  const label = reg?.label ?? short;

  const pendingPermissions = useChatStore((s) => s.pendingPermissions);
  const { respondToPermission, store } = useAgentContext();
  const matchingApproval = findMatchingApproval(pendingPermissions, toolCall);

  if (toolCall.status === "complete" && toolCall.result && reg) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(toolCall.result);
    } catch {
      parsed = toolCall.result;
    }

    const displayLabel = reg.richLabel
      ? (reg.richLabel(parsed as never, toolCall.input) ?? label)
      : label;

    const widgetProps: WidgetProps = {
      phase: toolCall.status,
      toolUseId: toolCall.id,
      input: toolCall.input,
      partialInput: toolCall.partialInput,
      result: parsed,
      error: toolCall.error,
    };

    return (
      <CollapsibleCard label={displayLabel} status={toolCall.status} className={className}>
        <reg.component {...widgetProps} />
      </CollapsibleCard>
    );
  }

  if (toolCall.status === "error") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <StatusDot status={toolCall.status} />
        <span>{label}</span>
        {toolCall.error && <span className="ml-auto text-destructive">{toolCall.error}</span>}
      </div>
    );
  }

  if (matchingApproval) {
    const InputRenderer = reg?.inputRenderer;
    return (
      <div
        className={cn(
          "rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <PulsingDot />
          <span className="font-medium">{label}</span>
          {matchingApproval.description && (
            <span className="ml-1 opacity-70">&mdash; {matchingApproval.description}</span>
          )}
        </div>

        {InputRenderer ? (
          <InputRenderer input={matchingApproval.input} />
        ) : (
          Object.keys(matchingApproval.input).length > 0 && (
            <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {JSON.stringify(matchingApproval.input, null, 2)}
            </pre>
          )
        )}

        <ApprovalButtons
          onApprove={() =>
            respondToPermission({
              kind: "tool_approval",
              requestId: matchingApproval.requestId,
              behavior: "allow",
            })
          }
          onDeny={() => {
            store.getState().errorToolCall(toolCall.id, "Not approved");
            respondToPermission({
              kind: "tool_approval",
              requestId: matchingApproval.requestId,
              behavior: "deny",
              message: "Denied by user",
            });
          }}
        />
      </div>
    );
  }

  const FallbackInputRenderer = reg?.inputRenderer;
  const hasInput = Object.keys(toolCall.input).length > 0;

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-accent/50 px-2.5 py-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <StatusDot status={toolCall.status} />
        <span>{label}</span>
        {toolCall.status === "streaming_input" && toolCall.partialInput && (
          <span className="ml-auto truncate max-w-[200px] opacity-50 font-mono text-[10px]">
            {toolCall.partialInput.slice(0, 80)}
          </span>
        )}
      </div>
      {hasInput && FallbackInputRenderer && <FallbackInputRenderer input={toolCall.input} />}
    </div>
  );
}
