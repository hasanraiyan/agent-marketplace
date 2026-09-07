import { api } from "./core";

// Ported from frontend/src/lib/api/profile.js — the signed-in developer's
// own Persona account, not a Project resource.
export const getProfile = () => api.get("/profile");
export const updateProfile = (data: unknown) => api.patch("/profile", data);
export const deleteAccount = () => api.delete("/profile");
export const markOnboardingSeen = (section: string) =>
  api.post("/profile/onboarding", { section });
