import { api } from "./core";

// Provider API functions
export const getProviders = () => api.get("/providers");
export const createProvider = (data) => api.post("/providers", data);
export const testProviderConnection = (providerId) =>
  api.post(`/providers/${providerId}/test`);
export const updateProvider = (providerId, data) =>
  api.put(`/providers/${providerId}`, data);
export const deleteProvider = (providerId) =>
  api.delete(`/providers/${providerId}`);
