// Built-in widgets (side-effect: auto-registers)
import "./widgets/AskUserQuestionWidget.js";
import "./widgets/BashWidget.js";
import "./widgets/EditWidget.js";
import "./widgets/GlobWidget.js";
import "./widgets/GrepWidget.js";
import "./widgets/NotebookEditWidget.js";
import "./widgets/ReadWidget.js";
import "./widgets/TodoWriteWidget.js";
import "./widgets/WebFetchWidget.js";
import "./widgets/WebSearchWidget.js";
import "./widgets/WriteWidget.js";

// Re-export everything from @neeter/core for backward compatibility
export {
  AgentClient,
  type AgentClientConfig,
  type ChatStore,
  type ChatStoreShape,
  cn,
  createChatStore,
  findMatchingApproval,
  getWidget,
  isApprovalClaimedByToolCall,
  type ResumeOptions,
  type RewindOptions,
  registerWidget,
  replayEvents,
  stripMcpPrefix,
} from "@neeter/core";
export type {
  ChatMessage,
  CustomEvent,
  ModelUsage,
  PermissionRequest,
  PermissionResponse,
  SessionHistoryEntry,
  SessionInitEvent,
  SSEEvent,
  StopReason,
  TokenUsage,
  ToolApprovalRequest,
  ToolApprovalResponse,
  ToolCallInfo,
  ToolCallPhase,
  TurnCompleteData,
  UserQuestion,
  UserQuestionOption,
  UserQuestionRequest,
  UserQuestionResponse,
} from "@neeter/types";
export { AgentProvider, useAgentContext, useChatStore } from "./AgentProvider.js";
export { ChatInput } from "./ChatInput.js";
export { CollapsibleCard } from "./CollapsibleCard.js";
export { MessageList } from "./MessageList.js";
export { PendingPermissions } from "./PendingPermissions.js";
export { RollbackButton } from "./RollbackButton.js";
export { StatusDot } from "./StatusDot.js";
export { TextMessage } from "./TextMessage.js";
export { ThinkingBlock } from "./ThinkingBlock.js";
export { ThinkingIndicator } from "./ThinkingIndicator.js";
export { ToolApprovalCard } from "./ToolApprovalCard.js";
export { ToolCallCard } from "./ToolCallCard.js";
// Re-export React-specific widget types (with ComponentType instead of unknown)
export type { WidgetProps, WidgetRegistration } from "./types.js";
export { UserQuestionCard } from "./UserQuestionCard.js";
export { type UseAgentConfig, type UseAgentReturn, useAgent } from "./use-agent.js";
