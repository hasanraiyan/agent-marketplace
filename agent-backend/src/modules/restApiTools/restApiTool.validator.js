import { z } from 'zod';

const paramRowSchema = z.object({
  key: z.string().min(1),
  valueTemplate: z.string().default(''),
  description: z.string().max(300).default(''),
  required: z.boolean().default(true),
});

const paramDescriptorSchema = z.object({
  name: z.string().min(1),
  in: z.enum(['path', 'query', 'header', 'body']).default('body'),
  type: z.enum(['string', 'number', 'boolean']).default('string'),
  description: z.string().max(300).default(''),
  required: z.boolean().default(true),
});

const responseMappingSchema = z.object({
  field: z.string().min(1),
  path: z.string().regex(/^@[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/, 'Must look like "@data.field.path"'),
});

// Unrefined base — kept separate from `createRestApiToolSchema` because zod
// v4 forbids `.partial()` on a schema with `.refine()`s attached, and
// `testRestApiToolSchema.draft` below needs a partial version.
const restApiToolBaseSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().min(1),
  queryParams: z.array(paramRowSchema).default([]),
  headers: z.array(paramRowSchema).default([]),
  bodyMode: z.enum(['none', 'json']).default('none'),
  bodyTemplate: z.string().default(''),
  paramDescriptors: z.array(paramDescriptorSchema).default([]),
  authType: z.enum(['none', 'bearerSecret']).default('none'),
  secretRef: z.string().min(1).optional(),
  responseMappings: z.array(responseMappingSchema).default([]),
  isEnabled: z.boolean().default(true),
});

export const createRestApiToolSchema = restApiToolBaseSchema
  .refine((data) => data.authType !== 'bearerSecret' || Boolean(data.secretRef), {
    message: 'secretRef is required when authType is bearerSecret',
    path: ['secretRef'],
  })
  .refine((data) => !data.paramDescriptors.some((p) => p.name === 'externalUserId'), {
    message: '"externalUserId" is a reserved template token and cannot be declared as a parameter',
    path: ['paramDescriptors'],
  });

export const updateRestApiToolSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    url: z.string().min(1).optional(),
    queryParams: z.array(paramRowSchema).optional(),
    headers: z.array(paramRowSchema).optional(),
    bodyMode: z.enum(['none', 'json']).optional(),
    bodyTemplate: z.string().optional(),
    paramDescriptors: z.array(paramDescriptorSchema).optional(),
    authType: z.enum(['none', 'bearerSecret']).optional(),
    secretRef: z.string().min(1).nullable().optional(),
    responseMappings: z.array(responseMappingSchema).optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine(
    (data) => !data.paramDescriptors?.some((p) => p.name === 'externalUserId'),
    {
      message: '"externalUserId" is a reserved template token and cannot be declared as a parameter',
      path: ['paramDescriptors'],
    }
  );

export const testRestApiToolSchema = z.object({
  toolId: z.string().min(1).optional(),
  draft: restApiToolBaseSchema.partial().optional(),
  testValues: z.record(z.string(), z.string()).default({}),
});
