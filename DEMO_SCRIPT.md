# Demo Script — Persona.ai Platform + SDK

A complete, runnable walkthrough for demoing the product: **Persona.ai** (persona.hasanraiyan.me) is
an agent marketplace + agent creation/runtime platform, with a **Developer Platform** on top of it
that lets external products (Coursify, OpenFounder, Beyond Campus, etc.) mint their own credential
and run Persona's agents from their own backend via the `@personaai/sdk` (Node/TS) SDK. (The Python
SDK, `persona-agent-sdk`, is deprecated — JS/TS only for this demo and going forward.)

This doc gives you: the pitch, the setup checklist, a click-by-click Studio walkthrough, a
copy-pasteable SDK script that hits the real backend end-to-end, and a talk track to say out loud
while it runs.

---

## 1. The pitch (30 seconds, say this first)

> "Persona.ai has three experiences on one backend: **Persona** — a marketplace where people chat
> with agents. **Agent Studio** — where creators build and publish agents (system prompt, skills,
> knowledge, MCP connectors). And **Developer Studio** — where an external company creates a
> *Project*, mints an API credential, and builds their **own** agents on Persona's infrastructure.
> I'll show a Project going from zero to a working AI agent, then integrate that agent into a real
> app three ways: a raw Node script with the server SDK, a mounted backend route with our
> **adapter**, and a chat UI with our **React hooks** — the actual stack a customer ships."

---

## 2. Architecture, in one picture

```text
┌─────────────────┐  Clerk session (human)   ┌───────────────────────┐
│  Developer       │ ────────────────────────▶                       │
│  Studio (/developer)                        │   agent-backend       │
└─────────────────┘                           │   (Express 5, :3000)  │
                                               │                       │
                                               │  - Projects/Members/  │
                                               │    Credentials        │
                                               │  - Agents/Skills/     │
                                               │    Knowledge/MCP/     │
                                               │    Providers/Stores/  │
                                               │    Workflows          │
                                               │  - AG-UI streaming    │
                                               │    chat runtime       │
                                               └───────────┬───────────┘
                                                            │
                                          Project credential (machine)
                                          Authorization: Bearer <keyId>:secret
                                                            │
        ┌───────────────────────────────────────────────────────────────────┐
        │                    YOUR OWN APP (what a customer ships)            │
        │                                                                     │
        │  ┌──────────────────────┐         ┌───────────────────────────┐   │
        │  │  your backend         │  mounts │  @personaai/adapters       │   │
        │  │  (Express/Next/Nest)  │────────▶│  /api/persona/*             │   │
        │  │  holds the credential │         │  (or raw @personaai/sdk    │   │
        │  │  server-side only     │         │   for a one-off call)      │   │
        │  └───────────┬────────────┘         └───────────────────────────┘   │
        │              │ same-origin fetch, NO credential in the browser      │
        │  ┌───────────▼────────────┐                                        │
        │  │  your React frontend    │                                        │
        │  │  @personaai/react       │                                        │
        │  │  PersonaProvider +      │                                        │
        │  │  useChat()              │                                        │
        │  └─────────────────────────┘                                        │
        └───────────────────────────────────────────────────────────────────┘

                            MongoDB · Qdrant (RAG) · LLM providers
```

- **Studio path** (browser, Clerk-session auth): full read/write CRUD over a Project's own
  resources — this is how the agent gets *created*.
- **Server SDK path** (`@personaai/sdk`): a minted **Project credential** (`<keyId>.<secret>`),
  called directly from your backend for one-off/control-plane calls.
- **Full-stack path** (`@personaai/adapters` + `@personaai/react`): your backend mounts the entire
  runtime behind one route using the adapter (the credential never leaves your server); your React
  frontend talks to *that route*, not Persona directly, using the same hooks Persona's own UI is
  built on. This is the integration path most real customers actually ship.
- All three converge on the exact same Agent/Thread/chat execution code on the backend — that's the
  point of the demo: create the agent once in Studio, then reach it three different ways.

---

## 3. Pre-demo setup (do this before the audience shows up)

