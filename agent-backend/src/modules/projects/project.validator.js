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
//
// Either an internal Persona User id (v1 minimum mechanism) or a
// human-friendly email (email-first invite — blueprint "SHOULD HAVE before
// general release": invitation of an existing Persona User) is accepted,
// but never both. Email is resolved to the user's internal id server-side
// (project.controller.js → userRepository.findByEmail), so Admins no longer
// need DB access to invite a colleague.
export const addMemberSchema = z
  .object({
    personaUserId: z.string().min(1, 'personaUserId is required').optional(),
    email: z.string().email('A valid email is required').optional(),
  })
  .refine((data) => data.personaUserId || data.email, {
    message: 'Either personaUserId or email is required',
  })
  .refine((data) => !(data.personaUserId && data.email), {
    message: 'Provide exactly one of personaUserId or email, not both',
  });

export const createCredentialSchema = z.object({
  label: z.string().max(100).optional(),
});

// Invitations target people without a Persona account yet (AD-08 §11) — the
// service rejects emails that already map to an existing user.
export const createInvitationSchema = z.object({
  email: z.string().email('A valid email is required'),
});
