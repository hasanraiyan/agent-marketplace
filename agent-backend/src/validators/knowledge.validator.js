import { z } from 'zod';

export const createKnowledgeBaseSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be under 200 characters'),
  description: z.string().max(1000, 'Description must be under 1000 characters').optional(),
  isPublic: z.boolean().optional(),
});

export const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export const searchKnowledgeBaseSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  topK: z.coerce.number().int().min(1).max(50).optional(),
});
