/// <reference types="node" />
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSandboxHook } from "./hooks.js";

function preToolUseInput(toolInput: Record<string, unknown>, toolName = "Write") {
  return {
    hook_event_name: "PreToolUse" as const,
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "test-id",
    session_id: "test-session",
    transcript_path: "",
    cwd: "/tmp",
  };
}

describe("createSandboxHook", () => {
  const sandboxDir = "/tmp/sandboxes/abc123";
  const hooks = createSandboxHook(sandboxDir, resolve);
  const hook = hooks[0].hooks[0];

  it("allows paths inside the sandbox", async () => {
    const result = await hook(
      preToolUseInput({ file_path: `${sandboxDir}/index.html` }),
      "tool-1",
      { signal: AbortSignal.timeout(5000) },
    );
    expect(result).toEqual({});
  });

  it("allows the sandbox directory itself", async () => {
    const result = await hook(preToolUseInput({ path: sandboxDir }), "tool-1", {
      signal: AbortSignal.timeout(5000),
    });
    expect(result).toEqual({});
  });

  it("blocks paths outside the sandbox", async () => {
    const result = await hook(preToolUseInput({ file_path: "/etc/passwd" }), "tool-1", {
      signal: AbortSignal.timeout(5000),
    });
    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Access outside sandbox directory is not allowed",
      },
    });
  });

  it("blocks path traversal", async () => {
    const result = await hook(
      preToolUseInput({ file_path: `${sandboxDir}/../../etc/passwd` }),
      "tool-1",
      { signal: AbortSignal.timeout(5000) },
    );
    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Access outside sandbox directory is not allowed",
      },
    });
  });

  it("blocks sibling directory with shared prefix", async () => {
    const result = await hook(
      preToolUseInput({ file_path: `${sandboxDir}-evil/index.html` }),
      "tool-1",
      { signal: AbortSignal.timeout(5000) },
    );
    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Access outside sandbox directory is not allowed",
      },
    });
  });

  it("allows when no file path is present", async () => {
    const result = await hook(preToolUseInput({ pattern: "*.html" }), "tool-1", {
      signal: AbortSignal.timeout(5000),
    });
    expect(result).toEqual({});
  });

  it("checks the path field (used by Glob/Grep)", async () => {
    const result = await hook(
      preToolUseInput({ path: "/home/user/secrets", pattern: "*.txt" }),
      "tool-1",
      { signal: AbortSignal.timeout(5000) },
    );
    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Access outside sandbox directory is not allowed",
      },
    });
  });

  it("ignores non-PreToolUse events", async () => {
    const result = await hook(
      {
        hook_event_name: "PostToolUse" as never,
        tool_name: "Write",
        tool_input: { file_path: "/etc/passwd" },
        tool_use_id: "test-id",
        session_id: "test-session",
        transcript_path: "",
        cwd: "/tmp",
      },
      "tool-1",
      { signal: AbortSignal.timeout(5000) },
    );
    expect(result).toEqual({});
  });

  it("resolves relative paths against cwd, not sandbox", async () => {
    const result = await hook(preToolUseInput({ file_path: "index.html" }), "tool-1", {
      signal: AbortSignal.timeout(5000),
    });
    // resolve("index.html") gives process.cwd()/index.html, which is outside sandbox
    const resolved = resolve("index.html");
    if (!resolved.startsWith(sandboxDir)) {
      expect(result).toEqual({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Access outside sandbox directory is not allowed",
        },
      });
    }
  });

  it("blocks Bash by default", async () => {
    const result = await hook(preToolUseInput({ command: "cat /etc/passwd" }, "Bash"), "tool-1", {
      signal: AbortSignal.timeout(5000),
    });
    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: expect.stringContaining("Bash is blocked in sandbox mode"),
      },
    });
  });

  it("allows Bash when allowBash is true", async () => {
    const permissiveHooks = createSandboxHook(sandboxDir, resolve, { allowBash: true });
    const permissiveHook = permissiveHooks[0].hooks[0];
    const result = await permissiveHook(preToolUseInput({ command: "ls -la" }, "Bash"), "tool-1", {
      signal: AbortSignal.timeout(5000),
    });
    expect(result).toEqual({});
  });
});
