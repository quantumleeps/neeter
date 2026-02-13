// Built-in widgets (side-effect: auto-registers)
import "./widgets/AskUserQuestionWidget.js";
import "./widgets/WebSearchWidget.js";

export type {
  ChatMessage,
  CustomEvent,
  PermissionRequest,
  PermissionResponse,
  SSEEvent,
  ToolApprovalRequest,
  ToolApprovalResponse,
  ToolCallInfo,
  ToolCallPhase,
  UserQuestion,
  UserQuestionOption,
  UserQuestionRequest,
  UserQuestionResponse,
  WidgetProps,
  WidgetRegistration,
} from "../types.js";
export { AgentProvider, useAgentContext, useChatStore } from "./AgentProvider.js";
export { ChatInput } from "./ChatInput.js";
export { CollapsibleCard } from "./CollapsibleCard.js";
export { cn } from "./cn.js";
export { MessageList } from "./MessageList.js";
export { PendingPermissions } from "./PendingPermissions.js";
export { getWidget, registerWidget, stripMcpPrefix } from "./registry.js";
export { StatusDot } from "./StatusDot.js";
export { type ChatStore, type ChatStoreShape, createChatStore } from "./store.js";
export { TextMessage } from "./TextMessage.js";
export { ThinkingBlock } from "./ThinkingBlock.js";
export { ThinkingIndicator } from "./ThinkingIndicator.js";
export { ToolApprovalCard } from "./ToolApprovalCard.js";
export { ToolCallCard } from "./ToolCallCard.js";
export { UserQuestionCard } from "./UserQuestionCard.js";
export { type UseAgentConfig, type UseAgentReturn, useAgent } from "./use-agent.js";
