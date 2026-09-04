# @personaai/devtools

Devtools for the Persona SDK — inspect threads, chat, workspace and logs when using `@personaai/nextjs` (which re-exports `@personaai/react` on `sdk/adapters/nextjs/src/client.ts:15` and wraps `@personaai/runtime` on `sdk/adapters/nextjs/src/server.ts:177`).

> **v0.1.0 — dev-only, zero runtime changes.** No new route is required. The panel is a pure client component that reads the hooks you already use. It never bundles into production unless you import it.

Single package, three subpaths (your approved `sdk/devtools/{core,react,nextjs}` layout):

- `@personaai/devtools/core` — framework-agnostic snapshot utilities + in-memory ring buffer (no React)
- `@personaai/devtools/react` — floating `<PersonaDevtools />` panel (TanStack Query style)
- `@personaai/devtools/nextjs` — same panel with `'use client'` boundary for `app/layout.tsx`

## Install

```bash
npm install -D @personaai/devtools
# or: pnpm add -D @personaai/devtools
```

Peer `react >=18` is optional — `core` works on Express/NestJS servers with no React installed. The panel itself requires React.

## Quickstart — Next.js (no adapter/runtime change)

`@personaai/nextjs` already re-exports every React hook, so one install covers everything the panel inspects (`useChat`, `useThreads`, `useAgents`, `useFiles`, `useMemory`, `useConnection`, `useMcpConnections` from `sdk/react/src/index.ts:1` and streaming types from `sdk/react/src/types.ts:1`).

```tsx
// app/layout.tsx
import { PersonaProvider } from '@personaai/nextjs'; // client.ts:15 re-export
import { PersonaDevtools } from '@personaai/devtools/react'; // or '@personaai/devtools/nextjs' inside app/
import { useChat, useThreads } from '@personaai/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <PersonaProvider baseUrl="/api/persona" getAuthToken={...} defaultAgentId="...">
          {children}
          {process.env.NODE_ENV === 'development' && <Devtools />}
        </PersonaProvider>
      </body>
    </html>
  );
}

// Tiny wrapper that feeds live hook state into the panel — no server fetch needed
'use client';
import { useChat } from '@personaai/nextjs';
import { useThreads } from '@personaai/nextjs';

function Devtools() {
  const { threads } = useThreads();
  const { messages, files, todos } = useChat({ agentId: 'my-agent' });
  return <PersonaDevtools clientState={{ threads, messages, files, todos }} />;
}
```

Without `clientState` the panel still renders but shows empty placeholders — pass whatever hooks you use.

## Optional: poll a server snapshot

If you later mount a snapshot endpoint yourself (no runtime change required — just add a custom route), the panel can poll it:

```ts
// app/api/persona/__persona/devtools/route.ts  (you create this, no SDK change)
import {
  createDevtoolsStore,
  createDevtoolsHandler,
} from "@personaai/devtools/core";
const store = createDevtoolsStore();
const handler = createDevtoolsHandler({
  store,
  getSnapshot: () => ({
    runtime: {
      mode: "development",
      mountPath: "/api/persona",
      capabilities: {},
      routeCount: 0,
      runCount: 0,
      heartbeatIntervalMs: 15000,
    },
    routes: [],
    runs: [],
  }),
});
export async function GET() {
  const r = await handler.handle();
  return new Response(r.body, { status: r.status, headers: r.headers });
}
```

Then:

```tsx
<PersonaDevtools
  baseUrl="/api/persona"
  clientState={{ threads, messages, files, todos }}
/>
```

`baseUrl` on, `intervalMs:3000` polls `baseUrl/__persona/devtools`. Omit `baseUrl` for client-only mode (default).

## Tabs

| Tab           | Source                                                              | Shows                                                                                                                 |
| ------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Chat**      | `useChat()` `sdk/react/src/hooks/useChat.ts:156`                    | `messages`, `isStreaming`, `interrupt` (hitl/clarification), last 3 messages preview                                  |
| **Threads**   | `useThreads()` `sdk/react/src/hooks/useThreads.ts:7`                | list, count, active `threadId`                                                                                        |
| **Workspace** | `useChat()` `files`/`todos`/`presentedFile` (from `STATE_SNAPSHOT`) | file count, todo count, file tree preview                                                                             |
| **Runtime**   | `GET __persona/devtools` if `baseUrl` set                           | `mode`, `mountPath`, `capabilities` `sdk/runtime/src/types/options.ts:27`, `routeCount`, `runCount`, full route table |
| **Logs**      | core `store` ring buffer + `fetchWithAuth` history                  | last 50 requests (redacted `Authorization`) + last 100 logs                                                           |

## API

```ts
import { createDevtoolsStore, createDevtoolsHandler } from '@personaai/devtools/core';
import { PersonaDevtools, useDevtoolsSnapshot } from '@personaai/devtools/react';
import { PersonaDevtools as PersonaDevtoolsNext } from '@personaai/devtools/nextjs';

<PersonaDevtools
  baseUrl?: string            // poll server snapshot — omit for client-only
  clientState?: { threads?, messages?, files?, todos? }
  defaultOpen?: boolean        // default false
  pollIntervalMs?: number      // default 3000, 0 = manual only
/>
```

## Production safety

- OFF by default — no panel, no fetch, no logs unless you import `<PersonaDevtools />`.
- Panel not re-exported from `@personaai/react` `sdk/react/src/index.ts:1`, so tree-shaken when not imported.
- Even if imported, hidden in `production` unless `window.__PERSONA_DEVTOOLS_FORCE__ = true` — see `src/react/DevtoolsPanel.tsx`.
- Never logs secrets — callers must redact before logging (same rule as `@personaai/logger` `sdk/logger/src/logger.ts:1`).

## No runtime republish needed

This package has no dependency on `@personaai/runtime` (`sdk/devtools/package.json:33` only `logger` + optional `react`). It composes the runtime via the existing `PersonaContext` and optional `fetch(__persona/devtools)` — zero lines changed in `sdk/runtime`.
