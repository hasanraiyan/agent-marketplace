/** Like Skill/Agent/Knowledge/Mcp, this mirrors the real wire shape (`_id`). */
export interface Thread {
  _id: string;
  domain: string;
  /** Populated as `{ _id, name, avatar, slug }` on `list()`; a bare id on `create()`/`get()`. */
  agentId: string | { _id: string; name: string; avatar?: string; slug: string };
  subjectType: 'PersonaUser' | 'ExternalUser';
  userId?: string;
  externalUserId?: string;
  threadId: string;
  title: string;
  lastMessageAt: string;
  isArchived: boolean;
  subagentTraces?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateThreadInput {
  agentId: string;
}

export interface ListThreadsParams {
  page?: number;
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
}
