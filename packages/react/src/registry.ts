import type { WidgetRegistration } from "./types.js";

const widgets = new Map<string, WidgetRegistration>();

/**
 * Register a component for a tool name. Must run before React renders any
 * tool calls — use a side-effect import at your app's entry point.
 * Later registrations overwrite earlier ones for the same `toolName`.
 */
export function registerWidget<TResult>(reg: WidgetRegistration<TResult>): void {
  widgets.set(reg.toolName, reg as WidgetRegistration);
}

export function getWidget(toolName: string): WidgetRegistration | undefined {
  return widgets.get(toolName);
}

export function stripMcpPrefix(name: string): string {
  return name.replace(/^mcp__[^_]+__/, "");
}
