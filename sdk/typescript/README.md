# @personaai/sdk

Node.js/TypeScript SDK for the [persona.hasanraiyan.me](https://persona.hasanraiyan.me) Developer Platform API — Agents,
Skills, Knowledge bases, MCP connectors, named Stores, memory, and streaming chat, from your own backend.

> **Server-side only.** Every method on this SDK sends your Project's credential — a server-side
> secret, not something a browser is ever allowed to see. **Never** construct `PersonaClient` in a
> browser bundle, a mobile app, or a Next.js Client Component. See
> [Where do I call this from?](https://dev-docs.persona.hasanraiyan.me/guides/integration-guide) for the full reasoning
> and a per-resource "who calls this, and when" table.

## Install

```bash
npm install @personaai/sdk
pnpm add @personaai/sdk
```

Requires Node.js 18+ (uses the built-in `fetch`/`FormData`/`ReadableStream`).

## Quickstart

```ts
import { PersonaClient } from '@personaai/sdk';

const persona = new PersonaClient({
  baseUrl: 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_CREDENTIAL!, // "<keyId>.<secret>", minted via Studio
});

// Sanity-check your credential.
const who = await persona.whoami();
console.log(who.principalType, who.domain);

// Provision an Agent (a one-time, control-plane call — no external user asserted).
const agent = await persona.agents.create({
  name: 'Career Launchpad',
  systemPrompt: 'You help students find internships.',
  providerId: '...', // an existing Provider's id
  visibility: 'unlisted',
});
```

### Acting on behalf of one of your own end users

Most resources (Threads, Files, and any create/list call) behave differently depending on whether
you assert an external user. Construct a second client per request, scoped to whoever is actually
using your product right now — after *your own* auth has confirmed who that is:

```ts
const userClient = new PersonaClient({
  baseUrl: 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_CREDENTIAL!,
  externalUserId: currentUser.id, // your own user id for this person
});

const thread = await userClient.threads.create({ agentId: agent._id });
```

### Chat, streamed

```ts
// Full event stream, for building your own UI.
for await (const event of userClient.chat.stream(agent._id, {
  messages: [{ role: 'user', content: 'What internships are open right now?' }],
})) {
  if (event.type === 'TEXT_MESSAGE_CHUNK' && event.delta) process.stdout.write(event.delta);
}

// Or the convenience wrapper — drains the stream, returns the final text.
const result = await userClient.chat.sendMessage(agent._id, {
  messages: [{ role: 'user', content: 'What internships are open right now?' }],
});
console.log(result.text);

// If the run pauses on a human-in-the-loop decision, `result.interrupt` is set instead of
// finishing normally — resume it on the next call:
if (result.interrupt) {
  await userClient.chat.sendMessage(agent._id, {
    messages: [],
    resume: { decisions: [{ action: 'delete_agent', decision: 'approve' }] },
  });
}
```

## Resources

| Client property | Wraps |
| --- | --- |
| `.agents` | `/api/v1/developer/agents` |
| `.skills` | `/api/v1/developer/skills` |
| `.knowledge` | `/api/v1/developer/knowledge` (incl. document upload/search) |
| `.mcps` (+ `.mcps.oauth`) | `/api/v1/developer/mcps` (incl. OAuth owner/user connection flows) |
| `.restTools` | `/api/v1/developer/rest-tools` (plain CRUD — see [Defining REST tools in code](#defining-rest-tools-in-code) for the code-first path) |
| `.providers` | `/api/v1/developer/providers` |
| `.threads` | `/api/v1/developer/threads` |
| `.memory` | `/api/v1/developer/memory` |
| `.stores` | `/api/v1/developer/stores` |
| `.files` | `/api/v1/developer/files` |
| `.chat` | `/api/v1/developer/agui` (streaming) |
| `.architect` | `/api/v1/developer/architect/agui` (streaming, Agent Architect) |

Every method mirrors the real REST endpoint 1:1 — no hidden behavior. Full types are exported from
the package root.

> **Complete reference:** the [Node.js SDK reference](https://dev-docs.persona.hasanraiyan.me/guides/sdk-quickstart)
> covers every method, type, error, edge case, and workflow in depth — no need to read the source.

**Out of scope for this SDK**: Project/Members/Credentials management. Those are Clerk-session
(human admin) operations, a completely different auth model than the machine-credential calls this
SDK makes — manage them from [Developer Studio](https://persona.hasanraiyan.me/developer) instead.

## Defining REST tools in code

REST API tools (no-code endpoints your Agents can call) don't have to be hand-typed in the
dashboard form. `defineRestTool` builds a tool definition from a zod schema instead of raw
`{{token}}` strings; you then host a list of these on your own backend and register that URL
in the dashboard as a **REST Tool Source** — Persona discovers the tools from it live, the same
way it discovers an MCP server's tools (register a URL + key, no manual per-tool form-filling).

```ts
import { defineRestTool } from '@personaai/sdk/rest-tools'; // separate entry point — keeps `zod` optional
import { createExpressAdapter } from '@personaai/express'; // or the NestJS/Next.js adapter
import { z } from 'zod';

const getProfile = defineRestTool({
  name: 'Get learner profile',
  method: 'GET',
  args: z.object({ userId: z.string().describe('Coursify user id') }),
  url: (t) => `https://api.coursify.dev/users/${t.arg('userId')}`,
  headers: { 'X-Persona-User': (t) => t.externalUserId }, // the reserved {{externalUserId}} token, typed
  responseMappings: { name: '@data.name', email: '@data.email' },
});

const persona = createExpressAdapter({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: (req) => req.user?.id ?? null,
  restToolsManifest: { tools: [getProfile], authToken: process.env.PERSONA_TOOLS_SECRET! },
});
app.use('/api/persona', persona.router);
// → tools now reachable at GET https://your-app.com/api/persona/rest-tools/manifest
```

Then, in the Persona dashboard: **Add REST Tool Source** → URL =
`https://your-app.com/api/persona/rest-tools/manifest`, Auth = API Key = the same
`PERSONA_TOOLS_SECRET` → **Test Connection** discovers `getProfile`. Attach the *source* to an
Agent (like attaching an MCP server) — its tools are fetched live on every Agent turn, never
copy-pasted into Persona's database.

- `defineRestTool` derives `paramDescriptors` from the zod schema (`.describe()` → the arg's
  description, `.optional()` → not required) instead of hand-writing descriptor objects, and its
  `t.arg(name)`/`t.externalUserId` helpers replace hand-typed `"{{token}}"` strings — `t.arg()`
  throws immediately for a name not declared in `args`, instead of silently producing a template
  nothing resolves.
- `zod` is an **optional peer dependency** — only needed if you import from `@personaai/sdk/rest-tools`;
  the package root never pulls it in. `args` can also be omitted entirely for a tool with no dynamic parts.
- The SDK itself never calls Persona for this feature — `restToolsManifest` is a plain option on
  `@personaai/runtime`'s `createRuntime` (and every adapter built on it), which just serves your
  tool list as JSON. Persona does the pulling.

## Logging

Built-in, **off by default** — nothing logs unless you enable it. Selectable per instance or globally, with full level visibility (`off` < `error` < `warn` < `info` < `debug` < `trace`).

```ts
import { PersonaClient, setLogLevel, createLogger } from '@personaai/sdk';

// Global — affects loggers created without an explicit level
setLogLevel('debug'); // or 'trace' for wire-level detail

// Per-client — overrides global for this credential/user
const persona = new PersonaClient({
  baseUrl: 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_CREDENTIAL!,
  logLevel: 'debug', // or 'info' | 'warn' | 'error' | 'trace' | 'off'
});

// Custom transport — route to pino/winston/Datadog/etc.
const logger = createLogger('my-app', {
  level: 'debug',
  transport: (level, namespace, message, meta) => {
    myPino[ level === 'trace' ? 'debug' : level ]({ namespace, ...meta }, message);
  },
});
const persona2 = new PersonaClient({ baseUrl, credential, logger });
const child = logger.child('http'); // namespaces: sdk:http, sdk:chat, sdk:architect
```

Secrets are redacted: `Authorization: Bearer <keyId>:***` and any body keys matching `credential|secret|apiKey|token|password` are logged as `***`.

## Framework recipes

### Express

For the **whole runtime surface** — streaming chat, threads, files, memory, MCP OAuth, health —
mount the official adapter instead of writing this plumbing by hand:

```bash
npm install @personaai/express
```

```ts
import { toExpressRouter } from '@personaai/express';

app.use('/api/persona', toExpressRouter(runtime)); // runtime from @personaai/runtime
```

`@personaai/express` handles AG-UI streaming, thread/file/memory routes, multipart uploads, and
user resolution for you. Drop down to this SDK whenever you need a raw call the adapter doesn't
cover — e.g. a single endpoint in your own route handler:

```ts
// routes/chat.ts
import { persona } from '../persona.js';
app.post('/api/chat', async (req, res) => {
  const userClient = new PersonaClient({ baseUrl: '...', credential: process.env.PERSONA_CREDENTIAL!, externalUserId: req.user.id });
  const result = await userClient.chat.sendMessage(req.body.agentId, { messages: req.body.messages });
  res.json(result);
});
```

### NestJS

Wrap `PersonaClient` in an `@Injectable()` provider so it plugs into Nest's DI container like any
other third-party client — the SDK itself needs no Nest-specific support.

```ts
// persona.service.ts
import { Injectable } from '@nestjs/common';
import { PersonaClient } from '@personaai/sdk';

@Injectable()
export class PersonaService {
  private readonly client = new PersonaClient({
    baseUrl: process.env.PERSONA_BASE_URL!,
    credential: process.env.PERSONA_CREDENTIAL!,
  });

  forUser(externalUserId: string) {
    return new PersonaClient({
      baseUrl: process.env.PERSONA_BASE_URL!,
      credential: process.env.PERSONA_CREDENTIAL!,
      externalUserId,
    });
  }

  get admin() {
    return this.client;
  }
}
```

### Next.js — read this one carefully

> **Most Next.js apps should reach for [`@personaai/nextjs`](https://www.npmjs.com/package/@personaai/nextjs)
> instead.** It mounts the whole runtime (streaming chat, threads, files, memory) from one
> catch-all route file and re-exports the React hooks, so none of the plumbing below is yours to
> write — and the credential can't reach the client by construction. Use this SDK directly when
> you want a raw, single-purpose call. See the
> [Next.js quickstart](https://dev-docs.persona.hasanraiyan.me/guides/nextjs/quickstart).

Next.js blurs server and client code in one codebase more than Express or Nest does, which makes it
the one framework people actually leak the credential in by accident.

> **Only import this SDK in Server Components, Route Handlers (`app/api/.../route.ts`), or Server
> Actions. Never in a `"use client"` component.** If you construct `PersonaClient` inside client
> code, Next.js bundles your Project credential straight into the JavaScript shipped to the
> browser — exactly the leak the [Integration Guide](https://dev-docs.persona.hasanraiyan.me/guides/integration-guide)
> warns about, just easier to trip into here.

```ts
// app/api/chat/route.ts — Route Handler, runs server-side only
import { PersonaClient } from '@personaai/sdk';

export async function POST(req: Request) {
  const { agentId, messages } = await req.json();
  const userId = await getCurrentUserId(req); // your own auth
  const persona = new PersonaClient({
    baseUrl: process.env.PERSONA_BASE_URL!,
    credential: process.env.PERSONA_CREDENTIAL!,
    externalUserId: userId,
  });
  const result = await persona.chat.sendMessage(agentId, { messages });
  return Response.json(result);
}
```

Because `HttpClient` uses native `fetch`, this SDK also works in Next.js's **Edge runtime**, not
just Node — no extra configuration needed. And if you want a live-streaming chat UI, a Route Handler
can return a `ReadableStream` directly, relaying the AG-UI event stream onward to your own browser
client over whatever transport you already use:

```ts
export async function POST(req: Request) {
  const { agentId, messages } = await req.json();
  const persona = new PersonaClient({ /* ... */ externalUserId: await getCurrentUserId(req) });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const event of persona.chat.stream(agentId, { messages })) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
```

## Development

```bash
pnpm install
pnpm test          # unit tests (mocked fetch) — this is what CI runs
pnpm typecheck      # tsc --noEmit
pnpm lint
pnpm docs:check     # fails if src/index.ts exports something not in the docs' export index
pnpm build          # tsup → dist/
```

### Integration tests (opt-in, needs a real backend)

`test/integration/live.test.ts` is skipped by default. It exercises the real SDK against a real,
already-running `agent-backend` — see the file's own header comment for the environment variables
it needs (a real Project credential, and a real Provider id for the Agent/Knowledge/chat tests).
Every resource it creates is deleted by its own test; safe to run repeatedly against the same
Project.

```bash
PERSONA_SDK_INTEGRATION_TEST=1 \
PERSONA_TEST_BASE_URL=https://api.persona.hasanraiyan.me \
PERSONA_TEST_CREDENTIAL=<keyId>.<secret> \
PERSONA_TEST_PROVIDER_ID=<provider-id> \
pnpm test test/integration/live.test.ts
```

## Publishing

`npm publish` is not run as part of this repo's CI — releasing a new version is a deliberate,
separate action taken by a maintainer once a version is ready.

## License

MIT
