import { api } from "./core";

// Profile API functions
export const getProfile = () => api.get("/profile");
export const updateProfile = (data) => api.patch("/profile", data);
export const deleteAccount = () => api.delete("/profile");
export const markOnboardingSeen = (section) =>
  api.post("/profile/onboarding", { section });
