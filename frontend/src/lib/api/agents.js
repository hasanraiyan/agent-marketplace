import { api } from "./core";

// Agent API functions
export const searchAgents = (data) => api.post("/agents/search", data);
export const countAgents = (data) => api.post("/agents/count", data);
export const getAgentBySlug = (slug) => api.get(`/agents/slug/${slug}`);
export const getAgent = (agentId) => api.get(`/agents/${agentId}`);
export const createAgent = (data) => api.post("/agents", data);
export const updateAgent = (agentId, data) =>
  api.patch(`/agents/${agentId}`, data);
export const deleteAgent = (agentId) => api.delete(`/agents/${agentId}`);
export const getAgentMemory = (agentId) => api.get(`/agents/${agentId}/memory`);
export const deleteAgentMemory = (agentId, key) =>
  api.delete(`/agents/${agentId}/memory/${key}`);
