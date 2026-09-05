# REST Tool Sources for Next.js integrators

This is a start-to-finish guide for giving your Persona Agents the ability to call your own
Next.js backend as a tool — without hand-filling a form in Studio, and without standing up an MCP
server. It's written for whoever owns your `@personaai/nextjs` integration.

If you want the platform-wide reference instead of a Next.js-specific walkthrough, see:

- `developer-docs/guides/rest-tools.mdx` — "Code-first: REST Tool Sources" (the concept, applies
  to every framework)
- `developer-docs/guides/sdk/resources/rest-tools.mdx` — the `defineRestTool()` API reference
- `developer-docs/guides/nextjs/routes.mdx` — "Static manifest route" (the Next.js-specific route
  this feature adds)

## What this actually is

Today, a "REST API Tool" is something you build by hand in Studio: fill in a method, a URL,
headers, params, and save. That still exists and still works fine for a one-off.

A **REST Tool Source** is the code-first version of the same idea, and it's modeled directly on
how MCP connectors already work in this platform:

| | MCP connector | REST Tool Source |
|---|---|---|
| You register... | a URL + optional API key | a URL + optional API key |
| Persona discovers tools by... | calling the MCP protocol's `tools/list` | fetching your URL and parsing a JSON list |
| Discovery happens... | when you click **Test Connection** | when you click **Test Connection** |
| An Agent attaches... | the whole connector | the whole source |
| At runtime, tools are... | fetched live from the MCP server, every turn | fetched live from your URL, every turn |
| Nothing is cached except... | a display-only tool list, for the dashboard | a display-only tool list, for the dashboard |

The important part: **nothing about your tool definitions is ever copied into Persona's
database.** Every single Agent turn that has your source attached makes a live `GET` request to
your manifest URL, parses the tools out of it, and calls whichever one the model picks — directly
against the URL you defined in your own code. If your server is down, that source's tools quietly
don't show up for that turn (logged on Persona's side, not a hard failure) — the rest of the Agent
keeps working.

This means the *only* thing you register in the dashboard is a URL and (optionally) a shared
secret. The actual tool definitions — what they're called, what arguments they take, what HTTP
call they make — live entirely in your own Next.js codebase, in version control, reviewed in PRs,
deployed the same way as the rest of your app.

## Prerequisites

```bash
npm install @personaai/sdk@^0.7.0 @personaai/nextjs@^0.1.10 zod
```

`zod` is required only because `defineRestTool()`'s `args` option takes a zod schema — it's an
**optional peer dependency** of `@personaai/sdk`, so it's not pulled in unless you actually import
from the `@personaai/sdk/rest-tools` entry point.

You should already have a working `@personaai/nextjs` mount (see
`developer-docs/guides/nextjs/quickstart.mdx` if not) — this feature is one new option on the
`createPersonaHandler`/`createRuntime` call you already have, not a new integration from scratch.

## Step 1 — define your tools

Anywhere in your server-side code (not a Client Component — this never runs in the browser):

```ts
// lib/persona-tools.ts
import { defineRestTool } from '@personaai/sdk/rest-tools';
import { z } from 'zod';

export const getLearnerProfile = defineRestTool({
  name: 'Get learner profile',
  description: "Fetches a learner's plan, progress, and enrollment status by their Persona user id.",
  method: 'GET',
  // t.externalUserId expands to the reserved {{externalUserId}} token —
  // resolved server-side by Persona from the verified caller identity,
  // never something the model can see, set, or override.
  url: (t) => `https://api.yourapp.com/learners/${t.externalUserId}/profile`,
  responseMappings: {
    name: '@data.name',
    plan: '@data.plan.name',
    progress: '@data.progress.percentComplete',
  },
});

export const searchCourses = defineRestTool({
  name: 'Search courses',
  description: 'Searches the course catalog by free-text query.',
  method: 'GET',
  args: z.object({
    query: z.string().describe('Free-text search term, e.g. "intro to python"'),
    limit: z.number().optional().describe('Max results, defaults to 10 server-side'),
  }),
  url: 'https://api.yourapp.com/courses/search',
  queryParams: {
    q: (t) => t.arg('query'),
    limit: (t) => t.arg('limit'),
  },
});
```

A few things worth knowing about `defineRestTool()`:

- **`args`** declares what the *model* can fill in as tool-call arguments. Each zod field becomes
  one argument; `.describe('...')` becomes the description the model sees; `.optional()` makes it
  non-required. Omit `args` entirely for a tool with no dynamic input.
- **`t.arg('name')`** (inside a `url`/`queryParams`/`headers`/`body` callback) references one of
  those `args` fields — it's type-checked against `args`' own keys, so a typo throws immediately
  instead of silently producing a broken template.
- **`t.externalUserId`** is the one reserved value the *model* never controls. Use it exactly like
  a verified session's user id claim — Persona refuses to make the call at all if there's no
  actual end-user session behind it, rather than sending an empty or spoofable value.
- **`auth: { type: 'bearerSecret', secretRef }`** exists if one specific tool needs its own Bearer
  secret (a Persona-side Project Secret id) beyond whatever you check on the manifest route itself
  — most integrations won't need this; the manifest-level `authToken` (next step) is usually
  enough.

## Step 2 — host them at a URL

Add `restToolsManifest` to your existing Persona route handler:

```ts
// app/api/persona/[...persona]/route.ts
import { createPersonaHandler } from '@personaai/nextjs/server';
import { auth } from '@clerk/nextjs/server'; // or your own auth
import { getLearnerProfile, searchCourses } from '@/lib/persona-tools';

