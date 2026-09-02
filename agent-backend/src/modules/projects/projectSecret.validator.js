import { z } from 'zod';

export const createProjectSecretSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1),
});

export const updateProjectSecretSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    value: z.string().min(1).optional(),
  })
  .refine((data) => data.label !== undefined || data.value !== undefined, {
    message: 'At least one of label or value is required',
  });