### 3.1 Services

```bash
# Terminal 1 — backend (needs MongoDB running, and at minimum OPENAI_API_KEY or ANTHROPIC_API_KEY
# set in agent-backend/.env — copy agent-backend/.env.example and fill it in once)
cd agent-backend
pnpm install
pnpm dev            # http://localhost:3000

# Terminal 2 — frontend (Persona / Agent Studio / Developer Studio, all one Next.js app)
cd frontend
pnpm install
pnpm dev            # http://localhost:3001
```

Sanity check the backend is up:

```bash
curl http://localhost:3000/api/v1/health
```

### 3.2 Sign in

Open `http://localhost:3001`, sign up/sign in via Clerk (any test account). You need a logged-in
session to reach `/developer`.

### 3.3 Build the SDK packages once (so the demo scripts just run)

```bash
cd sdk/typescript && pnpm install && pnpm build   # @personaai/sdk
cd ../adapters      && pnpm install && pnpm build   # @personaai/adapters
cd ../react          && pnpm install && pnpm build   # @personaai/react
```

### 3.4 Prep the existing reference app for Act 3 (adapter + React)

**Don't build this from scratch — it already exists**, fully built, at
`examples/chat-sdk-app`: a real shadcn UI (registry `base-lyra`, ~60 components) wired to
`@personaai/adapters/nextjs` + `@personaai/react`, with a rich `PersonaChatView` — thread list,
tool-call cards, human-in-the-loop interrupts, a sandbox terminal, voice, subagent traces, and a
memory/files browser. All you do is install and set 3 env vars:

```bash
cd examples/chat-sdk-app
pnpm install
cp .env.example .env.local
```

Edit `.env.local`:

```bash
PERSONA_BASE_URL=http://localhost:3000
PERSONA_CREDENTIAL=PASTE_YOUR_KEYID.SECRET_HERE   # from Studio → Credentials → Mint
NEXT_PUBLIC_PERSONA_AGENT_ID=PASTE_YOUR_AGENT_ID_HERE
```

That's the whole setup — no code to write for Act 3.

### 3.5 Have an LLM provider key ready

You'll create a **Provider** in Developer Studio (Step 5 below) — have an OpenAI or Anthropic API
key ready to paste in, or reuse the one already in `agent-backend/.env`.

---

## 4. Act 1 — Developer Studio walkthrough (browser, ~3 minutes)

Say: *"Let's set up a new customer — imagine this is 'Coursify' onboarding onto our platform."*

1. **Go to `http://localhost:3001/developer`.**
   Say: *"This is Developer Studio — separate from the consumer marketplace and the creator tools.
   It's where an external product manages its own workspace."*

2. **Create a Project** — click **New Project**, name it `Coursify Demo`.
   Say: *"A Project is an isolated workspace — its own Admins, its own agents, its own credentials.
   Nothing in here is visible to any other Project."*

3. **Mint a credential** — open the Project → **Credentials** tab → **Mint Credential**.
   A `Key ID` + `secret` are shown **once**. Copy the full `<keyId>.<secret>` string now — you'll
   paste it into the demo script in Act 2.
   Say: *"This secret is shown exactly once, like a Stripe key. It's what the SDK authenticates
   with — completely separate from my own login."*

4. **Create a Provider** — **Providers** tab → **New Provider** → paste the OpenAI/Anthropic key,
   set a default model (e.g. `gpt-4o-mini` or `claude-sonnet-4-6`).
   Say: *"Every agent needs model credentials. This Project brings its own — it's never billed to
   my personal account."*

5. **Create an Agent** — **Agents** tab → **New Agent**:
   - Name: `Career Coach`
   - System prompt: `You help students find internships and give concise, practical advice.`
   - Provider: the one you just created
   - Visibility: `unlisted`
   Save it.
   Say: *"That's a real, working AI agent, live on our backend, in under a minute — no code yet."*

6. **(Optional, if time allows) Talk to it right here** using the built-in test chat in the Agent
   editor, so the audience sees it respond before you ever touch the SDK.

