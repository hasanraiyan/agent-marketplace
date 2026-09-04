# @personaai/nextjs

Next.js integration for [Persona](https://persona.hasanraiyan.me) — **the one package a Next.js app installs.** One App Router catch-all route mounts the whole agent runtime (streaming chat, threads, files, memory, MCP OAuth); the root entry re-exports the React hooks and `<PersonaProvider>`.

> **v0.1.0.** Requires Next.js >= 14 (App Router). Runs on both the Node.js and Edge runtimes.

## Install

```bash
npm install @personaai/nextjs
```

## 1. Mount the backend — one file

```ts
// app/api/persona/[...persona]/route.ts
import { createPersonaHandler } from '@personaai/nextjs/server';
import { auth } from '@clerk/nextjs/server';

export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: async () => (await auth()).userId, // your auth, your rules
});

export const dynamic = 'force-dynamic';
```

## 2. Wrap your layout

`PersonaProvider` ships behind a `'use client'` boundary, so it drops straight into a server layout:

```tsx
// app/layout.tsx
import { PersonaProvider } from '@personaai/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PersonaProvider baseUrl="/api/persona">{children}</PersonaProvider>
      </body>
    </html>
  );
}
```

## 3. Chat

```tsx
'use client';
import { useChat } from '@personaai/nextjs';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({ agentId: 'ag_123' });
  // ...
}
```

That's the whole integration. Streaming chat, threads, files, memory, MCP OAuth and health now live at `/api/persona/*`.

## Two entry points

| Import                     | Contents                                                                           | Where it runs                    |
| -------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `@personaai/nextjs`        | Everything from `@personaai/react` — `PersonaProvider`, `useChat`, `useThreads`, … | Client (`'use client'` boundary) |
| `@personaai/nextjs/server` | `createPersonaHandler`, `toNextRouteHandlers`, `createRuntime`, runtime types      | Server only                      |

The split is a safety boundary as much as an ergonomic one: your Project credential is only reachable from `/server`, so it can never be pulled into a client bundle through the root entry.

## Devtools

Floating panel — same as `@personaai/devtools/react` but with the `'use client'` boundary already applied for `app/layout.tsx`:

```bash
npm install -D @personaai/devtools
```

```tsx
// app/layout.tsx
import { PersonaDevtools } from '@personaai/devtools/nextjs';
import { useChat, useThreads } from '@personaai/nextjs';

function Devtools() {
  const { threads } = useThreads();
  const { messages, files, todos } = useChat();
  return <PersonaDevtools clientState={{ threads, messages, files, todos }} />;
}

{
  process.env.NODE_ENV === 'development' && <Devtools />;
}
```

No runtime/adapter change — purely `sdk/devtools` `core`/`react` client state. See `@personaai/devtools` `sdk/devtools/README.md`.

## Full documentation

**[persona.hasanraiyan.me/guides/nextjs/quickstart](https://persona.hasanraiyan.me/guides/nextjs/quickstart)** — quickstart, auth, routes, uploads, streaming, and the Edge runtime.

## Dependencies

- `@personaai/runtime` ^0.5.2 and `@personaai/react` ^0.5.2 (installed automatically)
- `next` >= 14 and `react` >= 18 (peer dependencies)
