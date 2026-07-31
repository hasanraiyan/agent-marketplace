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
