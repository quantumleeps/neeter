export {
  AgentClient,
  type AgentClientConfig,
  type ResumeOptions,
  type RewindOptions,
} from "./agent-client.js";
export { findMatchingApproval, isApprovalClaimedByToolCall } from "./approval-matching.js";
export { cn } from "./cn.js";
export { getWidget, registerWidget, stripMcpPrefix } from "./registry.js";
export type { ChatStore, ChatStoreShape } from "./store.js";
export { createChatStore, replayEvents } from "./store.js";
export type { WidgetProps, WidgetRegistration } from "./types.js";
