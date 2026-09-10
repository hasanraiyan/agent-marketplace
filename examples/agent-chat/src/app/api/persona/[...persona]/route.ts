import { createPersonaHandler } from "@personaai/adapters/nextjs/server";

/**
 * Persona Next.js App Router Catch-All Route Handler
 *
 * Mounts the entire Persona agent runtime surface at /api/persona/*:
 * - Streaming chat (AG-UI SSE protocol) at POST /api/persona/chat
 * - Thread state and conversation history at GET/POST /api/persona/threads
 * - Workspace files and uploads at GET/POST /api/persona/files
 * - Persistent memory files at GET/POST /api/persona/memory
 * - MCP OAuth callbacks and health probes at /api/persona/health
 *
 * Configured via environment variables:
 * - PERSONA_BASE_URL: Backend URL (default: https://api.persona.hasanraiyan.me)
 * - PERSONA_CREDENTIAL: Project credential secret (<keyId>.<secret>)
 */
export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL || "https://api.persona.hasanraiyan.me",
  credential: process.env.PERSONA_CREDENTIAL || "demo_credential",
  // Map to your app's authenticated user ID (or fallback to demo user):
  resolveUserFrom: async (req) => {
    const customUserHeader = req.headers.get("x-user-id");
    return customUserHeader || "demo_user";
  },
});

// Streaming agent chat runs over long-lived Server-Sent Events (SSE)
export const dynamic = "force-dynamic";
