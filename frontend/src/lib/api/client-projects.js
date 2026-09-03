import { api } from "./core";

// ── Client side: projects I bought ──────────────────────────────────────────
export const getMyClientProjects = () => api.get("/client-projects");
export const getMyFirms = () => api.get("/client-projects/firms");
export const getClientProject = (id) => api.get(`/client-projects/${id}`);
export const respondToProjectRequest = (id, itemId, data) =>
  api.post(`/client-projects/${id}/inbox/${itemId}/respond`, data);
export const acceptProjectDeliverable = (id, index) =>
  api.post(`/client-projects/${id}/deliverables/${index}/accept`);
