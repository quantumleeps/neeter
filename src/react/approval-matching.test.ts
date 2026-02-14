import { describe, expect, it } from "vitest";
import type {
  ChatMessage,
  PermissionRequest,
  ToolApprovalRequest,
  ToolCallInfo,
} from "../types.js";
import { findMatchingApproval, isApprovalClaimedByToolCall } from "./approval-matching.js";

function approval(
  overrides: Partial<ToolApprovalRequest> & { requestId: string; toolName: string },
): ToolApprovalRequest {
  return { kind: "tool_approval", input: {}, ...overrides };
}

function toolCall(overrides: Partial<ToolCallInfo> & { id: string; name: string }): ToolCallInfo {
  return { input: {}, status: "running", ...overrides };
}

function msg(toolCalls: ToolCallInfo[]): ChatMessage {
  return { id: "msg-1", role: "assistant", content: "", toolCalls };
}

describe("findMatchingApproval", () => {
  it("matches 3 distinct approvals to 3 distinct tool calls by toolUseId", () => {
    const approvals: PermissionRequest[] = [
      approval({ requestId: "r1", toolName: "NotebookEdit", toolUseId: "tu-1" }),
      approval({ requestId: "r2", toolName: "NotebookEdit", toolUseId: "tu-2" }),
      approval({ requestId: "r3", toolName: "NotebookEdit", toolUseId: "tu-3" }),
    ];
    const tc1 = toolCall({ id: "tu-1", name: "NotebookEdit" });
    const tc2 = toolCall({ id: "tu-2", name: "NotebookEdit" });
    const tc3 = toolCall({ id: "tu-3", name: "NotebookEdit" });

    expect(findMatchingApproval(approvals, tc1)?.requestId).toBe("r1");
    expect(findMatchingApproval(approvals, tc2)?.requestId).toBe("r2");
    expect(findMatchingApproval(approvals, tc3)?.requestId).toBe("r3");
  });

  it("reproduces old bug: without toolUseId all tool calls match the same first approval", () => {
    const approvals: PermissionRequest[] = [
      approval({ requestId: "r1", toolName: "NotebookEdit" }),
      approval({ requestId: "r2", toolName: "NotebookEdit" }),
      approval({ requestId: "r3", toolName: "NotebookEdit" }),
    ];
    const tc1 = toolCall({ id: "tu-1", name: "NotebookEdit" });
    const tc2 = toolCall({ id: "tu-2", name: "NotebookEdit" });
    const tc3 = toolCall({ id: "tu-3", name: "NotebookEdit" });

    // All three resolve to the same first approval — this is the old bug behavior
    // documented here as a regression guardrail
    const match1 = findMatchingApproval(approvals, tc1);
    const match2 = findMatchingApproval(approvals, tc2);
    const match3 = findMatchingApproval(approvals, tc3);
    expect(match1?.requestId).toBe("r1");
    expect(match2?.requestId).toBe("r1");
    expect(match3?.requestId).toBe("r1");
  });

  it("falls back to toolName when toolUseId is absent", () => {
    const approvals: PermissionRequest[] = [approval({ requestId: "r1", toolName: "Bash" })];
    const tc = toolCall({ id: "tu-99", name: "Bash" });

    expect(findMatchingApproval(approvals, tc)?.requestId).toBe("r1");
  });

  it("returns undefined when toolUseId does not match any tool call", () => {
    const approvals: PermissionRequest[] = [
      approval({ requestId: "r1", toolName: "Edit", toolUseId: "tu-other" }),
    ];
    const tc = toolCall({ id: "tu-mine", name: "Edit" });

    expect(findMatchingApproval(approvals, tc)).toBeUndefined();
  });

  it("returns undefined for terminal tool calls (complete)", () => {
    const approvals: PermissionRequest[] = [
      approval({ requestId: "r1", toolName: "Bash", toolUseId: "tu-1" }),
    ];
    const tc = toolCall({ id: "tu-1", name: "Bash", status: "complete" });

    expect(findMatchingApproval(approvals, tc)).toBeUndefined();
  });

  it("returns undefined for terminal tool calls (error)", () => {
    const approvals: PermissionRequest[] = [
      approval({ requestId: "r1", toolName: "Bash", toolUseId: "tu-1" }),
    ];
    const tc = toolCall({ id: "tu-1", name: "Bash", status: "error" });

    expect(findMatchingApproval(approvals, tc)).toBeUndefined();
  });

  it("skips non-tool_approval permission requests", () => {
    const permissions: PermissionRequest[] = [
      { kind: "user_question", requestId: "q1", questions: [] },
      approval({ requestId: "r1", toolName: "Bash", toolUseId: "tu-1" }),
    ];
    const tc = toolCall({ id: "tu-1", name: "Bash" });

    expect(findMatchingApproval(permissions, tc)?.requestId).toBe("r1");
  });

  it("handles mixed approvals: some with toolUseId, some without", () => {
    const approvals: PermissionRequest[] = [
      approval({ requestId: "r1", toolName: "Edit", toolUseId: "tu-1" }),
      approval({ requestId: "r2", toolName: "Bash" }), // no toolUseId
      approval({ requestId: "r3", toolName: "Edit", toolUseId: "tu-3" }),
    ];

    const editTc1 = toolCall({ id: "tu-1", name: "Edit" });
    const editTc3 = toolCall({ id: "tu-3", name: "Edit" });
    const bashTc = toolCall({ id: "tu-99", name: "Bash" });

    expect(findMatchingApproval(approvals, editTc1)?.requestId).toBe("r1");
    expect(findMatchingApproval(approvals, editTc3)?.requestId).toBe("r3");
    expect(findMatchingApproval(approvals, bashTc)?.requestId).toBe("r2");
  });
});

