import type { ChatInterrupt } from './chat.js';

/** Like Skill/Agent/Knowledge/Mcp, this mirrors the real wire shape (`_id`). */
export interface Thread {
  _id: string;
  domain: string;
  /** Populated as `{ _id, name, avatar, slug }` on `list()`; a bare id on `create()`/`get()`. */
  agentId: string | { _id: string; name: string; avatar?: string; slug: string };
  subjectType: 'PersonaUser' | 'ExternalUser';
  userId?: string;
  externalUserId?: string;
  /** The deterministic AG-UI thread id used for streaming (`x-thread-id`) — distinct from `_id`. */
  threadId: string;
  title: string;
  lastMessageAt: string;
  isArchived: boolean;
  subagentTraces?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateThreadInput {
  /** The Agent this Thread's conversation is with. */
  agentId: string;
}

/** All fields optional — only what you pass is changed. */
export interface UpdateThreadInput {
  title?: string;
  isArchived?: boolean;
}

export interface ListThreadsParams {
  /** @default 1 */
  page?: number;
  /** @default 20 */
  limit?: number;
}

/**
 * `messages` holds raw LangChain message objects (role/content/tool_calls
 * vary by message type) — intentionally untyped rather than guessing at
 * a shape this SDK doesn't own.
 */
export interface ThreadMessages {
  messages: unknown[];
  state: Record<string, unknown>;
  subagentTraces: Record<string, unknown>;
  /**
   * Set when this Thread is currently paused on a HITL/clarification
   * interrupt — lets a caller re-show the approval/clarification card on
   * page load without waiting for the next live `chat.stream()` call to
   * re-surface it. Same shape as `ChatResult.interrupt`. Named
   * `pendingInterrupt` (not `interrupt`) to match the actual wire field
   * checkpointService.getMessages() returns.
   */
  pendingInterrupt?: ChatInterrupt;
}
