import type { ComponentType } from "react";

// --- SSE ---

export interface SSEEvent {
  event: string;
  data: string;
}

export interface CustomEvent<T = unknown> {
  name: string;
  value: T;
}

// --- Chat Store ---

export type ToolCallPhase = "pending" | "streaming_input" | "running" | "complete" | "error";

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  partialInput?: string;
  result?: string;
  error?: string;
  status: ToolCallPhase;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  toolCalls?: ToolCallInfo[];
}

// --- Widget Registry ---

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

// --- Permissions / Approvals ---

export interface ToolApprovalRequest {
  kind: "tool_approval";
  requestId: string;
  toolName: string;
  input: Record<string, unknown>;
  description?: string;
}

export interface UserQuestionOption {
  label: string;
  description?: string;
}

export interface UserQuestion {
  question: string;
  header?: string;
  options?: UserQuestionOption[];
  multiSelect?: boolean;
}

export interface UserQuestionRequest {
  kind: "user_question";
  requestId: string;
  questions: UserQuestion[];
}

export type PermissionRequest = ToolApprovalRequest | UserQuestionRequest;

export interface ToolApprovalResponse {
  kind: "tool_approval";
  requestId: string;
  behavior: "allow" | "deny";
  message?: string;
}

export interface UserQuestionResponse {
  kind: "user_question";
  requestId: string;
  answers: Record<string, string>;
}

export type PermissionResponse = ToolApprovalResponse | UserQuestionResponse;
