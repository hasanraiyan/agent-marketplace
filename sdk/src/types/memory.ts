/** Mirrors memory.service.js's `_toFileDto` — the wire shape for one memory file. */
export interface MemoryFile {
  scope: 'user' | 'agent';
  /** Set when `scope` is `'agent'`. */
  agentId?: string;
  path: string;
  content: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

/** One agent's group of agent-scoped memory files, as returned by `memory.list()`. */
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
}

export interface MemoryFileScopeParams {
  /** @default 'user' */
  scope?: 'user' | 'agent';
  /** Required when `scope` is `'agent'`. */
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
