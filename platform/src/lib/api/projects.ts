import { api } from "./core";

// Developer Platform — Project API functions (Clerk session, never the
// Project's own minted API credential; Studio and the SDK are two
// deliberately separate access paths). Ported 1:1 from
// frontend/src/lib/api/projects.js — this is the entire admin surface a
// developer dashboard needs, so platform/ reuses it rather than
// re-deriving it against the same backend routes.
export const getProjects = () => api.get("/projects");
export const createProject = (data: unknown) => api.post("/projects", data);
export const getProject = (projectId: string) => api.get(`/projects/${projectId}`);
export const updateProject = (projectId: string, data: unknown) =>
  api.patch(`/projects/${projectId}`, data);

// Lifecycle
export const suspendProject = (projectId: string) =>
  api.post(`/projects/${projectId}/suspend`);
export const reactivateProject = (projectId: string) =>
  api.post(`/projects/${projectId}/reactivate`);
export const requestProjectDeletion = (projectId: string) =>
  api.post(`/projects/${projectId}/delete`);
export const cancelProjectDeletion = (projectId: string) =>
  api.post(`/projects/${projectId}/cancel-deletion`);

// Members. The backend accepts exactly one of { personaUserId } or
// { email }, so Studio's "Add Admin" dialog can invite by email — no DB
// access needed to look up internal ids.
export const getProjectMembers = (projectId: string) =>
  api.get(`/projects/${projectId}/members`);
export const addProjectMember = (projectId: string, payload: unknown) =>
  api.post(`/projects/${projectId}/members`, payload);
export const searchProjectMembers = (projectId: string, q: string) =>
  api.get(`/projects/${projectId}/members/search`, { params: { q } });
export const removeProjectMember = (projectId: string, personaUserId: string) =>
  api.delete(`/projects/${projectId}/members/${personaUserId}`);

// Invitations — invite someone without a Persona account yet. Clerk owns
// the email + accept flow; these track/revoke from Studio.
export const inviteProjectMember = (projectId: string, email: string) =>
  api.post(`/projects/${projectId}/members/invitations`, { email });
export const getProjectInvitations = (projectId: string) =>
  api.get(`/projects/${projectId}/members/invitations`);
export const revokeProjectInvitation = (projectId: string, invitationId: string) =>
  api.delete(`/projects/${projectId}/members/invitations/${invitationId}`);

// Credentials. Minting returns the plaintext secret exactly once — never
// retrievable again after that response.
export const getProjectCredentials = (projectId: string) =>
  api.get(`/projects/${projectId}/credentials`);
export const mintProjectCredential = (projectId: string, label?: string) =>
  api.post(`/projects/${projectId}/credentials`, label ? { label } : {});
export const revokeProjectCredential = (projectId: string, credentialId: string) =>
  api.delete(`/projects/${projectId}/credentials/${credentialId}`);

// Resource browsing. Studio is a second, independent, full capability path
// to a Project's own resources, parallel to the SDK, not a read-only
// sibling.
export const getProjectAgents = (projectId: string) =>
  api.get(`/projects/${projectId}/agents`);
// Voice Agents — mints a single-use voice session ticket for the Agent
// Test playground's Voice tab. Clerk + projectAdminAuthMiddleware, same as
// every other admin call on this page — never a Project credential.
export const createProjectAgentVoiceSession = (projectId: string, agentId: string) =>
  api.post(`/projects/${projectId}/agents/${agentId}/test/voice/sessions`);
export const getProjectSkills = (projectId: string) =>
  api.get(`/projects/${projectId}/skills`);
export const getProjectKnowledge = (projectId: string) =>
  api.get(`/projects/${projectId}/knowledge`);
export const getProjectMcps = (projectId: string) =>
  api.get(`/projects/${projectId}/mcps`);
export const getProjectProviders = (projectId: string) =>
  api.get(`/projects/${projectId}/providers`);
export const getProjectStores = (projectId: string) =>
  api.get(`/projects/${projectId}/stores`);

// Provider full CRUD. No single-item GET route exists — find by id from
// the already-fetched list.
export const createProjectProvider = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/providers`, data);
export const updateProjectProvider = (projectId: string, providerId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/providers/${providerId}`, data);
export const deleteProjectProvider = (projectId: string, providerId: string) =>
  api.delete(`/projects/${projectId}/providers/${providerId}`);