At this point you have everything the SDK needs: a **credential**, an **Agent id**, and a
**Provider**. Now switch to the terminal.

---

## 5. Act 2 — Raw server SDK, one-off call (~2 minutes)

Say: *"First, the simplest possible integration: a plain Node script calling our server SDK
directly. Good for scripts, cron jobs, or a single backend endpoint — not yet a full chat UI."*

### 5.1 The demo script

Save this as `sdk-demo.mjs` anywhere (e.g. repo root, or `scratchpad/`) and fill in the two values
at the top:

```js
// sdk-demo.mjs — run with: node sdk-demo.mjs
import { PersonaClient } from '@personaai/sdk';

const BASE_URL = 'http://localhost:3000';
const CREDENTIAL = 'PASTE_YOUR_KEYID.SECRET_HERE';   // from Studio → Credentials → Mint
const AGENT_ID = 'PASTE_YOUR_AGENT_ID_HERE';         // from Studio → Agents → Career Coach → URL/id

async function main() {
  // 1. Admin-plane client — no external user asserted. Good for provisioning/control-plane calls.
  const persona = new PersonaClient({ baseUrl: BASE_URL, credential: CREDENTIAL });

  const who = await persona.whoami();
  console.log('✅ Authenticated as:', who.principalType, '| domain:', who.domain);

  // 2. List the agents this Project owns (proves the SDK sees what Studio created).
  const { agents } = await persona.agents.list();
  console.log(`✅ Project has ${agents.length} agent(s):`, agents.map((a) => a.name));

  // 3. Scope a client to one of YOUR end users (Coursify's own student, e.g. "student_42").
  const userClient = new PersonaClient({
    baseUrl: BASE_URL,
    credential: CREDENTIAL,
    externalUserId: 'student_42',
  });

  // 4. Create a Thread (a real conversation) for that student with the Career Coach agent.
  const thread = await userClient.threads.create({ agentId: AGENT_ID });
  console.log('✅ Created thread:', thread._id);

  // 5. Stream a live chat response — the same AG-UI protocol the browser UI uses.
  console.log('\n🤖 Career Coach says:\n');
  for await (const event of userClient.chat.stream(AGENT_ID, {
    threadId: thread._id,
    messages: [{ role: 'user', content: 'What internships should a CS sophomore look for?' }],
  })) {
    if (event.type === 'TEXT_MESSAGE_CHUNK' && event.delta) process.stdout.write(event.delta);
  }
  console.log('\n\n✅ Done — full round trip: Studio-created agent → SDK auth → streamed chat.');
}

main().catch((err) => {
  console.error('❌ Demo failed:', err.message);
  process.exit(1);
});
```

Run it:

```bash
node sdk-demo.mjs
```

Say while it streams: *"That's a live, token-by-token stream from our AG-UI runtime — the exact
same event protocol that powers the chat UI you just saw in Studio, just consumed from a plain Node
script instead of a browser."*

### 5.2 If you want a second, punchier moment: the `curl` version

For an audience that wants to see "it's just HTTP under the hood," show the raw call once:

```bash
curl -s http://localhost:3000/api/v1/developer/whoami \
  -H "Authorization: Bearer $CREDENTIAL" | jq
```

---

## 6. Act 3 — The real integration: `@personaai/adapters` + `@personaai/react` (~5 minutes)

Say: *"That last script is fine for a cron job, but no real product hand-rolls its own chat
streaming, thread management, and file handling. Here's what an actual customer ships: their
backend mounts our adapter — one line, the credential never leaves the server — and their React
frontend uses our hooks, which already know how to stream, handle interrupts, and manage threads.
This is `examples/chat-sdk-app` in this repo — a real Next.js app, not a toy."*

You already installed it and set its env vars in step 3.4.

### 6.1 Backend — mount the whole runtime in one file

`examples/chat-sdk-app/src/app/api/persona/[...persona]/route.ts` (already in the repo, nothing to
write):

