import { api } from "./core";

// Developer Platform — Project API functions (Clerk session, never the
// Project's own minted API credential; Studio and the SDK are two
// deliberately separate access paths).
export const getProjects = () => api.get("/projects");
export const createProject = (data) => api.post("/projects", data);
export const getProject = (projectId) => api.get(`/projects/${projectId}`);
export const updateProject = (projectId, data) =>
  api.patch(`/projects/${projectId}`, data);

// Lifecycle (blueprint Phase 10, PR-49/50/52 — already merged on the backend)
export const suspendProject = (projectId) =>
  api.post(`/projects/${projectId}/suspend`);
export const reactivateProject = (projectId) =>
  api.post(`/projects/${projectId}/reactivate`);
export const requestProjectDeletion = (projectId) =>
  api.post(`/projects/${projectId}/delete`);
export const cancelProjectDeletion = (projectId) =>
  api.post(`/projects/${projectId}/cancel-deletion`);

// Members (blueprint Phase 10 — already merged on the backend; email invite
// + email search added later). The backend accepts exactly one of
// { personaUserId } or { email }, so Studio's "Add Admin" dialog can invite
// by email — no DB access needed to look up internal ids.
export const getProjectMembers = (projectId) =>
  api.get(`/projects/${projectId}/members`);
export const addProjectMember = (projectId, payload) =>
  api.post(`/projects/${projectId}/members`, payload);
export const searchProjectMembers = (projectId, q) =>
  api.get(`/projects/${projectId}/members/search`, { params: { q } });
export const removeProjectMember = (projectId, personaUserId) =>
  api.delete(`/projects/${projectId}/members/${personaUserId}`);

// Invitations (AD-08 §11) — invite someone without a Persona account yet.
// Clerk owns the email + accept flow; these track/revoke from Studio.
export const inviteProjectMember = (projectId, email) =>
  api.post(`/projects/${projectId}/members/invitations`, { email });
export const getProjectInvitations = (projectId) =>
  api.get(`/projects/${projectId}/members/invitations`);
export const revokeProjectInvitation = (projectId, invitationId) =>
  api.delete(`/projects/${projectId}/members/invitations/${invitationId}`);

// Credentials (blueprint Phase 10 — already merged on the backend). Minting
// returns the plaintext secret exactly once (AD-01 §9.2) — never retrievable
// again after that response.
export const getProjectCredentials = (projectId) =>
  api.get(`/projects/${projectId}/credentials`);
export const mintProjectCredential = (projectId, label) =>
  api.post(`/projects/${projectId}/credentials`, label ? { label } : {});
export const revokeProjectCredential = (projectId, credentialId) =>
  api.delete(`/projects/${projectId}/credentials/${credentialId}`);

// Resource browsing (blueprint Phase 11, PR-55 — already merged on the
// backend). Phase 11.5 (PR-60+) added full create/edit/delete siblings
// below — Studio is now a second, independent, full capability path to a
// Project's own resources, parallel to the SDK, not a read-only sibling.
export const getProjectAgents = (projectId) =>
  api.get(`/projects/${projectId}/agents`);
// Voice Agents (voice-agent-plan.md §7 route (b), §13.1) — mints a
// single-use voice session ticket for the Agent Test playground's Voice
// tab. Clerk + projectAdminAuthMiddleware, same as every other admin call
// on this page — never a Project credential.
export const createProjectAgentVoiceSession = (projectId, agentId) =>
  api.post(`/projects/${projectId}/agents/${agentId}/test/voice/sessions`);
export const getProjectSkills = (projectId) =>
  api.get(`/projects/${projectId}/skills`);
export const getProjectKnowledge = (projectId) =>
  api.get(`/projects/${projectId}/knowledge`);
export const getProjectMcps = (projectId) =>
  api.get(`/projects/${projectId}/mcps`);
export const getProjectProviders = (projectId) =>
  api.get(`/projects/${projectId}/providers`);
export const getProjectStores = (projectId) =>
  api.get(`/projects/${projectId}/stores`);

// Provider full CRUD (blueprint Phase 11.5, PR-60 — already merged on the
// backend). No single-item GET route exists — same convention as
// studio/(resources)/providers/[id]/edit/page.jsx, find by id from the
// already-fetched list.
export const createProjectProvider = (projectId, data) =>
  api.post(`/projects/${projectId}/providers`, data);
export const updateProjectProvider = (projectId, providerId, data) =>
  api.patch(`/projects/${projectId}/providers/${providerId}`, data);
export const deleteProjectProvider = (projectId, providerId) =>
  api.delete(`/projects/${projectId}/providers/${providerId}`);
export const testProjectProviderConnection = (projectId, providerId) =>
  api.post(`/projects/${projectId}/providers/${providerId}/test-connection`);
