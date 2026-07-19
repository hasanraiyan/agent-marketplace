import { api } from "./core";

// File-based memory API. Memories are markdown virtual files — the same files
// agents read/write through their /memories/user/ and /memories/agent/
// filesystem routes.
//
// GET /memory            → { userFiles: [...], agentMemories: [{ agentId, agentName, files }] }
// PUT /memory/file       → { scope: 'user'|'agent', agentId?, path, content }
// DELETE /memory/file    → query: scope, agentId?, path
// DELETE /memory/all
export const getAllMemory = () => api.get("/memory");

export const writeMemoryFile = ({ scope = "user", agentId, path, content }) =>
  api.put("/memory/file", { scope, agentId, path, content });

export const deleteMemoryFile = ({ scope = "user", agentId, path }) =>
  api.delete("/memory/file", { params: { scope, agentId, path } });

export const clearAllMemory = () => api.delete("/memory/all");
