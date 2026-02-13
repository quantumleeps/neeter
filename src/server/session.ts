import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { UserQuestion } from "../types.js";
import { PermissionGate } from "./permission-gate.js";
import { PushChannel } from "./push-channel.js";

type SDKMessage = ReturnType<typeof query> extends AsyncGenerator<infer T> ? T : never;

function userMessage(content: string): SDKUserMessage {
  return {
    type: "user",
    message: { role: "user", content },
    parent_tool_use_id: null,
    session_id: "",
  };
}

export interface SessionInit<TCtx> {
  context: TCtx;
  model: string;
  systemPrompt: string;
  mcpServers?: Record<string, unknown>;
  tools?: unknown[];
  allowedTools?: string[];
  maxTurns?: number;
  permissionMode?: "default" | "acceptEdits" | "plan" | "bypassPermissions";
  thinking?: { type: "enabled"; budgetTokens: number } | { type: "disabled" };
}

export interface Session<TCtx> {
  id: string;
  context: TCtx;
  pushMessage(text: string): void;
  messageIterator: AsyncIterable<SDKMessage>;
  permissionGate: PermissionGate;
  abort(): void;
  createdAt: number;
  lastActivityAt: number;
}

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export class SessionManager<TCtx> {
  private sessions = new Map<string, Session<TCtx>>();
  private factory: () => SessionInit<TCtx>;
  private idleTimeoutMs: number;

  constructor(factory: () => SessionInit<TCtx>, idleTimeoutMs?: number) {
    this.factory = factory;
    this.idleTimeoutMs = idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  }

  create(): Session<TCtx> {
    const id = crypto.randomUUID();
    const init = this.factory();
    const channel = new PushChannel<SDKUserMessage>();
    const abortController = new AbortController();
    const permissionGate = new PermissionGate();

    const permissionMode = init.permissionMode ?? "bypassPermissions";
    const isBypass = permissionMode === "bypassPermissions";

    const canUseTool = isBypass
      ? undefined
      : async (toolName: string, input: Record<string, unknown>) => {
          const requestId = crypto.randomUUID();

          if (toolName === "AskUserQuestion") {
            const questions = (input.questions ?? []) as UserQuestion[];
            const response = await permissionGate.request({
              kind: "user_question",
              requestId,
              questions,
            });
            if (response.kind === "user_question") {
              return {
                behavior: "allow" as const,
                updatedInput: { ...input, answers: response.answers },
              };
            }
            return { behavior: "deny" as const, message: "Cancelled" };
          }

          const response = await permissionGate.request({
            kind: "tool_approval",
            requestId,
            toolName,
            input,
            description: input.description as string | undefined,
          });
          if (response.kind === "tool_approval" && response.behavior === "allow") {
            return { behavior: "allow" as const, updatedInput: input };
          }
          const message =
            response.kind === "tool_approval" ? (response.message ?? "Denied by user") : "Denied";
          return { behavior: "deny" as const, message };
        };

    const messageIterator = query({
      prompt: channel,
      options: {
        systemPrompt: init.systemPrompt,
        model: init.model,
        tools: (init.tools as never[]) ?? [],
        mcpServers: init.mcpServers as never,
        allowedTools: init.allowedTools,
        maxTurns: init.maxTurns ?? 200,
        permissionMode,
        ...(isBypass ? { allowDangerouslySkipPermissions: true } : {}),
        includePartialMessages: true,
        abortController,
        ...(canUseTool ? { canUseTool } : {}),
        ...(init.thinking ? { thinking: init.thinking } : {}),
      },
    });

    const session: Session<TCtx> = {
      id,
      context: init.context,
      pushMessage: (text: string) => {
        session.lastActivityAt = Date.now();
        channel.push(userMessage(text));
      },
      messageIterator,
      permissionGate,
      abort: () => {
        permissionGate.cancelAll("Session aborted");
        abortController.abort();
      },
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.sessions.set(id, session);
    return session;
  }

  get(id: string): Session<TCtx> | undefined {
    return this.sessions.get(id);
  }

  delete(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      session.abort();
      this.sessions.delete(id);
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > this.idleTimeoutMs) {
        session.abort();
        this.sessions.delete(id);
      }
    }
  }
}