export const getProjectProviderModels = (projectId, providerId) =>
  api.get(`/projects/${projectId}/providers/${providerId}/models`);
export const getProjectProviderUsage = (projectId, providerId) =>
  api.get(`/projects/${projectId}/providers/${providerId}/usage`);
export const bulkDeleteProjectProviders = (projectId, ids) =>
  api.post(`/projects/${projectId}/providers/bulk-delete`, { ids });

// Skill full CRUD (blueprint Phase 11.5, PR-60 — already merged on the
// backend). No single-item GET route — same find-by-id-from-list
// convention as Providers above.
export const createProjectSkill = (projectId, data) =>
  api.post(`/projects/${projectId}/skills`, data);
export const updateProjectSkill = (projectId, skillId, data) =>
  api.patch(`/projects/${projectId}/skills/${skillId}`, data);
export const deleteProjectSkill = (projectId, skillId) =>
  api.delete(`/projects/${projectId}/skills/${skillId}`);
export const getProjectSkillUsage = (projectId, skillId) =>
  api.get(`/projects/${projectId}/skills/${skillId}/usage`);
export const bulkDeleteProjectSkills = (projectId, ids) =>
  api.post(`/projects/${projectId}/skills/bulk-delete`, { ids });

// Store full CRUD (named, scoped mount points assignable to Agents via
// storeMounts). No single-item GET route — same find-by-id-from-list
// convention as Providers/Skills above. `scope` cannot be changed after
// creation — omit it from update calls.
export const createProjectStore = (projectId, data) =>
  api.post(`/projects/${projectId}/stores`, data);
export const updateProjectStore = (projectId, storeId, data) =>
  api.patch(`/projects/${projectId}/stores/${storeId}`, data);
export const deleteProjectStore = (projectId, storeId) =>
  api.delete(`/projects/${projectId}/stores/${storeId}`);

// Knowledge Base full CRUD + document management (blueprint Phase 11.5,
// PR-60 — already merged on the backend). No single-item GET route — same
// find-by-id-from-list convention as Providers/Skills above.
export const createProjectKnowledge = (projectId, data) =>
  api.post(`/projects/${projectId}/knowledge`, data);
export const updateProjectKnowledge = (projectId, kbId, data) =>
  api.patch(`/projects/${projectId}/knowledge/${kbId}`, data);
export const deleteProjectKnowledge = (projectId, kbId) =>
  api.delete(`/projects/${projectId}/knowledge/${kbId}`);
export const getProjectKnowledgeDocuments = (projectId, kbId) =>
  api.get(`/projects/${projectId}/knowledge/${kbId}/documents`);
