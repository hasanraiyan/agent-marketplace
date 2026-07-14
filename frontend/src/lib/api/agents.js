import { api } from "./core";
import { getProfile } from "./profile";

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

// Returns the current user's Main Agent (their personal clone), or null if
// they haven't created one yet. Users can have many agents; only one is main.
export async function getMyMainAgent() {
  const profileRes = await getProfile();
  const profile = profileRes.data?.data || profileRes.data;
  const ownerId = profile?.id || profile?._id;
  if (!ownerId) return null;

  const res = await searchAgents({ ownerId, page: 1, limit: 100, sortBy: "newest" });
  const agents = res.data?.data || [];
  return agents.find((a) => a.isMainAgent) || null;
}
