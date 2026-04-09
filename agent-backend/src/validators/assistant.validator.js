import { z } from 'zod';

export const assistantVisibilityEnum = z.enum(['private', 'unlisted', 'public']);
export const assistantStatusEnum = z.enum(['draft', 'published']);

const baseAssistantSchema = z.object({
  name: z.string().min(2).max(120),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  systemPrompt: z.string().max(8000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  visibility: assistantVisibilityEnum.optional(),
  status: assistantStatusEnum.optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const createAssistantSchema = baseAssistantSchema.extend({
  name: z.string().min(2).max(120),
});

export const updateAssistantSchema = baseAssistantSchema.partial();

export const assistantIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listMyAssistantsQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

export const listPublicAssistantsQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});
