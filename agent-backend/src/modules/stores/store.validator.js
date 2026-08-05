import { z } from 'zod';

export const createStoreSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Name must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(1024).optional(),
  scope: z.enum(['domain', 'externalUser']),
  accessMode: z.enum(['readonly', 'readwrite']).optional(),
});

// `scope` is deliberately not updatable — see store.model.js's doc comment.
export const updateStoreSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(1024).optional(),
  accessMode: z.enum(['readonly', 'readwrite']).optional(),
});
