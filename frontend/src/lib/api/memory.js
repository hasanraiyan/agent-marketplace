import { api } from "./core";

// Memory API functions
export const getAllMemory = () => api.get("/memory");
export const createMemory = (data) => api.post("/memory", data);
export const updateMemory = (agentId, key, data) =>
  api.put(`/memory/${agentId}/${encodeURIComponent(key)}`, data);
export const deleteMemoryEntry = (agentId, key) =>
  api.delete(`/memory/${agentId}/${encodeURIComponent(key)}`);
export const clearAllMemory = () => api.delete("/memory/all");
