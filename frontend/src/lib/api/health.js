import { api } from "./core";

// Health API functions
export const getHealth = () => api.get("/health");
export const getDbHealth = () => api.get("/health/db");
