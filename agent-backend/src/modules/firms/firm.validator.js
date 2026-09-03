import { z } from 'zod';
import { FIRM_CATEGORIES } from './firm.model.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const mandateSchema = z.object({
  takes: z.array(z.string().max(200)).max(20).optional(),
  refuses: z.array(z.string().max(200)).max(20).optional(),
  clientProfile: z.string().max(1000).optional(),
});

const proofSchema = z.object({
  quote: z.string().min(1).max(600),
  author: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
});

const firmFields = {
  name: z.string().min(2).max(80),
  tagline: z.string().max(140).optional(),
  bio: z.string().max(2000).optional(),
  category: z.enum(FIRM_CATEGORIES).optional(),
  avatar: z.string().max(2000).optional(),
  coverImage: z.string().max(2000).optional(),
  mandate: mandateSchema.optional(),
  proof: z.array(proofSchema).max(20).optional(),
  expertise: z.array(z.string().max(80)).max(30).optional(),
  frontDeskAgentId: objectId.nullable().optional(),
};

export const createFirmSchema = z.object(firmFields);
export const updateFirmSchema = z.object({ ...firmFields, name: firmFields.name.optional() });

const deliverableSchema = z.object({
  name: z.string().min(1).max(200),
  acceptanceCriteria: z.string().max(1000).optional(),
});

const inputSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().min(1).max(120),
  type: z.enum(['text', 'textarea', 'url']).optional(),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional(),
});

const projectFields = {
  title: z.string().min(3).max(120),
  outcome: z.string().min(3).max(240),
  summary: z.string().max(400).optional(),
  description: z.string().max(8000).optional(),
  whoFor: z.array(z.string().max(300)).max(12).optional(),
  deliverables: z.array(deliverableSchema).max(30).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  price: z
    .object({
      amount: z.number().min(0).optional(),
      currency: z.string().max(8).optional(),
      period: z.enum(['one-time', 'monthly']).optional(),
    })
    .optional(),
  inputs: z.array(inputSchema).max(20).optional(),
  checkpoints: z.array(z.string().max(300)).max(12).optional(),
  leadAgentId: objectId.nullable().optional(),
  employeeIds: z.array(objectId).max(20).optional(),
  skillIds: z.array(objectId).max(30).optional(),
  instructions: z.string().max(20000).optional(),
  status: z.enum(['draft', 'published']).optional(),
  order: z.number().int().optional(),
};

export const createFirmProjectSchema = z.object(projectFields);
export const updateFirmProjectSchema = z.object({
  ...projectFields,
  title: projectFields.title.optional(),
  outcome: projectFields.outcome.optional(),
});

export const updateTeamMemberSchema = z.object({
  member: z.boolean().optional(),
  role: z
    .object({
      title: z.string().max(80).optional(),
      mandate: z.string().max(600).optional(),
      facing: z.enum(['client', 'internal', 'owner']).optional(),
    })
    .optional(),
});

export const startProjectSchema = z.object({
  inputs: z.record(z.string(), z.string().max(5000)).optional(),
});

export const respondInboxSchema = z.object({
  response: z.string().min(1).max(5000),
});
