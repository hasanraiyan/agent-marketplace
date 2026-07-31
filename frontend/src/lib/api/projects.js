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

// Members (blueprint Phase 10 — already merged on the backend). v1 adds an
// existing Persona User by internal id only, no email lookup.
export const getProjectMembers = (projectId) =>
  api.get(`/projects/${projectId}/members`);
export const addProjectMember = (projectId, personaUserId) =>
  api.post(`/projects/${projectId}/members`, { personaUserId });
export const removeProjectMember = (projectId, personaUserId) =>
  api.delete(`/projects/${projectId}/members/${personaUserId}`);

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
export const getProjectSkills = (projectId) =>
  api.get(`/projects/${projectId}/skills`);
export const getProjectKnowledge = (projectId) =>
  api.get(`/projects/${projectId}/knowledge`);
export const getProjectMcps = (projectId) =>
  api.get(`/projects/${projectId}/mcps`);
export const getProjectProviders = (projectId) =>
  api.get(`/projects/${projectId}/providers`);

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

// Skill full CRUD (blueprint Phase 11.5, PR-60 — already merged on the
// backend). No single-item GET route — same find-by-id-from-list
// convention as Providers above.
export const createProjectSkill = (projectId, data) =>
  api.post(`/projects/${projectId}/skills`, data);
export const updateProjectSkill = (projectId, skillId, data) =>
  api.patch(`/projects/${projectId}/skills/${skillId}`, data);
export const deleteProjectSkill = (projectId, skillId) =>
  api.delete(`/projects/${projectId}/skills/${skillId}`);

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