export const uploadProjectKnowledgeDocuments = (projectId, kbId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return api.post(
    `/projects/${projectId}/knowledge/${kbId}/documents`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
};
export const deleteProjectKnowledgeDocument = (projectId, kbId, sourceName) =>
  api.delete(
    `/projects/${projectId}/knowledge/${kbId}/documents/${encodeURIComponent(sourceName)}`,
  );
export const getProjectKnowledgeUsage = (projectId, kbId) =>
  api.get(`/projects/${projectId}/knowledge/${kbId}/usage`);
export const bulkDeleteProjectKnowledge = (projectId, ids) =>
  api.post(`/projects/${projectId}/knowledge/bulk-delete`, { ids });
export const searchProjectKnowledge = (projectId, kbId, query, topK) =>
  api.post(`/projects/${projectId}/knowledge/${kbId}/search`, { query, topK });

// MCP full CRUD + OAuth owner-connect (blueprint Phase 11.5, PR-60 —
// already merged on the backend). No single-item GET route — same
// find-by-id-from-list convention as the other resource types above.
// Per-user OAuth (authMode: "user") stays SDK/ProjectRuntime-only — that's
// this Project's own external end-users connecting their own OAuth, not
// something a Project Admin does from Studio.
export const createProjectMcp = (projectId, data) =>
  api.post(`/projects/${projectId}/mcps`, data);
export const updateProjectMcp = (projectId, mcpId, data) =>
  api.patch(`/projects/${projectId}/mcps/${mcpId}`, data);
export const deleteProjectMcp = (projectId, mcpId) =>
  api.delete(`/projects/${projectId}/mcps/${mcpId}`);
export const getProjectMcpOwnerAuthorizeUrl = (projectId, mcpId) =>
  api.get(`/projects/${projectId}/mcps/${mcpId}/oauth/owner/authorize`);
export const disconnectProjectMcpOwnerConnection = (projectId, mcpId) =>
  api.delete(`/projects/${projectId}/mcps/${mcpId}/oauth/owner/connection`);
export const getProjectMcpUsage = (projectId, mcpId) =>
  api.get(`/projects/${projectId}/mcps/${mcpId}/usage`);
export const bulkDeleteProjectMcps = (projectId, ids) =>
  api.post(`/projects/${projectId}/mcps/bulk-delete`, { ids });

// Agent full CRUD — structured form only (blueprint Phase 11.5, PR-61 —
// already merged on the backend). No single-item GET route — same
// find-by-id-from-list convention as the other resource types above. The
// Project Agent Architect co-pilot (PR-62 backend, PR-68 frontend) is a
// separate, additive way to build an Agent — not required to use this form.
export const createProjectAgent = (projectId, data) =>
  api.post(`/projects/${projectId}/agents`, data);
export const updateProjectAgent = (projectId, agentId, data) =>
  api.patch(`/projects/${projectId}/agents/${agentId}`, data);
export const deleteProjectAgent = (projectId, agentId) =>
  api.delete(`/projects/${projectId}/agents/${agentId}`);
export const bulkDeleteProjectAgents = (projectId, ids) =>
  api.post(`/projects/${projectId}/agents/bulk-delete`, { ids });

// Audit logs (Feature 6) — Project-lifecycle events only (credential
// minted/revoked, membership changes, suspend/restore), not resource CRUD.
export const getProjectAuditLogs = (projectId, params) =>
  api.get(`/projects/${projectId}/audit-logs`, { params });

// REST API Tool Builder (PERSONA_REST_TOOL_REQUEST.md) — no single-item GET
// route, same find-by-id-from-list convention as MCP/Agent above.
export const getProjectRestTools = (projectId) =>
  api.get(`/projects/${projectId}/rest-tools`);
export const createProjectRestTool = (projectId, data) =>
  api.post(`/projects/${projectId}/rest-tools`, data);
export const updateProjectRestTool = (projectId, toolId, data) =>
  api.patch(`/projects/${projectId}/rest-tools/${toolId}`, data);
export const deleteProjectRestTool = (projectId, toolId) =>
  api.delete(`/projects/${projectId}/rest-tools/${toolId}`);
export const getProjectRestToolUsage = (projectId, toolId) =>
  api.get(`/projects/${projectId}/rest-tools/${toolId}/usage`);
export const bulkDeleteProjectRestTools = (projectId, ids) =>
  api.post(`/projects/${projectId}/rest-tools/bulk-delete`, { ids });
// Backs the builder's "Send" button — pass either { toolId } (a saved tool)
// or { draft } (unsaved form state), plus optional testValues (may include
// externalUserId as a stand-in for testing a {{externalUserId}} tool).
export const testProjectRestTool = (
  projectId,
  { toolId, draft, testValues } = {},
) =>
  api.post(`/projects/${projectId}/rest-tools/test`, {
    toolId,
    draft,
    testValues,
  });

// REST API Tool Sources — a hosted manifest URL (mirrors MCP: register a
// URL + optional API key, Test Connection pulls and stores a display-only
// tool summary). No single-item GET route, same find-by-id-from-list
// convention as MCP/REST Tools above.
export const getProjectRestToolSources = (projectId) =>
  api.get(`/projects/${projectId}/rest-tool-sources`);
export const createProjectRestToolSource = (projectId, data) =>
  api.post(`/projects/${projectId}/rest-tool-sources`, data);
export const updateProjectRestToolSource = (projectId, sourceId, data) =>
  api.patch(`/projects/${projectId}/rest-tool-sources/${sourceId}`, data);
export const deleteProjectRestToolSource = (projectId, sourceId) =>
  api.delete(`/projects/${projectId}/rest-tool-sources/${sourceId}`);
export const getProjectRestToolSourceUsage = (projectId, sourceId) =>
  api.get(`/projects/${projectId}/rest-tool-sources/${sourceId}/usage`);
export const bulkDeleteProjectRestToolSources = (projectId, ids) =>
  api.post(`/projects/${projectId}/rest-tool-sources/bulk-delete`, { ids });
export const testProjectRestToolSource = (projectId, sourceId) =>
  api.post(`/projects/${projectId}/rest-tool-sources/${sourceId}/test`);

// Project secrets (REST API Tool Builder's Auth tab) — the value is never
// returned by any of these, including create; the caller already has it.
export const getProjectSecrets = (projectId) =>
  api.get(`/projects/${projectId}/secrets`);
export const createProjectSecret = (projectId, data) =>
  api.post(`/projects/${projectId}/secrets`, data);
export const updateProjectSecret = (projectId, secretId, data) =>
  api.patch(`/projects/${projectId}/secrets/${secretId}`, data);
export const deleteProjectSecret = (projectId, secretId) =>
  api.delete(`/projects/${projectId}/secrets/${secretId}`);
export const getProjectSecretUsage = (projectId, secretId) =>
  api.get(`/projects/${projectId}/secrets/${secretId}/usage`);
export const bulkDeleteProjectSecrets = (projectId, ids) =>
  api.post(`/projects/${projectId}/secrets/bulk-delete`, { ids });
