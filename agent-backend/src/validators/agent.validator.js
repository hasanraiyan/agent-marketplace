import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').optional(),
  avatar: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  providerId: z.string().min(1, 'Provider ID is required'),
  modelName: z.string().min(1, 'Model name is required').optional(),
  webSearchEnabled: z.boolean().default(false),
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
  category: z
    .enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'])
    .default('other'),
  isActive: z.boolean().default(true),
});

export const updateAgentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  avatar: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).max(10).optional(),
  systemPrompt: z.string().min(10).optional(),
  providerId: z.string().min(1).optional(),
  modelName: z.string().min(1).optional(),
  webSearchEnabled: z.boolean().optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
  category: z
    .enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'])
    .optional(),
  isActive: z.boolean().optional(),
});

export const searchAgentSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z
    .enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'])
    .optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
  ownerId: z.string().optional(),
  sortBy: z
    .enum([
      'newest',
      'oldest',
      'popular',
      'popularity',
      'title_asc',
      'title_desc',
      'relevance',
      'rating',
    ])
    .default('newest'),
  tags: z.array(z.string()).optional(),
});

export const countAgentSchema = searchAgentSchema.omit({ page: true, limit: true, sortBy: true });
