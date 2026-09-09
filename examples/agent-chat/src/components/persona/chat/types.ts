export type ChatRole = "user" | "assistant" | "system";

export interface ChatToolCall {
  id: string;
  name: string;
  /** Raw JSON string, as streamed — parsed for display where needed. */
  args?: string;
  /** Raw JSON string result, once the call finishes. */
  result?: string;
  status: "running" | "done" | "error";
  /** Present only for the `task` (subagent) tool — its own nested timeline. */
  subagentMessages?: ChatMessageData[];
  /** Present when this tool is backed by an interactive MCP Ext App. */
  mcpApp?: { resourceUri?: string; mcpId?: string; initialHtml?: string };
}

export interface ChatTodo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface ChatMessageData {
  id: string;
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
  toolCalls?: ChatToolCall[];
}

export interface ChatClarificationQuestion {
  id?: string;
  question: string;
  options?: Array<{ value: string; label: string; description?: string }>;
  allowCustom?: boolean;
  required?: boolean;
}

export interface ChatHitlAction {
  id: string;
  label: string;
  description?: string;
}

export type ChatInterruptData =
  | { kind: "hitl"; actionRequests: ChatHitlAction[] }
  | { kind: "clarification"; questions: ChatClarificationQuestion[] };

export type VoiceCallState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "ended";

export interface ChatWorkspaceFile {
  path: string;
  title: string;
  description?: string;
  content?: string;
}
