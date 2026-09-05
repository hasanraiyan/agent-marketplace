import { z } from 'zod';

/**
 * No bespoke manifest-shape validator here — unlike REST Tool Sources
 * (which hand-rolls a zod schema for the fetched manifest), RCP conformance
 * checking is `rcp-sdk`'s job: `rcpSource.service.js#testConnection` and
 * `rcpSource.tools.js#resolveRcpSourceTools` both call
 * `createRcpClient().discover()` directly, which validates against the
 * real protocol schema.
 */
export const createRcpSourceSchema = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    url: z.string().url('Must be a valid URL'),
    authType: z.enum(['none', 'header']).default('none'),
    /** A Project Secret id, picked/created from the same Secrets tab REST API Tools use. */
    secretRef: z.string().min(1).optional(),
    isEnabled: z.boolean().default(true),
  })
  .refine((data) => data.authType !== 'header' || Boolean(data.secretRef), {
    message: 'A secret is required when auth type is header',
    path: ['secretRef'],
  });

export const updateRcpSourceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  authType: z.enum(['none', 'header']).optional(),
  /** `null` clears the secret (only meaningful alongside `authType: 'none'`). */
  secretRef: z.string().min(1).nullable().optional(),
  isEnabled: z.boolean().optional(),
});