```ts
import { createPersonaHandler } from "@personaai/adapters/nextjs/server";

export const { GET, POST, PUT, PATCH, DELETE } = createPersonaHandler({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUserFrom: async () => "chat-sdk-demo-user", // swap for real auth in production
});

export const dynamic = "force-dynamic";
```

Say: *"One catch-all route file. Every route Persona needs — streaming chat, threads, files,
memory, MCP OAuth — now exists under `/api/persona` on **this app's own domain**. The Project
credential lives only in this server process's environment; it never reaches the browser."*

### 6.2 Frontend — a full chat UI, already built

`examples/chat-sdk-app/src/app/page.tsx` (also already in the repo):

```tsx
"use client";
import { PersonaProvider } from "@personaai/adapters/nextjs";
import { PersonaChatView } from "@/components/persona/chat-sdk";

export default function Home() {
  return (
    <PersonaProvider baseUrl="/api/persona" defaultAgentId={process.env.NEXT_PUBLIC_PERSONA_AGENT_ID}>
      <div className="h-screen w-screen">
        <PersonaChatView agentId={process.env.NEXT_PUBLIC_PERSONA_AGENT_ID} title="Support Chat" />
      </div>
    </PersonaProvider>
  );
}
```

`PersonaChatView` is built entirely on `@personaai/react` hooks (`useChat` underneath) plus this
app's own shadcn component library (`base-lyra` registry) — thread sidebar, markdown rendering,
tool-call cards, an interrupt approval panel, a sandbox terminal replay, voice, and a memory/files
browser, all wired for you.

```bash
cd examples/chat-sdk-app
pnpm dev             # http://localhost:3001 (or whatever port next dev picks)
```

Open it, type a message, and let it stream live.

Say while it streams: *"No manual SSE parsing, no manual thread-id plumbing, no custom UI — this
entire interface, tool calls and all, came from one hook and one component. Swap that route file
for Express or NestJS and this exact frontend code doesn't change at all — same hook, same
provider, same component."*

### 6.3 If you also want to show off shadcn

This app already has a full shadcn component library installed at
`examples/chat-sdk-app/src/components/ui/` (~60 components — `dropdown-menu.tsx`, `sidebar.tsx`,
`sheet.tsx`, `dialog.tsx`, `command.tsx`, etc., registry style `base-lyra`). `PersonaChatView` is
built entirely from these, so pointing that out doubles as proof the Persona components aren't a
walled-off widget — they're normal shadcn components you can restyle or recompose like any other
`components/ui/*` in your own app.

### 6.4 The punchline to say out loud

> "Three integration depths, same backend, same agent: a raw SDK call for a script, an adapter
> mount for a whole backend, and React hooks for a whole chat UI — pick the depth that matches
> what you're building, and none of them ever expose the credential to a browser."

---

## 7. Stretch demos (only if time / interest allows)

Pick one or two of these to show platform depth beyond basic chat — all real, shipped features:

- **Human-in-the-loop / interrupts** — show `result.interrupt` pausing a run for approval and
  resuming it with `resume: { decisions: [...] }` (see SDK README "Chat, streamed" section).
- **Knowledge base / RAG** — `persona.knowledge.create(...)` + upload a PDF, then ask the agent a
  question only that document could answer.
- **MCP connectors** — attach an MCP server to the agent from Studio's Connectors tab, show the
  agent calling an external tool mid-conversation.
