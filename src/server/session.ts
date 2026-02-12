import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
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
  permissionMode?: "default" | "plan" | "bypassPermissions";
}

export interface Session<TCtx> {
  id: string;
  context: TCtx;
  pushMessage(text: string): void;
  messageIterator: AsyncIterable<SDKMessage>;
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

    const messageIterator = query({
      prompt: channel,
      options: {
        systemPrompt: init.systemPrompt,
        model: init.model,
        tools: (init.tools as never[]) ?? [],
        mcpServers: init.mcpServers as never,
        allowedTools: init.allowedTools,
        maxTurns: init.maxTurns ?? 200,
        permissionMode: init.permissionMode ?? "bypassPermissions",
        includePartialMessages: true,
        abortController,
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
      abort: () => abortController.abort(),
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
