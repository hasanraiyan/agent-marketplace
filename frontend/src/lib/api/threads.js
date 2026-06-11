import { api } from "./core";

// Thread API functions
export const createThread = (data) => api.post("/threads", data);
export const getThreads = (params) => api.get("/threads", { params });
export const getThread = (threadId) => api.get(`/threads/${threadId}`);
export const deleteThread = (threadId) => api.delete(`/threads/${threadId}`);
export const deleteAllThreads = () => api.delete("/threads");
export const updateThreadTitle = (threadId, data) =>
  api.patch(`/threads/${threadId}/title`, data);
export const getThreadMessages = (threadId) =>
  api.get(`/threads/${threadId}/messages`);
