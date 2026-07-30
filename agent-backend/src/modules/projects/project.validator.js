import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  slug: z.string().trim().toLowerCase().min(1).max(100).optional(),
});

// Deliberately restricted to the same fields project.service.js's
// updateMetadata() forwards as a blind $set — status, defaultProviderId,
// and every suspension/deletion field are lifecycle-managed elsewhere
// (blueprint Phase 10) and must never be reachable through this endpoint.
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  slug: z.string().trim().toLowerCase().min(1).max(100).optional(),
});

// role is deliberately not accepted from the client — v1 supports exactly
// one membership role ('Admin', AD-08 §9), so there is nothing to choose.
export const addMemberSchema = z.object({
  personaUserId: z.string().min(1, 'personaUserId is required'),
});

export const createCredentialSchema = z.object({
  label: z.string().max(100).optional(),
});
