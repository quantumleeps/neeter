import type {
  ChatMessage,
  PermissionRequest,
  ToolApprovalRequest,
  ToolCallInfo,
} from "../types.js";

/**
 * Find the pending approval that matches a specific tool call.
 * Matches by toolUseId when available, falls back to toolName.
 * Only considers non-terminal tool calls (not complete/error).
 */
export function findMatchingApproval(
  pendingPermissions: PermissionRequest[],
  toolCall: ToolCallInfo,
): ToolApprovalRequest | undefined {
  if (toolCall.status === "complete" || toolCall.status === "error") return undefined;
  return pendingPermissions.find(
    (p): p is ToolApprovalRequest =>
      p.kind === "tool_approval" &&
      (p.toolUseId ? p.toolUseId === toolCall.id : p.toolName === toolCall.name),
  );
}

/**
 * Check if an approval request is "claimed" by any non-terminal tool call
 * in the message list. Claimed approvals are rendered inline by ToolCallCard
 * and should be skipped by PendingPermissions to avoid duplicate UI.
 */
export function isApprovalClaimedByToolCall(
  request: ToolApprovalRequest,
  messages: ChatMessage[],
): boolean {
  for (const msg of messages) {
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.status === "complete" || tc.status === "error") continue;
        if (request.toolUseId ? tc.id === request.toolUseId : tc.name === request.toolName) {
          return true;
        }
      }
    }
  }
  return false;
}
