import { api } from "./core";

// MCP connector API functions
export const getMyMcps = () => api.get("/mcps");
export const createMcp = (data) => api.post("/mcps", data);
export const getMcp = (mcpId) => api.get(`/mcps/${mcpId}`);
export const updateMcp = (mcpId, data) => api.patch(`/mcps/${mcpId}`, data);
export const deleteMcp = (mcpId) => api.delete(`/mcps/${mcpId}`);
export const getUsedByAgents = (mcpId) => api.get(`/mcps/${mcpId}/agents`);
export const testMcp = (mcpId) => api.post(`/mcps/${mcpId}/test`);

export const getOwnerAuthorizeUrl = (mcpId) =>
  api.get(`/mcps/${mcpId}/oauth/owner/authorize`);
export const getUserAuthorizeUrl = (mcpId, returnTo) =>
  api.get(`/mcps/${mcpId}/oauth/user/authorize`, { params: { returnTo } });
export const getUserConnectionStatus = (mcpId) =>
  api.get(`/mcps/${mcpId}/oauth/user/status`);
export const disconnectUserConnection = (mcpId) =>
  api.delete(`/mcps/${mcpId}/oauth/user/connection`);
