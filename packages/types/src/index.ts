// --- SSE ---

export interface SSEEvent {
  event: string;
  data: string;
}

export interface CustomEvent<T = unknown> {
  name: string;
  value: T;
}

export interface McpServerStatus {
  name: string;
  status: string;
}

export interface SessionInitEvent {
  sdkSessionId: string;
  model: string;
  tools: string[];
  mcpServers: McpServerStatus[];
  fileCheckpointing?: boolean;
}

export interface SessionHistoryEntry {
  sdkSessionId: string;
  description: string;
  createdAt: number;
  lastActivityAt: number;
}

// --- Content Blocks (multimodal messages) ---

export interface TextBlock {
  type: "text";
  text: string;
}

export interface Base64ImageSource {
  type: "base64";
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
}

export interface ImageBlock {
  type: "image";
  source: Base64ImageSource;
}

export type ContentBlock = TextBlock | ImageBlock;

/** Content for a user message — plain string or array of text/image blocks. */
export type UserMessageContent = string | ContentBlock[];

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

// --- Permissions / Approvals ---

export interface ToolApprovalRequest {
  kind: "tool_approval";
  requestId: string;
  toolName: string;
  toolUseId?: string;
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

// --- File Checkpointing ---

export interface CheckpointEvent {
  userMessageUuid: string;
}

export interface RewindFilesRequest {
  userMessageId: string;
  dryRun?: boolean;
}

export interface RewindFilesResult {
  canRewind: boolean;
  error?: string;
  filesChanged?: string[];
  insertions?: number;
  deletions?: number;
}

// --- Stop Reason ---

export type StopReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "refusal"
  | "tool_use"
  | null;

// --- Token Usage ---

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface ModelUsage extends TokenUsage {
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
}

export interface TurnCompleteData {
  numTurns: number;
  cost: number;
  stopReason: StopReason;
  usage: TokenUsage | null;
  modelUsage: Record<string, ModelUsage> | null;
}

// --- Persistence ---

export interface SessionRecord {
  meta: SessionHistoryEntry;
  events: SSEEvent[];
}

export interface SessionStore {
  save(sdkSessionId: string, record: SessionRecord): Promise<void>;
  load(sdkSessionId: string): Promise<SessionRecord | null>;
  list(): Promise<SessionHistoryEntry[]>;
  delete(sdkSessionId: string): Promise<void>;
}