export const testProjectProviderConnection = (projectId: string, providerId: string) =>
  api.post(`/projects/${projectId}/providers/${providerId}/test-connection`);
export const getProjectProviderModels = (projectId: string, providerId: string) =>
  api.get(`/projects/${projectId}/providers/${providerId}/models`);
export const getProjectProviderUsage = (projectId: string, providerId: string) =>
  api.get(`/projects/${projectId}/providers/${providerId}/usage`);
export const bulkDeleteProjectProviders = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/providers/bulk-delete`, { ids });
// Pre-save credential test — proxies to POST /providers/test-connection (persona scope, no project needed).
// Mirrors frontend/src/lib/api/providers.js testProviderCredentials used by developer provider editor.
export const testProviderCredentials = (type: string, baseURL: string | undefined, apiKey: string) =>
  api.post("/providers/test-connection", { type, baseURL, apiKey });

// Skill full CRUD. No single-item GET route — same find-by-id-from-list
// convention as Providers above.
export const createProjectSkill = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/skills`, data);
export const updateProjectSkill = (projectId: string, skillId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/skills/${skillId}`, data);
export const deleteProjectSkill = (projectId: string, skillId: string) =>
  api.delete(`/projects/${projectId}/skills/${skillId}`);
export const getProjectSkillUsage = (projectId: string, skillId: string) =>
  api.get(`/projects/${projectId}/skills/${skillId}/usage`);
export const bulkDeleteProjectSkills = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/skills/bulk-delete`, { ids });

// Store full CRUD (named, scoped mount points assignable to Agents via
// storeMounts). No single-item GET route. `scope` cannot be changed after
// creation — omit it from update calls.
export const createProjectStore = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/stores`, data);
export const updateProjectStore = (projectId: string, storeId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/stores/${storeId}`, data);
export const deleteProjectStore = (projectId: string, storeId: string) =>
  api.delete(`/projects/${projectId}/stores/${storeId}`);

// Knowledge Base full CRUD + document management. No single-item GET
// route.
export const createProjectKnowledge = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/knowledge`, data);
export const updateProjectKnowledge = (projectId: string, kbId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/knowledge/${kbId}`, data);
export const deleteProjectKnowledge = (projectId: string, kbId: string) =>
  api.delete(`/projects/${projectId}/knowledge/${kbId}`);
export const getProjectKnowledgeDocuments = (projectId: string, kbId: string) =>
  api.get(`/projects/${projectId}/knowledge/${kbId}/documents`);
export const uploadProjectKnowledgeDocuments = (projectId: string, kbId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return api.post(`/projects/${projectId}/knowledge/${kbId}/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const deleteProjectKnowledgeDocument = (projectId: string, kbId: string, sourceName: string) =>
  api.delete(`/projects/${projectId}/knowledge/${kbId}/documents/${encodeURIComponent(sourceName)}`);
export const getProjectKnowledgeUsage = (projectId: string, kbId: string) =>
  api.get(`/projects/${projectId}/knowledge/${kbId}/usage`);
export const bulkDeleteProjectKnowledge = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/knowledge/bulk-delete`, { ids });
export const searchProjectKnowledge = (projectId: string, kbId: string, query: string, topK?: number) =>
  api.post(`/projects/${projectId}/knowledge/${kbId}/search`, { query, topK });

// MCP full CRUD + OAuth owner-connect. No single-item GET route. Per-user
// OAuth (authMode: "user") stays SDK/ProjectRuntime-only — that's this
// Project's own external end-users connecting their own OAuth, not
// something a Project Admin does from Studio.
export const createProjectMcp = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/mcps`, data);
export const updateProjectMcp = (projectId: string, mcpId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/mcps/${mcpId}`, data);
export const deleteProjectMcp = (projectId: string, mcpId: string) =>
  api.delete(`/projects/${projectId}/mcps/${mcpId}`);
// returnApp=platform tells the backend's shared owner-callback (used by
// both this app and frontend/'s legacy /developer/... Studio) to land the
// browser back on THIS app's domain/route shape after OAuth completes —
// see agent-backend mcp.service.js's `_ownerRedirectBase`.
export const getProjectMcpOwnerAuthorizeUrl = (projectId: string, mcpId: string) =>
  api.get(`/projects/${projectId}/mcps/${mcpId}/oauth/owner/authorize`, {
    params: { returnApp: "platform" },
  });
