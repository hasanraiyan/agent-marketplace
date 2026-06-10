import { api } from "./core";

// Skill API functions
export const getPublicSkills = () => api.get("/skills/public");
export const getMySkills = () => api.get("/skills");
export const searchSkills = (params) => api.get("/skills/search", { params });
export const createSkill = (data) => api.post("/skills", data);
export const getSkill = (skillId) => api.get(`/skills/${skillId}`);
export const updateSkill = (skillId, data) =>
  api.patch(`/skills/${skillId}`, data);
export const deleteSkill = (skillId) => api.delete(`/skills/${skillId}`);
export const getUsedByAgents = (skillId) => api.get(`/skills/${skillId}/agents`);
