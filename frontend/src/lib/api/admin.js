import { api } from "./core";

// Admin API functions
export const getUsers = () => api.get("/admin/users");
export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);
