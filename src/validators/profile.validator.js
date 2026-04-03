import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  age: z.number().int().min(0).max(150).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
