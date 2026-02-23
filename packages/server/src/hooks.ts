import type {
  HookCallbackMatcher,
  HookJSONOutput,
  PreToolUseHookInput,
} from "@anthropic-ai/claude-agent-sdk";

export interface SandboxHookOptions {
  /**
   * Allow Bash tool calls through the sandbox hook (default: `false`).
   *
   * Bash commands can reference arbitrary filesystem paths via subshells,
   * variable expansion, redirects, and other shell features that can't be
   * reliably inspected. When `false`, all Bash calls are blocked.
   *
   * If you need Bash access inside a sandbox, set this to `true` and use
   * OS-level isolation instead: containers with `--network none` and a
   * read-only filesystem, `@anthropic-ai/sandbox-runtime`, or VMs.
   *
   * @see https://platform.claude.com/docs/en/agent-sdk/secure-deployment
   */
  allowBash?: boolean;
}

/**
 * Creates a PreToolUse hook that blocks file operations outside a sandbox directory.
 * Inspects `file_path` and `path` fields in tool input and blocks any resolved path
 * that falls outside the given directory.
 *
 * Bash is blocked by default because shell commands can reference paths outside the
 * sandbox in ways that can't be reliably detected (subshells, variable expansion,
 * redirects, backticks). To sandbox Bash, use OS-level isolation — containers,
 * `@anthropic-ai/sandbox-runtime`, or VMs — and set `options.allowBash` to `true`.
 *
 * @see https://platform.claude.com/docs/en/agent-sdk/secure-deployment
 *
 * @param sandboxDir - Absolute path to the sandbox directory (must already be resolved)
 * @param resolvePath - Path resolver function (e.g. `path.resolve` from `node:path`)
 * @param options - Configuration options
 */
export function createSandboxHook(
  sandboxDir: string,
  resolvePath: (...segments: string[]) => string,
  options?: SandboxHookOptions,
): HookCallbackMatcher[] {
  const normalizedDir = resolvePath(sandboxDir);
  const allowBash = options?.allowBash ?? false;

  return [
    {
      hooks: [
        async (input): Promise<HookJSONOutput> => {
          if (input.hook_event_name !== "PreToolUse") return {};

          const preInput = input as PreToolUseHookInput;
          if (preInput.tool_name === "Bash" && !allowBash) {
            return {
              hookSpecificOutput: {
                hookEventName: input.hook_event_name,
                permissionDecision: "deny",
                permissionDecisionReason:
                  "Bash is blocked in sandbox mode — shell commands can reference arbitrary paths. " +
                  "Use allowBash with OS-level isolation (containers, sandbox-runtime) for Bash access. " +
                  "See https://platform.claude.com/docs/en/agent-sdk/secure-deployment",
              },
            };
          }

          const toolInput = preInput.tool_input as Record<string, unknown>;
          const filePath = (toolInput.file_path ?? toolInput.path) as string | undefined;
          if (!filePath) return {};
          const resolved = resolvePath(filePath);
          if (resolved !== normalizedDir && !resolved.startsWith(`${normalizedDir}/`)) {
            return {
              hookSpecificOutput: {
                hookEventName: input.hook_event_name,
                permissionDecision: "deny",
                permissionDecisionReason: "Access outside sandbox directory is not allowed",
              },
            };
          }
          return {};
        },
      ],
    },
  ];
}
