import { z } from 'zod';
import { createRestApiToolSchema } from '../restApiTools/restApiTool.validator.js';

/**
 * Validates a fetched manifest body (`GET source.url` → `{ tools: [...] }`).
 * Each entry reuses `createRestApiToolSchema` unmodified — the same shape
 * (and reserved-token / secretRef-required-for-bearerSecret rules) a
 * dashboard-created `RestApiTool` must satisfy applies identically here.
 * Used by both `testConnection` (dashboard summary) and
 * `restApiToolSource.tools.js` (live agent-run execution) — the one place
 * that decides what a valid manifest looks like.
 */
export const restToolManifestSchema = z.object({
  tools: z.array(createRestApiToolSchema).max(200),
});

export const createRestApiToolSourceSchema = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    url: z.string().url('Must be a valid URL'),
    authType: z.enum(['none', 'apiKey']).default('none'),
    apiKey: z.string().min(1).optional(),
    isEnabled: z.boolean().default(true),
  })
  .refine((data) => data.authType !== 'apiKey' || Boolean(data.apiKey), {
    message: 'API key is required when auth type is apiKey',
    path: ['apiKey'],
  });

export const updateRestApiToolSourceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  authType: z.enum(['none', 'apiKey']).optional(),
  /** Replaces the stored key entirely; omit to leave the existing key untouched. */
  apiKey: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
});