- **REST Tools defined in code** — `defineRestTool` from `@personaai/sdk/rest-tools`, no-code tool
  discovery via a manifest URL (full example in `sdk/typescript/README.md` under "Defining REST
  tools in code").
- **Workflows** — `persona.workflows.stream(workflowId, { input })`, showing node-level
  `workflow_node_started` / `workflow_node_completed` events for a multi-step pipeline.
- **Sandbox terminal** — an Agent with `sandboxEnabled` running real shell commands, surfaced as
  `TOOL_CALL_CHUNK` / `TOOL_CALL_RESULT` events (mention this only if you actually have a
  sandbox-enabled agent set up beforehand — don't build one live).
- **Next.js instead of Express** — swap Act 3's `server.mjs` for `@personaai/adapters/nextjs/server`'s
  `createPersonaHandler` in a single catch-all route file (`app/api/persona/[...persona]/route.ts`)
  and `@personaai/adapters/nextjs`'s re-exported `PersonaProvider` — the React chat component doesn't
  change at all, only where the runtime is mounted.
- **Devtools panel** — drop `<PersonaDevtools>` from `@personaai/devtools/react` into the demo
  frontend to show messages/threads/files live in a floating debug panel, dev-only.

---

## 8. Fallback plan (if live demo breaks)

- **Backend won't start**: check `MONGODB_URI` is reachable and `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`
  is set in `agent-backend/.env`. Worst case, show the pre-recorded flow via `sdk/typescript/README.md`
  code blocks and narrate over them instead of running live.
- **Streaming looks stuck**: confirm the Provider's model id is valid and the key has quota — a
  silently-failing LLM call is the #1 cause of a "nothing happens" demo moment.
- **Have a second Project/Agent/credential pre-created** before the demo starts, as a backup in case
  live creation hits an edge case in front of the audience — swap `CREDENTIAL`/`AGENT_ID` in
  `sdk-demo.mjs` and re-run.

---

## 9. Quick reference — the package stack

| Package | Runs where | Use it for |
| --- | --- | --- |
| `@personaai/sdk` | Your server | Raw, typed calls to every Developer Platform resource + AG-UI streaming — the primitive everything else builds on |
| `@personaai/adapters` | Your server | Mounts the *entire* runtime (chat, threads, files, memory, MCP OAuth) behind one route in Express, NestJS, or Next.js — no manual plumbing, credential stays server-side |
| `@personaai/react` | Your browser | `PersonaProvider` + hooks (`useChat`, `useThreads`, `useFiles`, `useMemory`, `useVoice`, `useWorkflowStream`, ...) for a full chat/agent UI, talking to your own mounted route |
| `@personaai/devtools` | Your browser (dev only) | Floating debug panel over live hook state — zero runtime change, not bundled unless imported |
| `@personaai/runtime` | Your server | The framework-agnostic engine `@personaai/adapters` wraps — drop to this directly for a custom framework |

### `@personaai/sdk` resource map

| Client property | Backend route |
| --- | --- |
| `.agents` | `/api/v1/developer/agents` |
| `.skills` | `/api/v1/developer/skills` |
| `.knowledge` | `/api/v1/developer/knowledge` |
| `.mcps` / `.mcps.oauth` | `/api/v1/developer/mcps` |
| `.restTools` | `/api/v1/developer/rest-tools` |
| `.workflows` | `/api/v1/developer/workflows` |
| `.providers` | `/api/v1/developer/providers` |
| `.threads` | `/api/v1/developer/threads` |
| `.memory` | `/api/v1/developer/memory` |
| `.stores` | `/api/v1/developer/stores` |
| `.files` | `/api/v1/developer/files` |
| `.chat` | `/api/v1/developer/agui` (streaming) |
| `.architect` | `/api/v1/developer/architect/agui` (streaming) |

### `@personaai/react` hooks (highlights)

| Hook | Purpose |
| --- | --- |
| `useChat` | Streaming chat — messages, send, stop, reload, interrupts, live workspace/todo state, sandbox commands |
| `useArchitectChat` | Same mechanics as `useChat`, targeting the Agent Architect co-pilot |
| `useThreads` | Thread CRUD — list, create, delete, rename, reset, archive |
| `useFiles` / `useMemory` / `useWorkspaceFiles` | File uploads and persistent memory (`user`/`agent`/`workspace` scopes) |
| `useVoice` | Real-time voice calls (Gemini Live) |
| `useWorkflowStream` / `useWorkflows` / `useWorkflow` / `useWorkflowRuns` | Workflow execution + authoring |

Full reference: `sdk/typescript/README.md`, `sdk/react/README.md`, `sdk/adapters/README.md`, and
`developer-docs/guides/sdk-quickstart.mdx`.

**Out of scope for all of the above** (Clerk-session only, do from Developer Studio): Project
creation, Members, Credentials management.