export const disconnectProjectMcpOwnerConnection = (projectId: string, mcpId: string) =>
  api.delete(`/projects/${projectId}/mcps/${mcpId}/oauth/owner/connection`);
export const getProjectMcpUsage = (projectId: string, mcpId: string) =>
  api.get(`/projects/${projectId}/mcps/${mcpId}/usage`);
export const bulkDeleteProjectMcps = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/mcps/bulk-delete`, { ids });

// Agent full CRUD — structured form only. No single-item GET route.
export const createProjectAgent = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/agents`, data);
export const updateProjectAgent = (projectId: string, agentId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/agents/${agentId}`, data);
export const deleteProjectAgent = (projectId: string, agentId: string) =>
  api.delete(`/projects/${projectId}/agents/${agentId}`);
export const bulkDeleteProjectAgents = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/agents/bulk-delete`, { ids });

// Audit logs — Project-lifecycle events only (credential minted/revoked,
// membership changes, suspend/restore), not resource CRUD.
export const getProjectAuditLogs = (projectId: string, params?: unknown) =>
  api.get(`/projects/${projectId}/audit-logs`, { params });

// REST API Tool Builder — no single-item GET route.
export const getProjectRestTools = (projectId: string) =>
  api.get(`/projects/${projectId}/rest-tools`);
export const createProjectRestTool = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/rest-tools`, data);
export const updateProjectRestTool = (projectId: string, toolId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/rest-tools/${toolId}`, data);
export const deleteProjectRestTool = (projectId: string, toolId: string) =>
  api.delete(`/projects/${projectId}/rest-tools/${toolId}`);
export const getProjectRestToolUsage = (projectId: string, toolId: string) =>
  api.get(`/projects/${projectId}/rest-tools/${toolId}/usage`);
export const bulkDeleteProjectRestTools = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/rest-tools/bulk-delete`, { ids });
// Backs the builder's "Send" button — pass either { toolId } (a saved
// tool) or { draft } (unsaved form state), plus optional testValues (may
// include externalUserId as a stand-in for testing a {{externalUserId}}
// tool).
export const testProjectRestTool = (
  projectId: string,
  { toolId, draft, testValues }: { toolId?: string; draft?: unknown; testValues?: unknown } = {}
) => api.post(`/projects/${projectId}/rest-tools/test`, { toolId, draft, testValues });

// RCP (REST Connector Protocol, npm `rcp-sdk`) Sources — same
// registration/Test Connection pattern.
export const getProjectRcpSources = (projectId: string) =>
  api.get(`/projects/${projectId}/rcp-sources`);
export const createProjectRcpSource = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/rcp-sources`, data);
export const updateProjectRcpSource = (projectId: string, sourceId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/rcp-sources/${sourceId}`, data);
export const deleteProjectRcpSource = (projectId: string, sourceId: string) =>
  api.delete(`/projects/${projectId}/rcp-sources/${sourceId}`);
export const getProjectRcpSourceUsage = (projectId: string, sourceId: string) =>
  api.get(`/projects/${projectId}/rcp-sources/${sourceId}/usage`);
export const bulkDeleteProjectRcpSources = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/rcp-sources/bulk-delete`, { ids });
export const testProjectRcpSource = (projectId: string, sourceId: string) =>
  api.post(`/projects/${projectId}/rcp-sources/${sourceId}/test`);

// Project secrets (REST API Tool Builder's Auth tab) — the value is never
// returned by any of these, including create; the caller already has it.
export const getProjectSecrets = (projectId: string) =>
  api.get(`/projects/${projectId}/secrets`);
export const createProjectSecret = (projectId: string, data: unknown) =>
  api.post(`/projects/${projectId}/secrets`, data);
export const updateProjectSecret = (projectId: string, secretId: string, data: unknown) =>
  api.patch(`/projects/${projectId}/secrets/${secretId}`, data);
export const deleteProjectSecret = (projectId: string, secretId: string) =>
  api.delete(`/projects/${projectId}/secrets/${secretId}`);
export const getProjectSecretUsage = (projectId: string, secretId: string) =>
  api.get(`/projects/${projectId}/secrets/${secretId}/usage`);
export const bulkDeleteProjectSecrets = (projectId: string, ids: string[]) =>
  api.post(`/projects/${projectId}/secrets/bulk-delete`, { ids });
