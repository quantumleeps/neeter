import type {
  WidgetProps as CoreWidgetProps,
  WidgetRegistration as CoreWidgetRegistration,
} from "@neeter/core";
import type { ComponentType } from "react";

export type WidgetProps<TResult = unknown> = CoreWidgetProps<TResult>;

export interface WidgetRegistration<TResult = unknown>
  extends Omit<CoreWidgetRegistration<TResult>, "inputRenderer" | "component"> {
  inputRenderer?: ComponentType<{ input: Record<string, unknown> }>;
  component: ComponentType<WidgetProps<TResult>>;
}
