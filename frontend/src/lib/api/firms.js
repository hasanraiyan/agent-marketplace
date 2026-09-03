import { api } from "./core";

// ── Public marketplace / storefront ─────────────────────────────────────────
export const listFirms = (params) => api.get("/firms", { params });
export const getFirmStorefront = (slug) => api.get(`/firms/${slug}`);
export const getFirmProject = (slug, projectSlug) =>
  api.get(`/firms/${slug}/projects/${projectSlug}`);
export const startFirmProject = (slug, projectSlug, data) =>
  api.post(`/firms/${slug}/projects/${projectSlug}/start`, data);

// ── Owner (creator) ─────────────────────────────────────────────────────────
export const getMyFirm = () => api.get("/firms/me");
export const createFirm = (data) => api.post("/firms", data);
export const updateMyFirm = (data) => api.patch("/firms/me", data);
export const publishMyFirm = () => api.post("/firms/me/publish");
export const unpublishMyFirm = () => api.post("/firms/me/unpublish");

export const getMyFirmProjects = () => api.get("/firms/me/projects");
export const createFirmProjectTemplate = (data) =>
  api.post("/firms/me/projects", data);
export const updateFirmProjectTemplate = (id, data) =>
  api.patch(`/firms/me/projects/${id}`, data);
export const deleteFirmProjectTemplate = (id) =>
  api.delete(`/firms/me/projects/${id}`);

export const getMyFirmTeam = () => api.get("/firms/me/team");
export const updateMyFirmTeamMember = (agentId, data) =>
  api.patch(`/firms/me/team/${agentId}`, data);

export const getMyFirmClients = () => api.get("/firms/me/clients");
