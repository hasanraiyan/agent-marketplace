import { z } from 'zod';

export const createThreadSchema = z.object({
  agentId: z
    .string()
    .min(1, 'agentId is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid MongoDB ID'),
});

export const updateThreadTitleSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(100, 'Title is too long'),
});

export const streamMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message is too long (limit 4000 chars)'),
});
