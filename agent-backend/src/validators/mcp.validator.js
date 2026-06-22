import { z } from 'zod';

const oauthConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  scopes: z.array(z.string()).optional(),
});

export const createMcpSchema = z
  .object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    transport: z.enum(['http', 'sse']),
    url: z.string().url('Must be a valid URL'),
    authType: z.enum(['none', 'oauth']).default('none'),
    authMode: z.enum(['owner', 'user']).default('owner'),
    oauth: oauthConfigSchema.optional(),
    useDynamicRegistration: z.boolean().optional(),
    isEnabled: z.boolean().default(true),
  })
  .refine((data) => data.authType !== 'oauth' || data.useDynamicRegistration || Boolean(data.oauth), {
    message: 'Client ID and Client Secret are required when auth type is oauth',
    path: ['oauth'],
  });

export const updateMcpSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  transport: z.enum(['http', 'sse']).optional(),
  url: z.string().url('Must be a valid URL').optional(),
  authType: z.enum(['none', 'oauth']).optional(),
  authMode: z.enum(['owner', 'user']).optional(),
  isEnabled: z.boolean().optional(),
  useDynamicRegistration: z.boolean().optional(),
  oauth: z
    .object({
      clientId: z.string().min(1).optional(),
      clientSecret: z.string().min(1).optional(),
      scopes: z.array(z.string()).optional(),
    })
    .optional(),
});
