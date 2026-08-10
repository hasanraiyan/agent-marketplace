import type { ChatMessageInput } from '@personaai/sdk';

export interface RunContext {
  userId: string;
  agentId: string;
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
  phase: 'auth' | 'chat';
  agentId?: string;
  threadId?: string;
}

export interface ToolCallContext {
  userId: string;
  agentId: string;
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
  agentId: string;
  path: string;
}

/**
 * Lifecycle hooks — the host application's voice inside the runtime's
 * request handling. Plain async event listeners, not middleware: the
 * runtime proceeds with sensible defaults when a hook is omitted, and a
 * hook that wants to reject a run simply throws (the throw is caught and
 * routed through the same sanitized error path as any other failure).
 *
 * v0.1 only actually invokes `beforeRun`/`afterRun`/`onError`, all three
 * around the chat route (the only route where "before/after a run"
 * unambiguously applies). The remaining five hooks are declared here for
 * forward compatibility with later runtime versions but are NOT invoked —
 * see the README's "Not yet implemented" section.
 */
export interface RuntimeHooks {
  beforeRun?(ctx: RunContext): void | Promise<void>;
  afterRun?(ctx: RunContext, result: RunResult): void | Promise<void>;
  onError?(ctx: ErrorContext, error: unknown): void | Promise<void>;

  /** @remarks Declared for forward compatibility. Not invoked by the runtime yet. */
  beforeToolCall?(ctx: ToolCallContext): void | Promise<void>;
  /** @remarks Declared for forward compatibility. Not invoked by the runtime yet. */
  afterToolCall?(ctx: ToolCallContext, result: unknown): void | Promise<void>;
  /** @remarks Declared for forward compatibility. Not invoked by the runtime yet. */
  onFileUpload?(ctx: FileUploadContext): void | Promise<void>;
  /** @remarks Declared for forward compatibility. Not invoked by the runtime yet. */
  onThreadCreate?(ctx: ThreadCreateContext): void | Promise<void>;
  /** @remarks Declared for forward compatibility. Not invoked by the runtime yet. */
  onMemoryWrite?(ctx: MemoryWriteContext): void | Promise<void>;
}
