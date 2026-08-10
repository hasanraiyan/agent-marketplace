import type { ChatMessageInput } from '@personaai/sdk';

export interface RunContext {
  userId: string;
  /** Which endpoint started this run. */
  kind: 'chat' | 'architect';
  /** Absent for `kind: 'architect'` — the Architect co-pilot has no target agentId, it builds/edits Agents itself. */
  agentId?: string;
  threadId?: string;
  messages: ChatMessageInput[];
}

export interface RunResult {
  /** Assembled assistant text (concatenated TEXT_MESSAGE_CHUNK deltas), same as `ChatResult.text`. */
  text: string;
  eventCount: number;
  /** True when the run paused on a HITL/clarification interrupt instead of finishing normally. */
  interrupted: boolean;
  /** True when a RUN_ERROR event was seen — the run still completed (as far as the stream is concerned); see README on the `onError` vs `erroredInBand` distinction. */
  erroredInBand: boolean;
}

export interface ErrorContext {
  userId: string | null;
  /** Which stage of request handling the error came from. */
  phase: 'auth' | 'chat' | 'architect';
  agentId?: string;
  threadId?: string;
}

export interface ToolCallContext {
  userId: string;
  /** Absent for a tool call inside an Architect run. */
  agentId?: string;
  threadId?: string;
  toolName: string;
  toolCallId: string;
}

export interface FileUploadContext {
  userId: string;
  fileName: string;
  mimeType?: string;
}

export interface ThreadCreateContext {
  userId: string;
  agentId: string;
  threadId: string;
}

export interface MemoryWriteContext {
  userId: string;
  /** Set when the write was agent-scoped (`scope: 'agent'`); absent for a user-scoped write. */
  agentId?: string;
  path: string;
}

/**
 * Lifecycle hooks — the host application's voice inside the runtime's
 * request handling. Plain async event listeners, not middleware: the
 * runtime proceeds with sensible defaults when a hook is omitted, and a
 * hook that wants to reject a run simply throws (the throw is caught and
 * routed through the same sanitized error path as any other failure).
 */
export interface RuntimeHooks {
  beforeRun?(ctx: RunContext): void | Promise<void>;
  afterRun?(ctx: RunContext, result: RunResult): void | Promise<void>;
  onError?(ctx: ErrorContext, error: unknown): void | Promise<void>;

  /** Fires when a TOOL_CALL_START event arrives in the chat stream, before its result is known. */
  beforeToolCall?(ctx: ToolCallContext): void | Promise<void>;
  /** Fires when the matching TOOL_CALL_RESULT event arrives. `result` is the raw (string or JSON-parsed) tool output. */
  afterToolCall?(ctx: ToolCallContext, result: unknown): void | Promise<void>;
  /** Fires after a file finishes uploading via `POST /files`. */
  onFileUpload?(ctx: FileUploadContext): void | Promise<void>;
  /**
   * Fires after a Thread is created — either explicitly via `POST /threads`,
   * or implicitly by `POST /chat` when no `threadId` was supplied and the
   * run's `RUN_STARTED` event reports one that didn't exist yet.
   */
  onThreadCreate?(ctx: ThreadCreateContext): void | Promise<void>;
  /** Fires after a memory file is written via `PUT /memory/file`. */
  onMemoryWrite?(ctx: MemoryWriteContext): void | Promise<void>;
}