describe("isApprovalClaimedByToolCall", () => {
  it("claimed when a non-terminal tool call matches by toolUseId", () => {
    const req = approval({ requestId: "r1", toolName: "Edit", toolUseId: "tu-1" });
    const messages = [msg([toolCall({ id: "tu-1", name: "Edit", status: "running" })])];

    expect(isApprovalClaimedByToolCall(req, messages)).toBe(true);
  });

  it("not claimed when matching tool call is complete", () => {
    const req = approval({ requestId: "r1", toolName: "Edit", toolUseId: "tu-1" });
    const messages = [msg([toolCall({ id: "tu-1", name: "Edit", status: "complete" })])];

    expect(isApprovalClaimedByToolCall(req, messages)).toBe(false);
  });

  it("not claimed when matching tool call is error", () => {
    const req = approval({ requestId: "r1", toolName: "Edit", toolUseId: "tu-1" });
    const messages = [msg([toolCall({ id: "tu-1", name: "Edit", status: "error" })])];

    expect(isApprovalClaimedByToolCall(req, messages)).toBe(false);
  });

  it("not claimed when no tool call matches the toolUseId", () => {
    const req = approval({ requestId: "r1", toolName: "Edit", toolUseId: "tu-missing" });
    const messages = [msg([toolCall({ id: "tu-other", name: "Edit", status: "running" })])];

    expect(isApprovalClaimedByToolCall(req, messages)).toBe(false);
  });

  it("falls back to toolName when toolUseId is absent", () => {
    const req = approval({ requestId: "r1", toolName: "Bash" });
    const messages = [msg([toolCall({ id: "tu-1", name: "Bash", status: "pending" })])];

    expect(isApprovalClaimedByToolCall(req, messages)).toBe(true);
  });

  it("not claimed when messages have no tool calls", () => {
    const req = approval({ requestId: "r1", toolName: "Edit", toolUseId: "tu-1" });
    const messages: ChatMessage[] = [{ id: "msg-1", role: "user", content: "hi" }];

    expect(isApprovalClaimedByToolCall(req, messages)).toBe(false);
  });

  it("only the correct approval is claimed among multiple same-name tool calls", () => {
    const req1 = approval({ requestId: "r1", toolName: "NotebookEdit", toolUseId: "tu-1" });
    const req2 = approval({ requestId: "r2", toolName: "NotebookEdit", toolUseId: "tu-2" });
    const req3 = approval({ requestId: "r3", toolName: "NotebookEdit", toolUseId: "tu-3" });

    // tu-1 is complete (terminal), tu-2 is running, tu-3 is pending
    const messages = [
      msg([
        toolCall({ id: "tu-1", name: "NotebookEdit", status: "complete" }),
        toolCall({ id: "tu-2", name: "NotebookEdit", status: "running" }),
        toolCall({ id: "tu-3", name: "NotebookEdit", status: "pending" }),
      ]),
    ];

    expect(isApprovalClaimedByToolCall(req1, messages)).toBe(false); // complete = unclaimed
    expect(isApprovalClaimedByToolCall(req2, messages)).toBe(true); // running = claimed
    expect(isApprovalClaimedByToolCall(req3, messages)).toBe(true); // pending = claimed
  });
});
