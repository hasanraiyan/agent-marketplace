import { createPersonaHandler } from "@personaai/adapters/nextjs/server";

/**
 * Mounts a real Persona runtime at /api/persona — the same pattern any
 * `@personaai/adapters` consumer uses, per issue #352's quickstart. This is
 * what makes `PersonaChatView` (chat-sdk/persona-chat-view.tsx) stream
 * against a real `agent-backend` for the E2E verification in T6's
 * acceptance criteria, instead of hitting a URL that doesn't exist.
 *
 * `PERSONA_BASE_URL`/`PERSONA_CREDENTIAL` come from a real Project on the
 * Persona Developer Platform (Project settings → API credentials) — set
 * them in `.env.local`, never commit real values.
 *
 * `resolveUserFrom` is a placeholder — swap it for real auth (Clerk,
 * Auth0, your own session) in a non-demo app; every request here resolves
 * to the same anonymous demo user.
 */
export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: async () => "chat-sdk-demo-user",
  // Debug: verbose runtime logs + error detail (message/stack/upstream
  // response) in API error responses instead of a generic message.
  logLevel: "debug",
  mode: "development",
});

export const dynamic = "force-dynamic";
