# New: RCP tool support for Persona (beta)

Persona now supports **RCP** (REST Connector Protocol) — a new, independent way to expose your
backend's tools to your Agents. This is a **beta** feature, brand new as of today.

> **Do not remove or change your existing integration.** Your current REST Tool Source / REST API
> Tools setup keeps working exactly as it does today — nothing about it changes, and nothing
> requires you to touch it. RCP is a completely separate, additional option sitting *next to* what
> you already have, not a replacement for it. Treat this guide as "here's something new you can
> try," not "here's a migration you need to do."

## What RCP actually is

RCP is a genuinely open, standalone protocol — not something Persona invented for itself. It's
published as its own npm package, `rcp-sdk`, with no dependency on Persona at all. The shape is
simple: you host a small JSON manifest at a URL describing your tools; Persona (or any other AI
host that speaks RCP) fetches it and calls the tools it describes.

The practical difference from what you have today: **your tool's target URL doesn't have to be
Persona-facing at all**, and identity is passed as a plain HTTP header instead of a template token
you have to remember to wire into every tool definition.

## Should you switch to it?

Not required. If your current REST Tool Source setup is working, there's no urgency. Reasons you
might want to try RCP anyway:

- **Simpler identity handling** — no more remembering to add `{{externalUserId}}` or wire up a
  header yourself. Persona attaches `X-Persona-External-User-Id` to every request automatically
  when a verified end-user is behind the call. Your endpoint just reads that header.
- **A real open standard** — the tool definitions you write with `rcp-sdk` aren't Persona-specific;
  the same code could work with any other AI platform that adopts RCP later.

## How to add it (alongside your existing setup)

### 1. Install the packages

```bash
npm install rcp-sdk@latest
npm install @personaai/nextjs@^0.1.11   # or whichever adapter you're on — Express/NestJS also work
```

`rcp-sdk` is a separate, independent package — it has zero dependency on `@personaai/sdk` or
anything Persona-specific.

### 2. Define your tools

```ts
// lib/rcp-tools.ts
import { defineTool } from 'rcp-sdk/server';
import { z } from 'zod';

export const getCourseProgress = defineTool({
  name: 'get_course_progress',
  description: "Fetches a learner's progress on their enrolled courses.",
  method: 'GET',
  url: 'https://api.coursify.dev/progress',
  // No {{externalUserId}} needed here — identity comes in as a header,
  // read directly by your own endpoint (see step 4).
});

export const searchCourses = defineTool({
  name: 'search_courses',
  description: 'Searches the course catalog by free-text query.',
  method: 'GET',
  args: z.object({ query: z.string().describe('Free-text search term') }),
  url: 'https://api.coursify.dev/courses/search',
  queryParams: { q: (t) => t.arg('query') },
});
```

### 3. Serve the manifest

Add `rcpManifest` to your existing `createPersonaHandler` call — a **new** option, separate from
anything you already have configured:

```ts
// app/api/persona/[...persona]/route.ts
import { createPersonaHandler } from '@personaai/nextjs/server';
import { getCourseProgress, searchCourses } from '@/lib/rcp-tools';

export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: async () => (await auth()).userId,

  // Your existing restToolsManifest (if any) stays untouched right above/below this.
  rcpManifest: {
    tools: [getCourseProgress, searchCourses],
    authToken: process.env.PERSONA_RCP_SECRET!, // generate with `openssl rand -hex 32`
  },
});
```

This adds exactly one new route: `GET /api/persona/rcp/manifest`. It doesn't touch, remove, or
interfere with any route you already have.

### 4. Read the identity header on your own endpoints

```ts
// your /progress endpoint
export async function GET(req: Request) {
  const externalUserId = req.headers.get('X-Persona-External-User-Id');
  if (!externalUserId) return new Response('Unauthorized', { status: 401 });
  // ... look up progress for externalUserId
}
```

Persona attaches this header automatically on every call **only when a verified end-user is
behind the conversation** — never a value the AI model can see, set, or spoof.

### 5. Register it in the Persona dashboard

Project → **RCP Sources** tab (a new tab, separate from your existing **Tool Sources** tab) →
**New RCP Source**:

| Field | Value |
|---|---|
| Manifest URL | `https://your-app.com/api/persona/rcp/manifest` |
| Auth Type | **Header** |
| Secret | Create one with the value of `PERSONA_RCP_SECRET` |

Click **Test Connection** — you should see `get_course_progress` and `search_courses` listed.
Then attach the *source* to an Agent (same picker style as your MCP/REST Tool Source attachments).

## What's not supported yet (it's beta)

- **OAuth auth** — only `none` and a static header/bearer token work right now.
- **Per-tool auth overrides** — every tool on one RCP source shares the source's auth.
- No SDK method to manage RCP Sources themselves yet (create/update/Test Connection) — that part
  is Studio-only for now, same as your existing Tool Sources.

## Questions

This is genuinely new — if anything about the manifest, auth, or identity header doesn't behave
the way this guide describes, that's useful signal for us, not something wrong on your end. Let us
know and we'll sort it out.
