/** Mirrors memory.service.js's `_toFileDto` — the wire shape for one memory file. */
export interface MemoryFile {
  scope: 'user' | 'agent' | 'workspace';
  /** Set when `scope` is `'agent'` or `'workspace'`. */
  agentId?: string;
  path: string;
  content: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One agent's group of scoped memory files, as returned by `memory.list()` —
 * used for both `agentMemories` (`scope: 'agent'`) and `agentWorkspaces`
 * (`scope: 'workspace'`).
 */
export interface MemoryAgentGroup {
  agentId: string;
  /** `null` if the Agent no longer exists. */
  agentName: string | null;
  files: MemoryFile[];
}

/** `GET /api/v1/developer/memory` — every memory file for the asserted external user. */
export interface MemoryListResult {
  userFiles: MemoryFile[];
  agentMemories: MemoryAgentGroup[];
  /**
   * Files under an Agent's own `/workspace/` filesystem route — the SAME
   * persistent store `write_file`/`read_file` tool calls under
   * `/workspace/...` actually read and write (deepagents routes that
   * prefix to this Mongo-backed store, NOT the LangGraph checkpoint's
   * `files` state channel — a thread's live/checkpointed state is a
   * different, much narrower thing). Scoped by Agent + Subject, shared
   * across every Thread that Subject has with that Agent.
   */
  agentWorkspaces: MemoryAgentGroup[];
}

export interface MemoryFileScopeParams {
  /** @default 'user' */
  scope?: 'user' | 'agent' | 'workspace';
  /** Required when `scope` is `'agent'` or `'workspace'`. */
  agentId?: string;
}

export interface GetMemoryFileParams extends MemoryFileScopeParams {
  path: string;
}

export interface WriteMemoryFileInput extends MemoryFileScopeParams {
  path: string;
  content: string;
}

export interface DeleteMemoryFileParams extends MemoryFileScopeParams {
  path: string;
}
