import { z } from 'zod';
import { restApiToolBaseSchema } from '../restApiTools/restApiTool.validator.js';

/**
 * Validates a fetched manifest body (`GET source.url` → `{ tools: [...] }`).
 * Deliberately reuses `restApiToolBaseSchema` (not `createRestApiToolSchema`)
 * — a manifest tool's `secretRef` is optional even when `authType:
 * 'bearerSecret'`, unlike a dashboard-created `RestApiTool`: the caller
 * never needs to know or declare a Secret id at all, since
 * `restApiToolSource.tools.js#resolveRestApiToolSourceTools` falls back to
 * the *source's own* `secretRef` (the one secret picked once on the REST
 * Tool Source itself) for any tool that says `bearerSecret` without one.
 * The reserved-token rule still applies identically to a dashboard-created
 * tool.
 */
export const restToolManifestSchema = z.object({
  tools: z
    .array(
      restApiToolBaseSchema.refine(
        (data) => !data.paramDescriptors.some((p) => p.name === 'externalUserId'),
        {
          message: '"externalUserId" is a reserved template token and cannot be declared as a parameter',
          path: ['paramDescriptors'],
        }
      )
    )
    .max(200),
});

export const createRestApiToolSourceSchema = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    url: z.string().url('Must be a valid URL'),
    authType: z.enum(['none', 'apiKey']).default('none'),
    /** A Project Secret id, picked/created from the same Secrets tab REST API Tools use. */
    secretRef: z.string().min(1).optional(),
    isEnabled: z.boolean().default(true),
  })
  .refine((data) => data.authType !== 'apiKey' || Boolean(data.secretRef), {
    message: 'A secret is required when auth type is apiKey',
    path: ['secretRef'],
  });

export const updateRestApiToolSourceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  authType: z.enum(['none', 'apiKey']).optional(),
  /** `null` clears the secret (only meaningful alongside `authType: 'none'`). */
  secretRef: z.string().min(1).nullable().optional(),
  isEnabled: z.boolean().optional(),
});
