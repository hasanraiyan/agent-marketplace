import { z } from 'zod';

export const createSkillSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Name must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().min(10).max(1024),
  instructions: z.string().min(10, 'Workflow instructions are required for Claude-style skills'),
  isPublic: z.boolean().optional(),
  codeSnippets: z
    .array(
      z.object({
        filename: z.string(),
        code: z.string(),
        language: z.string().optional(),
      })
    )
    .optional(),
});

export const updateSkillSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().min(10).max(1024).optional(),
  instructions: z.string().min(10).optional(),
  isPublic: z.boolean().optional(),
  codeSnippets: z
    .array(
      z.object({
        filename: z.string(),
        code: z.string(),
        language: z.string().optional(),
      })
    )
    .optional(),
});
