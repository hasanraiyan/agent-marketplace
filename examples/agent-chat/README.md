# Persona Agent Chat — Next.js Adapter & React SDK Example

A production-ready AI agent chat application demonstrating how to build rich, streaming agent interfaces in **Next.js 15+ (App Router)** using `@personaai/adapters` and `@personaai/react`.

Features a soft tactile neobrutalism design system exercising the official Persona chat registry components:
- **AG-UI Streaming Chat**: Real-time token streaming, chain-of-thought reasoning, and auto-scroll handling.
- **Interactive MCP Ext Apps**: Sandboxed iframe widgets communicating bi-directionally with the chat host via `@modelcontextprotocol/ext-apps` AppBridge.
- **Human-in-the-Loop (HITL)**: Tool execution approval and multi-step clarification wizards.
- **Subagent & Deep Research**: Hierarchical subagent activity replay sheets.
- **Workspace Artifacts**: Virtual filesystem preview drawers.
- **Realtime Voice Indicator**: Animated orb state powered by `orb-ui`.

---

## Architecture Overview

```
examples/agent-chat/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── persona/
│   │   │       └── [...persona]/
│   │   │           └── route.ts         # Catch-all runtime adapter route handler
│   │   ├── layout.tsx                   # PersonaProvider wrapper (/api/persona)
│   │   ├── page.tsx                     # Chat UI with useChat() and Component Showcase
│   │   └── globals.css                  # Soft tactile neobrutalism tokens
│   └── components/
│       ├── persona/chat/                # Official shadcn registry chat components
│       └── ui/                          # Base UI primitives (buttons, drawers, bubbles)
```

### 1. Server-side Catch-All Route (`@personaai/adapters/nextjs/server`)

The entire Persona backend surface is mounted in a single Next.js App Router route:

```ts
// src/app/api/persona/[...persona]/route.ts
import { createPersonaHandler } from "@personaai/adapters/nextjs/server";

export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL || "https://api.persona.hasanraiyan.me",
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: async (req) => {
    // Read session / auth header from your auth provider (Clerk, NextAuth, etc.)
    return req.headers.get("x-user-id") || "demo_user";
  },
});

export const dynamic = "force-dynamic";
```

Mounted endpoints:
- `POST /api/persona/chat` — AG-UI SSE streaming agent responses
- `GET/POST /api/persona/threads` — Conversation history & checkpointing
- `GET/POST /api/persona/files` — File uploads & virtual workspace
- `GET /api/persona/health` — Liveness & capability check

### 2. Client-side Provider (`@personaai/adapters/nextjs`)

Wrap your root layout with `PersonaProvider`:

```tsx
// src/app/layout.tsx
import { PersonaProvider } from "@personaai/adapters/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PersonaProvider baseUrl="/api/persona">
          {children}
        </PersonaProvider>
      </body>
    </html>
  );
}
```

### 3. Using `useChat` in Your Components

```tsx
// src/app/page.tsx
"use client";

import { useChat } from "@personaai/adapters/nextjs";

export default function ChatPage() {
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isStreaming,
    stop,
    interrupt,
    resumeInterrupt,
    todos,
    files,
  } = useChat({
    agentId: "your-agent-id",
  });

  return (
    <div>
      {/* Render messages, tool calls, and composer */}
    </div>
  );
}
```

---

## Getting Started

### 1. Prerequisites

- Node.js 18+ or 22+
- `pnpm` (recommended), `npm`, or `bun`
- A Persona project credential (`<keyId>.<secret>`) from Developer Studio

### 2. Environment Configuration

Create `.env.local` in this directory:

```bash
# Persona API Base URL
PERSONA_BASE_URL="https://api.persona.hasanraiyan.me"

# Server-side Project Credential (never exposed to client bundle)
PERSONA_CREDENTIAL="prj_your_credential_key_id.your_secret"

# (Optional) Default Agent ID to direct conversations to
NEXT_PUBLIC_PERSONA_AGENT_ID="your_agent_id"
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Modes

The example includes a top navigation bar allowing you to switch between:

1. **Component Showcase (Offline Simulation)**:
   - Exercises every single shadcn chat registry component without needing backend credentials.
   - Run preset scenarios: `All Components`, `MCP Ext App`, `HITL Approval`, `Subagent & Files`.

2. **Live SDK Stream (`/api/persona`)**:
   - Streams live tokens, tools, and interrupts directly from your configured agent via `@personaai/adapters/nextjs`.

---

## Learn More

- [Developer Docs](https://persona.hasanraiyan.me/developer-docs)
- [Next.js Adapter Guide](https://persona.hasanraiyan.me/developer-docs/guides/nextjs/quickstart)
- [React SDK Reference](https://persona.hasanraiyan.me/developer-docs/guides/react/quickstart)
