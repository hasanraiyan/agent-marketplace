import { z } from 'zod';

export const createProviderSchema = z.object({
  label: z.string().min(1, 'Label is required').max(100),
  baseURL: z.string().url('Must be a valid URL'),
  apiKey: z.string().min(1, 'API Key is required'), // plain text coming in, encrypted before save
  defaultModel: z.string().min(1, 'Default Model is required'),
  isDefault: z.boolean().default(false),
});

export const updateProviderSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  defaultModel: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export const testConnectionSchema = z.object({
  baseURL: z.string().url('Must be a valid URL'),
  apiKey: z.string().min(1, 'API Key is required'),
});
