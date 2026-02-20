import type { PermissionRequest, PermissionResponse } from "@neeter/types";
import { describe, expect, it, vi } from "vitest";
import { PermissionGate } from "./permission-gate.js";

function toolApproval(id: string): PermissionRequest {
  return {
    kind: "tool_approval",
    requestId: id,
    toolName: "search",
    input: { q: "test" },
  };
}

function userQuestion(id: string): PermissionRequest {
  return {
    kind: "user_question",
    requestId: id,
    questions: [
      { question: "Pick a color", options: [{ label: "Red", description: "Red color" }] },
    ],
  };
}

describe("PermissionGate", () => {
  it("request() stores pending and notifies listeners", () => {
    const gate = new PermissionGate();
    const listener = vi.fn();
    gate.onRequest(listener);

    const req = toolApproval("r1");
    gate.request(req);

    expect(listener).toHaveBeenCalledWith(req);
    expect(gate.getPending()).toEqual([req]);
  });

  it("respond() resolves the matching promise and returns true", async () => {
    const gate = new PermissionGate();
    const req = toolApproval("r1");
    const promise = gate.request(req);

    const response: PermissionResponse = {
      kind: "tool_approval",
      requestId: "r1",
      behavior: "allow",
    };
    const found = gate.respond(response);

    expect(found).toBe(true);
    expect(gate.getPending()).toHaveLength(0);
    await expect(promise).resolves.toEqual(response);
  });

  it("respond() returns false for unknown requestId", () => {
    const gate = new PermissionGate();
    const result = gate.respond({
      kind: "tool_approval",
      requestId: "unknown",
      behavior: "deny",
    });
    expect(result).toBe(false);
  });

  it("onRequest() returns an unsubscribe function", () => {
    const gate = new PermissionGate();
    const listener = vi.fn();
    const unsub = gate.onRequest(listener);

    unsub();
    gate.request(toolApproval("r1"));

    expect(listener).not.toHaveBeenCalled();
  });

  it("getPending() returns snapshot of current requests", () => {
    const gate = new PermissionGate();
    gate.request(toolApproval("r1"));
    gate.request(userQuestion("r2"));

    const pending = gate.getPending();
    expect(pending).toHaveLength(2);
    expect(pending[0].requestId).toBe("r1");
    expect(pending[1].requestId).toBe("r2");
  });

  it("cancelAll() resolves tool approvals with deny", async () => {
    const gate = new PermissionGate();
    const promise = gate.request(toolApproval("r1"));

    gate.cancelAll("session ended");

    const result = await promise;
    expect(result).toEqual({
      kind: "tool_approval",
      requestId: "r1",
      behavior: "deny",
      message: "session ended",
    });
    expect(gate.getPending()).toHaveLength(0);
  });

  it("cancelAll() resolves user questions with empty answers", async () => {
    const gate = new PermissionGate();
    const promise = gate.request(userQuestion("r1"));

    gate.cancelAll("session ended");

    const result = await promise;
    expect(result).toEqual({
      kind: "user_question",
      requestId: "r1",
      answers: {},
    });
    expect(gate.getPending()).toHaveLength(0);
  });
});
