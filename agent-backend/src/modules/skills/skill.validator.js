import { z } from 'zod';
import { validateSkillFiles } from './skillValidation.js';
import { SKILL_CATEGORIES } from './skill.model.js';

const skillFileSchema = z.object({
  path: z.string().min(1).max(256),
  content: z.string(),
  mimeType: z.string().optional(),
});

/**
 * Validate the files bundle
 * (safe relative paths, per-file and total size limits, no SKILL.md).
 */
function validateFiles(data, ctx) {
  const files = data.files;
  if (!files) return data;

  const result = validateSkillFiles(files, { instructions: data.instructions ?? '' });
  if (result.errors.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['files'],
      message: result.errors.join(' '),
    });
    return data;
  }
  return { ...data, files: result.files };
}

export const createSkillSchema = z
  .object({
    name: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/, 'Name must contain only lowercase letters, numbers, and hyphens'),
    description: z.string().min(10).max(1024),
    instructions: z
      .string()
      .min(10, 'Workflow instructions are required for Claude-style skills')
      .max(50000),
    isPublic: z.boolean().optional(),
    title: z.string().max(120).optional(),
    hook: z.string().max(200).optional(),
    coverImage: z.string().max(2000).optional(),
    category: z.enum(SKILL_CATEGORIES).optional(),
    tags: z.array(z.string().max(40)).max(12).optional(),
    visibility: z.enum(['public', 'unlisted', 'private']).optional(),
    files: z.array(skillFileSchema).optional(),
  })
  .transform(validateFiles);

export const updateSkillSchema = z
  .object({
    name: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    description: z.string().min(10).max(1024).optional(),
    instructions: z.string().min(10).max(50000).optional(),
    isPublic: z.boolean().optional(),
    title: z.string().max(120).optional(),
    hook: z.string().max(200).optional(),
    coverImage: z.string().max(2000).optional(),
    category: z.enum(SKILL_CATEGORIES).optional(),
    tags: z.array(z.string().max(40)).max(12).optional(),
    visibility: z.enum(['public', 'unlisted', 'private']).optional(),
    files: z.array(skillFileSchema).optional(),
  })
  .transform(validateFiles);
