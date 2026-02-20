import { useAgentContext, useChatStore } from "./AgentProvider.js";
import { isApprovalClaimedByToolCall } from "./approval-matching.js";
import { cn } from "./cn.js";
import { ToolApprovalCard } from "./ToolApprovalCard.js";
import { UserQuestionCard } from "./UserQuestionCard.js";

export function PendingPermissions({ className }: { className?: string }) {
  const pending = useChatStore((s) => s.pendingPermissions);
  const messages = useChatStore((s) => s.messages);
  const { respondToPermission } = useAgentContext();

  // Tool approvals that match a non-terminal tool call are rendered inline
  // by ToolCallCard — skip them here to avoid duplicate UI.
  const unclaimed = pending.filter(
    (request) =>
      request.kind !== "tool_approval" || !isApprovalClaimedByToolCall(request, messages),
  );

  if (!unclaimed.length) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {unclaimed.map((request) => {
        if (request.kind === "tool_approval") {
          return (
            <ToolApprovalCard
              key={request.requestId}
              request={request}
              onApprove={() =>
                respondToPermission({
                  kind: "tool_approval",
                  requestId: request.requestId,
                  behavior: "allow",
                })
              }
              onDeny={(message) =>
                respondToPermission({
                  kind: "tool_approval",
                  requestId: request.requestId,
                  behavior: "deny",
                  message: message ?? "Denied by user",
                })
              }
            />
          );
        }
        return (
          <UserQuestionCard
            key={request.requestId}
            request={request}
            onSubmit={(answers) =>
              respondToPermission({
                kind: "user_question",
                requestId: request.requestId,
                answers,
              })
            }
          />
        );
      })}
    </div>
  );
}
