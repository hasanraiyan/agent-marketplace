import { api } from "./core";

// Knowledge Base API functions
export const getMyKnowledgeBases = () => api.get("/knowledge");
export const createKnowledgeBase = (data) => api.post("/knowledge", data);
export const getKnowledgeBase = (kbId) => api.get(`/knowledge/${kbId}`);
export const deleteKnowledgeBase = (kbId) => api.delete(`/knowledge/${kbId}`);
export const uploadFiles = (kbId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return api.post(`/knowledge/${kbId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const getKnowledgeDocuments = (kbId) =>
  api.get(`/knowledge/${kbId}/documents`);
export const deleteDocument = (kbId, sourceName) =>
  api.delete(`/knowledge/${kbId}/documents/${encodeURIComponent(sourceName)}`);
export const searchKnowledgeBase = (kbId, query, topK) =>
  api.post(`/knowledge/${kbId}/search`, { query, topK });
export const updateKnowledgeBase = (kbId, data) =>
  api.patch(`/knowledge/${kbId}`, data);

