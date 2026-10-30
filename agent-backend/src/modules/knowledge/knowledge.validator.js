import { z } from 'zod';

// `embeddingDimensions` is the MRL truncation target (e.g. 768 → 512 for
// text-embedding-3-* / embeddinggemma-2). Omit it to use the model's native
// dimensionality. When supplied, the service probes the provider with that
// exact value and rejects the request if the provider ignores it.
const embeddingDimensions = z.coerce
  .number()
  .int('Dimensions must be a whole number')
  .min(64, 'Dimensions must be at least 64')
  .max(8192, 'Dimensions must be at most 8192')
  .optional();

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be under 200 characters'),
  description: z.string().max(1000, 'Description must be under 1000 characters').optional(),
  isPublic: z.boolean().optional(),
  embeddingModel: z.string().min(1).optional(),
  embeddingDimensions,
  providerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid provider ID')
    .optional(),
  chunkSize: z.coerce.number().int().min(1).optional(),
  chunkOverlap: z.coerce.number().int().min(0).optional(),
  topK: z.coerce.number().int().min(1).optional(),
});

export const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
  embeddingModel: z.string().min(1).optional(),
  embeddingDimensions,
  providerId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid provider ID')
    .optional(),
  chunkSize: z.coerce.number().int().min(1).optional(),
  chunkOverlap: z.coerce.number().int().min(0).optional(),
  topK: z.coerce.number().int().min(1).optional(),
});

export const searchKnowledgeBaseSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  topK: z.coerce.number().int().min(1).max(50).optional(),
});
