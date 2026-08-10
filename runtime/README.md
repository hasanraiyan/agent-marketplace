# @personaai/runtime

Framework-agnostic runtime engine for [Persona](https://persona.hasanraiyan.me). This is the
shared engine every framework adapter (`@personaai/express`, `@personaai/nextjs`, ...) is meant
to be a thin translation layer over — see
[the SDK Ecosystem plan](https://github.com/hasanraiyan/agent-marketplace/blob/feat/ai/product-research/11-sdk-new/package-ecosystem.md).

**v0.3.** Not installed directly by most developers yet — there is no published framework
adapter for it in this release. See [Quickstart](#quickstart) for how to run it directly against
raw Node `http` in the meantime, and [Not yet implemented](#not-yet-implemented) for what's
missing before it's a complete Level 2 runtime.

**Server-side only.** The credential this runtime holds is a server-side secret — never bundle
this into a browser app.

## Install

```
npm install @personaai/runtime
```

## The user resolver contract

Persona never authenticates users. The runtime receives a request and asks *you* who it's from:

```ts
import { createRuntime } from '@personaai/runtime';

const runtime = createRuntime({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUser: async (request) => {
    // Your auth, your rules — Clerk, a JWT, a session cookie, whatever you
    // already use. Return the resolved external user id, or null/throw if
    // the request isn't authenticated (the runtime responds 401 either way).
    return getUserIdFromSession(request.headers['cookie']);
  },
});
```

`resolveUser` is the single point of contact between your auth world and Persona's runtime
world — see `RunContext`/the design notes below for why this boundary is absolute.

## Quickstart (raw Node `http`, no framework adapter yet)

There's no published `@personaai/node` adapter package yet, so this release ships a small,
tested bridge in `examples/` for running the runtime directly against Node's `http` module —
**not itself a published entry point**, just enough to demo/smoke-test the runtime end to end
until `@personaai/node` ships. It parses multipart file uploads too, via Node's native
`Request`/`FormData` (undici) — no extra dependency:

```ts
import { createServer } from 'node:http';
import { createRuntime } from '@personaai/runtime';
import { toNodeHandler } from '@personaai/runtime/examples/node-handler.js'; // not a stable public API

const runtime = createRuntime({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUser: (request) => request.headers['x-demo-user-id'] ?? null,
});

createServer(toNodeHandler(runtime)).listen(3210);
```

## Routes

All routes are relative to whatever `mountPath` you configure (default: none, i.e. the runtime
expects `request.path` already stripped).

| Method | Path | Proxies to |
| --- | --- | --- |
| `POST` | `/chat` | `client.chat.stream(agentId, {messages, threadId, resume, contextOverride})`, streamed out as SSE. `agentId`/`messages` required in the body. |
| `GET` | `/threads` | `client.threads.list({page, limit})` |
| `POST` | `/threads` | `client.threads.create({agentId})` |
| `GET` | `/threads/:id` | `client.threads.get(id)` |
| `PATCH` | `/threads/:id` | `client.threads.update(id, {title?, isArchived?})` |
| `DELETE` | `/threads/:id` | `client.threads.delete(id)` → `204` |
| `GET` | `/agents` | `client.agents.list({page, limit, search, category, scope})` |
| `GET` | `/files` | `client.files.list({page, limit})` |
| `POST` | `/files` | `client.files.upload({filename, content, contentType?, agentId?, threadId?})` — multipart, `file` part required. `201` |
| `GET` | `/files/:id` | `client.files.download(id)` — raw bytes, streamed through as `kind: 'binary'` |
| `DELETE` | `/files/:id` | `client.files.delete(id)` → `204` |
| `GET` | `/memory` | `client.memory.list()` |
| `GET` | `/memory/file` | `client.memory.getFile({path, scope?, agentId?})` — `path` query param required |
| `PUT` | `/memory/file` | `client.memory.writeFile({path, content, scope?, agentId?})` — creates or overwrites |
| `DELETE` | `/memory/file` | `client.memory.deleteFile({path, scope?, agentId?})` → `204` |
| `GET` | `/mcps/:id/oauth/owner/authorize` | `client.mcps.oauth.getOwnerAuthorizeUrl(id)` → `{url}` to redirect the Project owner to |
| `GET` | `/mcps/:id/oauth/user/authorize` | `client.mcps.oauth.getUserAuthorizeUrl(id, returnTo?)` → `{url}` to redirect the end user to |
| `GET` | `/mcps/:id/oauth/user/status` | `client.mcps.oauth.getUserConnectionStatus(id)` |
| `DELETE` | `/mcps/:id/oauth/user/connection` | `client.mcps.oauth.disconnectUserConnection(id)` → `204` |
| `DELETE` | `/mcps/:id/oauth/owner/connection` | `client.mcps.oauth.disconnectOwnerConnection(id)` → `204` |
| `GET` | `/health` | `client.whoami()` → `{status, version, capabilities}`. Does **not** require `resolveUser` — it's a liveness/capability probe, not a user-scoped call. |

Every route except `/health` requires an authenticated user; `resolveUser` returning `null` or
throwing responds `401`. `scope` for memory routes is `'user'` (default) or `'agent'`
(`agentId` then required).

For `POST /files`, a framework adapter must parse the incoming multipart body and populate
`RuntimeRequest.file` (`{filename, content: Uint8Array, contentType?}`) plus put any other form
fields (`agentId`, `threadId`) on `RuntimeRequest.body` — the runtime itself never touches raw
bytes or a specific multipart parser. See `examples/node-handler.ts`'s `readMultipartBody` for
the reference approach.

MCP OAuth owner-mode routes affect the shared MCP config for the whole Project — this runtime
has no concept of roles/permissions beyond "is there a resolved user" (RBAC is explicitly the
host's own business decision, not Persona's). A production host should gate these behind its own
authorization check, e.g. inside `resolveUser` or a wrapping middleware in front of the mount
point, before exposing them to end users.

## Lifecycle hooks

Plain async event listeners, not middleware — the runtime proceeds with sensible defaults when a
hook is omitted, and a hook that wants to reject a run just throws (the throw is caught and
routed through the same sanitized error response as any other failure). **All eight are wired
in v0.2:**

```ts
createRuntime({
  // ...
  hooks: {
    beforeRun(ctx) {
      // ctx: { userId, agentId, threadId?, messages } — fires before POST /chat's stream starts.
    },
    afterRun(ctx, result) {
      // result: { text, eventCount, interrupted, erroredInBand }
      // erroredInBand is true when the stream's last event was RUN_ERROR —
      // that's a normal completed-run outcome, not a thrown exception, so
      // afterRun still fires (onError does not).
    },
    onError(ctx, error) {
      // Fires on a thrown exception only: the initial chat request failing
      // (auth/validation/network) or the stream dying mid-read. Not on an
      // in-band RUN_ERROR event — see afterRun above.
    },
    beforeToolCall(ctx) {
      // ctx: { userId, agentId, threadId?, toolName, toolCallId }
      // Fires on each TOOL_CALL_START event inside a chat stream.
    },
    afterToolCall(ctx, result) {
      // Fires on the matching TOOL_CALL_RESULT event; `result` is the raw
      // (string or already-JSON) tool output.
    },
    onFileUpload(ctx) {
      // ctx: { userId, fileName, mimeType? } — fires after POST /files succeeds.
    },
    onThreadCreate(ctx) {
      // ctx: { userId, agentId, threadId } — fires on an explicit POST
      // /threads, AND when POST /chat's RUN_STARTED event reports a
      // threadId that wasn't supplied on the way in (Persona created one
      // implicitly for that turn).
    },
    onMemoryWrite(ctx) {
      // ctx: { userId, agentId?, path } — fires after PUT /memory/file succeeds.
    },
  },
});
```

## Heartbeats and backpressure

`POST /chat` sends an SSE comment-line heartbeat (`: heartbeat\n\n`) during any gap between real
AG-UI events — e.g. a long-running tool call with no token output — so intermediary proxies and
load balancers with an idle-connection timeout don't kill the stream. Comment lines are invisible
to any `data:`-only SSE parser (including `@personaai/sdk`'s own `parseAguiEventStream`), so a
consumer never sees them as part of the event sequence.

```ts
createRuntime({
  // ...
  heartbeatIntervalMs: 15000, // default; lower it for faster proxy timeouts, or raise it to reduce chatter
});
```

Heartbeats only cover gaps *after* the first event of a run — headers can't be sent until the
runtime has already peeked that first event to decide whether the run started successfully
(a 401/400/500 has to be a normal buffered response, not a stream), so there's no way to keep a
connection alive with heartbeats before that point. In practice this matters little: the gap
heartbeats exist for is a stalled *middle* of a run (a slow tool call), not the initial
time-to-first-token.

Backpressure is pull-based end to end and needed no new code to "add": `chatEventsToSseBody`
only calls the upstream `chat.stream()` generator's `next()` once per SSE frame the *consumer*
has asked for (verified in `test/backpressure.test.ts`), and a heartbeat firing re-races the same
pending `next()` call rather than issuing an extra one — it never reads ahead. The Node bridge in
`examples/` layers transport-level backpressure on top of that via `res.write()`'s return value
and the `drain` event, so a slow client can't make the runtime buffer an unbounded number of
events in memory.

**Reconnect/resume is not implemented, and can't be at this layer.** If a network connection
drops mid-stream, there is currently no way to resume the *same* run from where it left off —
`@personaai/sdk`'s `chat.stream()` only supports starting a fresh turn or resuming a *paused
human-in-the-loop interrupt* (via `resume`), not resuming an arbitrary in-progress run from a
byte/event position. Building real reconnect-and-resume would require either protocol support
from Persona's own hosted backend (out of scope for this package — it calls that backend, it
doesn't run it) or a client-side strategy of simply starting a new `/chat` call on the same
`threadId` once the previous one drops, accepting a small amount of duplicated/re-generated
context. The frontend concern this maps to (`@personaai/react`'s planned "transparent
reconnection on network drop") doesn't exist yet either — this is a real, currently-unclosed gap.

## Errors

Every error response is `{"error": {"code": "...", "message": "...", "detail"?: ...}}`. Two
modes (`mode: 'development' | 'production'`, default `'production'` unless
`NODE_ENV === 'development'`):

- Errors already curated into a developer-facing message — `RuntimeHttpError` (routing/validation
  errors this runtime raises itself) and `PersonaApiError`/`PersonaAuthError`/`PersonaValidationError`
  from `@personaai/sdk` — pass through as-is; `detail` (the upstream response envelope) is only
  attached in development mode.
- Anything else (a bug in your own hook code, a raw network error, ...) is treated as untrusted:
  always `500`/`INTERNAL_ERROR`, with a fixed generic message in production and the real
  message/stack under `detail` in development. This is what actually prevents internal
  implementation details (LangGraph, Qdrant, ...) from ever reaching a caller of this runtime.

## Not yet implemented

This is v0.3 — still not the full [issue #229](https://github.com/hasanraiyan/agent-marketplace/issues/229)
checklist. Missing:

- **Reconnect/resume of a dropped mid-stream connection** — see the
  [Heartbeats and backpressure](#heartbeats-and-backpressure) section above for why this is a
  real, currently-unclosed gap rather than a scoping choice.
- Any published framework adapter (`@personaai/express`, `@personaai/nextjs`, `@personaai/node`,
  `@personaai/fastify`, `@personaai/hono`, `@personaai/nestjs`) — this package is the foundation
  they're meant to wrap, not a replacement for them.
- Authorization/RBAC for MCP owner-mode OAuth routes — the runtime exposes the raw capability;
  gating who's allowed to call it is left to the host, by design (see the Routes section above).

## Roadmap

Framework adapters (Wave 2–3 of the ecosystem plan) are the natural next step once this runtime
is battle-tested — each should be a thin translation layer, proving the framework-neutral
contract here is actually sufficient.
