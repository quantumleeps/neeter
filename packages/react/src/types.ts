import type { ToolCallPhase } from "@neeter/types";
import type { ComponentType } from "react";

export interface WidgetProps<TResult = unknown> {
  phase: ToolCallPhase;
  toolUseId: string;
  input: Record<string, unknown>;
  partialInput?: string;
  result?: TResult;
  error?: string;
}

export interface WidgetRegistration<TResult = unknown> {
  toolName: string;
  label: string;
  richLabel?: (result: TResult, input: Record<string, unknown>) => string | null;
  inputRenderer?: ComponentType<{ input: Record<string, unknown> }>;
  component: ComponentType<WidgetProps<TResult>>;
}
