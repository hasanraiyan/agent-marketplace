import { z } from 'zod';
import { PROVIDER_TYPES } from './provider.constants.js';

// baseURL is required only for 'custom' — the other types get a canonical
// preset filled in server-side (provider.service.js) when omitted.
const requireBaseUrlForCustom = (data, ctx) => {
  if (data.type === 'custom' && !data.baseURL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Base URL is required for custom providers',
      path: ['baseURL'],
    });
  }
};

export const createProviderSchema = z
  .object({
    label: z.string().min(1, 'Label is required').max(100),
    type: z.enum(PROVIDER_TYPES).default('custom'),
    baseURL: z.string().url('Must be a valid URL').optional(),
    apiKey: z.string().min(1, 'API Key is required'), // plain text coming in, encrypted before save
    defaultModel: z.string().min(1, 'Default Model is required'),
    isDefault: z.boolean().default(false),
  })
  .superRefine(requireBaseUrlForCustom);

export const updateProviderSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    type: z.enum(PROVIDER_TYPES).optional(),
    baseURL: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    defaultModel: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
  })
  // Only enforced when `type` is explicitly present in the payload (e.g.
  // switching to 'custom') — partial updates that don't touch `type` are
  // unaffected, since the stored baseURL from a prior save still applies.
  .superRefine((data, ctx) => {
    if (data.type !== undefined) requireBaseUrlForCustom(data, ctx);
  });

export const testConnectionSchema = z
  .object({
    type: z.enum(PROVIDER_TYPES).default('custom'),
    baseURL: z.string().url('Must be a valid URL').optional(),
    apiKey: z.string().min(1, 'API Key is required'),
  })
  .superRefine(requireBaseUrlForCustom);
