import type { WidgetRegistration } from "./types.js";

const widgets = new Map<string, WidgetRegistration>();

/**
 * Register a widget for a tool name. Must run before any tool calls are
 * looked up via `getWidget()`. Later registrations overwrite earlier ones.
 */
export function registerWidget<TResult>(reg: WidgetRegistration<TResult>): void {
  widgets.set(reg.toolName, reg as WidgetRegistration);
}

export function getWidget(toolName: string): WidgetRegistration | undefined {
  return widgets.get(toolName);
}

export function stripMcpPrefix(name: string): string {
  return name.replace(/^mcp__.+?__/, "");
}
