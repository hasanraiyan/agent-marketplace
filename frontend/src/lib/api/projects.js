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
