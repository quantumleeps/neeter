import type { WidgetRegistration } from "./types.js";

const widgets = new Map<string, WidgetRegistration>();

export function registerWidget<TResult>(reg: WidgetRegistration<TResult>): void {
  widgets.set(reg.toolName, reg as WidgetRegistration);
}

export function getWidget(toolName: string): WidgetRegistration | undefined {
  return widgets.get(toolName);
}

export function stripMcpPrefix(name: string): string {
  return name.replace(/^mcp__[^_]+__/, "");
}
