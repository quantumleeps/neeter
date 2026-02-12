import type { SSEEvent } from "../types.js";
import type { Session } from "./session.js";

export interface TranslatorConfig<TCtx> {
  onToolResult?: (toolName: string, result: string, session: Session<TCtx>) => SSEEvent[];
}

export class MessageTranslator<TCtx> {
  private config: TranslatorConfig<TCtx>;
  private toolNames = new Map<string, string>();

  constructor(config?: TranslatorConfig<TCtx>) {
    this.config = config ?? {};
  }

  translate(message: Record<string, unknown>, session: Session<TCtx>): SSEEvent[] {
    const events: SSEEvent[] = [];
    const type = message.type as string;

    switch (type) {
      case "stream_event": {
        if (!("event" in message)) break;
        const event = message.event as Record<string, unknown>;

        switch (event.type) {
          case "message_start": {
            events.push({ event: "message_start", data: "{}" });
            break;
          }
          case "content_block_start": {
            const block = event.content_block as Record<string, unknown>;
            if (block?.type === "tool_use" && typeof block.id === "string") {
              const name = block.name as string;
              this.toolNames.set(block.id, name);
              events.push({
                event: "tool_start",
                data: JSON.stringify({ id: block.id, name }),
              });
            }
            break;
          }
          case "content_block_delta": {
            const delta = event.delta as Record<string, unknown>;
            if (delta.type === "text_delta" && typeof delta.text === "string") {
              events.push({
                event: "text_delta",
                data: JSON.stringify({ text: delta.text }),
              });
            } else if (
              delta.type === "input_json_delta" &&
              typeof delta.partial_json === "string"
            ) {
              const id = this.lastToolId();
              if (id) {
                events.push({
                  event: "tool_input_delta",
                  data: JSON.stringify({ id, partialJson: delta.partial_json }),
                });
              }
            }
            break;
          }
        }
        break;
      }

      case "assistant": {
        const msg = (message as { message?: { content?: Array<Record<string, unknown>> } }).message;
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === "tool_use") {
              const name = block.name as string;
              const id = block.id as string;
              this.toolNames.set(id, name);
              events.push({
                event: "tool_call",
                data: JSON.stringify({ id, name, input: block.input }),
              });
            }
          }
        }
        break;
      }

      case "user": {
        const msg = (message as { message?: { role: string; content: unknown } }).message;
        if (Array.isArray(msg?.content)) {
          for (const block of msg.content) {
            if (block.type === "tool_result") {
              const text = extractToolResultText(block);
              const toolName = this.toolNames.get(block.tool_use_id as string);

              events.push({
                event: "tool_result",
                data: JSON.stringify({ toolUseId: block.tool_use_id, result: text }),
              });

              if (this.config.onToolResult && toolName) {
                events.push(...this.config.onToolResult(toolName, text, session));
              }
            }
          }
        }
        break;
      }

      case "tool_progress": {
        events.push({
          event: "tool_progress",
          data: JSON.stringify({
            toolName: message.tool_name,
            elapsed: message.elapsed_time_seconds,
          }),
        });
        break;
      }

      case "result": {
        if (message.subtype === "success") {
          events.push({
            event: "turn_complete",
            data: JSON.stringify({
              numTurns: (message as Record<string, unknown>).num_turns ?? 0,
              cost: (message as Record<string, unknown>).total_cost_usd ?? 0,
            }),
          });
        } else {
          events.push({
            event: "session_error",
            data: JSON.stringify({ subtype: message.subtype }),
          });
        }
        break;
      }
    }

    return events;
  }

  private lastToolId(): string | undefined {
    const entries = [...this.toolNames.entries()];
    return entries.length > 0 ? entries[entries.length - 1][0] : undefined;
  }
}

export function sseEncode(evt: SSEEvent): string {
  return `event: ${evt.event}\ndata: ${evt.data}\n\n`;
}

export async function* streamSession<TCtx>(
  session: Session<TCtx>,
  translator: MessageTranslator<TCtx>,
): AsyncGenerator<SSEEvent> {
  for await (const message of session.messageIterator) {
    const events = translator.translate(message as Record<string, unknown>, session);
    for (const evt of events) {
      yield evt;
    }
  }
}

function extractToolResultText(block: Record<string, unknown>): string {
  const content = block.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: Record<string, unknown>) => p.type === "text" && typeof p.text === "string")
      .map((p: Record<string, unknown>) => p.text)
      .join("");
  }
  return "";
}