export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: async () => (await auth()).userId,

  restToolsManifest: {
    tools: [getLearnerProfile, searchCourses],
    // Required in production. Checked against the incoming request's
    // `Authorization: Bearer <token>` header — must match the API Key you
    // set on the Persona-side REST Tool Source in Step 3. Generate this
    // once with `openssl rand -hex 32` (or similar) and store it as a
    // secret, the same way you'd store any other server-to-server key.
    authToken: process.env.PERSONA_TOOLS_SECRET!,
  },
});

export const dynamic = 'force-dynamic';
```

That's the entire code change. This adds exactly one new route under your existing mount:
`GET /api/persona/rest-tools/manifest`. It:

- Is **not** gated behind any capability flag — it's plain host-side data, not a Persona-admin
  proxy call, so it's always available the moment you set the option.
- Never calls `resolveUserFrom`/your app's own auth — it's Persona-to-server traffic, authenticated
  by the `authToken` bearer check instead. Don't expect your normal user session to apply here.
- Returns `{ "tools": [...] }` — if you ever want to verify it yourself:
  ```bash
  curl -H "Authorization: Bearer $PERSONA_TOOLS_SECRET" \
    https://your-app.com/api/persona/rest-tools/manifest
  ```

## Step 3 — register the source in the Persona dashboard

In Studio, go to your Project → **REST Tool Sources** tab → **New REST Tool Source**:

| Field | Value |
|---|---|
| Name | Whatever you want to call it internally, e.g. "Coursify backend" |
| Manifest URL | `https://your-app.com/api/persona/rest-tools/manifest` |
| Auth Type | **API Key** |
| Secret | Pick an existing Project Secret, or click **New** to create one on the spot with the value `PERSONA_TOOLS_SECRET` |

This reuses the same **Secrets** tab your manual REST API Tools already use — one secret can back
both, so there's no separate "API Key" text field to keep in sync by hand.

Save, then click **Test Connection**. If everything's wired up correctly you'll see
`getLearnerProfile` and `searchCourses` listed (name, method, URL) — this is a live fetch against
your manifest URL happening right then, not a cached result.

If Test Connection fails:

- **401 / "Manifest URL responded with status 401"** — the Secret's value in Studio doesn't match
  `PERSONA_TOOLS_SECRET` in your environment, or your route isn't actually checking it (double
  check `restToolsManifest.authToken` is set and matches).
- **"Could not reach the manifest URL"** — the URL is wrong, not publicly reachable (a `localhost`
  URL won't work — Persona's backend has to be able to reach it, so this needs your real deployed
  URL, or a tunnel like ngrok for local testing), or the deployment isn't live yet.
- **"Manifest payload is invalid"** — something in your `tools` array doesn't match the expected
  shape. This usually means a `defineRestTool()` call is missing a required field (`name`,
  `method`, `url`) — check the error message, it names the specific validation failure.

## Step 4 — attach the source to an Agent

Same picker as MCP connectors — open the Agent in Studio's editor, find **REST Tool Sources**, and
toggle your source on. You attach the whole source, not individual tools within it (that's the
one meaningful difference from the old manual REST API Tools, which attach one at a time).

## What happens at runtime

Every time this Agent runs a turn:

1. Persona fetches `https://your-app.com/api/persona/rest-tools/manifest` fresh (with your
   `authToken`).
2. It validates the response and builds a callable tool for each entry, namespaced by your
   source's name to avoid collisions if you have multiple sources attached (e.g.
   `coursify_backend_get_learner_profile`).
3. If the model calls one, Persona makes the actual HTTP request **directly to the URL you
   specified in `defineRestTool()`** — e.g. `https://api.yourapp.com/learners/.../profile` — not
   back through your Next.js app. Your Next.js app's manifest route is only ever used for
   *discovery*, never for *execution*. The URLs inside your tool definitions can point anywhere:
   your own API, a third-party API, whatever the tool needs to call.

If step 1 fails (your manifest route is down, returns an error, or the response doesn't validate),
that source's tools are silently absent from that turn — the model just doesn't see them as
options. It's not a hard error for the whole conversation.

## Updating tools later

There's no "sync" or "publish" step. Change your `defineRestTool()` calls, deploy your Next.js
app, and the next Agent turn (or the next time someone clicks **Test Connection** in Studio) picks
up the new definitions automatically — because it's fetched live every time, not stored.

## Security notes

- `restToolsManifest.authToken` is the only thing standing between your manifest endpoint and
  anyone who finds the URL. Treat it like any other server-to-server shared secret: generate it
  randomly, never commit it, rotate it if you suspect it leaked (update it in both your env vars
  and the Project Secret the source's Auth tab points at, together).
- The manifest route reveals your tool *definitions* (names, descriptions, URLs, argument shapes)
  to anyone with the token — including any URLs you've hardcoded into them. It does not reveal
  any data those URLs would return; that's still protected by whatever auth those endpoints
  themselves require.
- `PERSONA_CREDENTIAL` (your Persona Project credential) and `PERSONA_TOOLS_SECRET` (this
  feature's manifest token) are two independent secrets. Don't reuse one for the other — they
  authenticate different directions of the same integration.
