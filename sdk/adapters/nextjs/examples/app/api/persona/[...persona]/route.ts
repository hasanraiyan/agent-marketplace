/**
 * The entire Persona backend integration for a Next.js app: one catch-all
 * route file.
 *
 * `app/api/persona/[...persona]/route.ts`
 */
import { createPersonaHandler } from '@personaai/nextjs/server';

export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,

  // The one point where your auth world meets Persona's. Swap this for your
  // own: Clerk's `(await auth()).userId`, NextAuth's `(await getSession())?.user.id`,
  // a Supabase session — Persona never authenticates anyone itself.
  resolveUserFrom: async (req) => req.headers.get('x-demo-user') ?? null,
});

// Chat is a long-lived SSE stream; never let Next try to cache or statically
// render this segment.
export const dynamic = 'force-dynamic';
