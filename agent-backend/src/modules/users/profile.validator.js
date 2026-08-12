import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  age: z.number().int().min(0).max(150).optional(),
});

// Keep in sync with the onboarding tours actually defined on the frontend
// (frontend/src/components/onboarding/onboarding-tours.js).
export const ONBOARDING_SECTIONS = ['dashboard', 'studio', 'developer', 'developerProject'];

export const markOnboardingSeenSchema = z.object({
  section: z.enum(ONBOARDING_SECTIONS),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});
