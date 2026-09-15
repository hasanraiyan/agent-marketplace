"use client";

import { PersonaProvider } from "@personaai/adapters/nextjs";
import { ChatCircleIcon } from "@phosphor-icons/react";
import { PersonaChatView } from "@/components/persona/chat-sdk";

/**
 * Verification harness for issue #352 (SDK-first, shadcn-compatible chat
 * UI). Wired the same way any `@personaai/adapters` consumer would:
 *
 *   - src/app/api/persona/[...persona]/route.ts mounts a real runtime via
 *     `createPersonaHandler` (server-side, holds the Project credential).
 *   - `PersonaProvider` here points at that SAME-ORIGIN route, never at the
 *     Persona Developer Platform or agent-backend directly — the browser
 *     never sees `PERSONA_CREDENTIAL`.
 *
 * `PersonaChatView` (./chat-sdk/persona-chat-view.tsx) and everything it's
 * built on use ONLY `@personaai/react` types/hooks — no `platform`-internal
 * imports anywhere in this tree. Set `NEXT_PUBLIC_PERSONA_AGENT_ID` (and
 * the server route's `PERSONA_BASE_URL`/`PERSONA_CREDENTIAL`, see
 * `.env.local.example`) to stream against a real agent.
 */
export default function Home() {
  return (
    <PersonaProvider
      baseUrl="/api/persona"
      defaultAgentId={process.env.NEXT_PUBLIC_PERSONA_AGENT_ID}
      logLevel="debug"
    >
      <div className="h-screen w-screen">
        <PersonaChatView
          agentId={process.env.NEXT_PUBLIC_PERSONA_AGENT_ID}
          title="Support Chat"
          emptyTitle="How can I help you today?"
          starterPrompts={[
            { label: "What can you do?", icon: ChatCircleIcon, template: "What can you do?" },
          ]}
        />
      </div>
    </PersonaProvider>
  );
}
