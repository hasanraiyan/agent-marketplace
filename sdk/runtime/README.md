# @personaai/runtime

Framework-agnostic runtime engine for [Persona](https://persona.hasanraiyan.me). This is the
shared engine every framework adapter (`@personaai/express`, `@personaai/nextjs`, ...) is meant
to be a thin translation layer over — see
[the SDK Ecosystem plan](https://github.com/hasanraiyan/agent-marketplace/blob/feat/ai/product-research/11-sdk-new/package-ecosystem.md).

**v0.5.1.** The first framework adapter has shipped: [`@personaai/express` v0.1.0](https://persona.hasanraiyan.me/guides/express/quickstart)
(Wave 3 of the
[SDK Ecosystem plan](https://github.com/hasanraiyan/agent-marketplace/blob/feat/ai/product-research/11-sdk-new/package-ecosystem.md))
is published and mounts this runtime as an Express Router. For non-Express hosts, see
[Quickstart](#quickstart) for how to run it directly against raw Node `http`, and
[Not yet implemented](#not-yet-implemented) for what's missing before it's a complete Level 2
runtime.

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

## Quickstart (raw Node `http`)

Using Express? Skip this section and use the published [`@personaai/express` adapter](https://persona.hasanraiyan.me/guides/express/quickstart).
For every other host there's no `@personaai/node` adapter package yet, so this release ships a
small, tested bridge at [`examples/node-handler.ts`](./examples/node-handler.ts) in this repo
for running the runtime directly against Node's `http` module, just enough to demo/smoke-test
the runtime end to end until `@personaai/node` ships. It parses multipart file uploads too, via
Node's native `Request`/`FormData` (undici) — no extra dependency.

**This file is not published to npm and has no `exports` entry** (`package.json`'s `files` only
ships `dist/`, and `exports` only maps `.`) — `import ... from '@personaai/runtime/examples/...'`
fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` after a real `npm install`. Copy the file into your own
project instead (it's plain TypeScript with no runtime-internal dependencies):

```ts
import { createServer } from 'node:http';
import { createRuntime } from '@personaai/runtime';
import { toNodeHandler } from './node-handler.js'; // copied from this repo's examples/ — not importable from the published package, see note below

const runtime = createRuntime({
  baseUrl: process.env.PERSONA_BASE_URL!,
  credential: process.env.PERSONA_CREDENTIAL!,
  resolveUser: (request) => request.headers['x-demo-user-id'] ?? null,
});

createServer(toNodeHandler(runtime)).listen(3210);
```

## Routes

All routes are relative to whatever `mountPath` you configure (default: none, i.e. the runtime
expects `request.path` already stripped). Every route except `/health` requires an authenticated
user; `resolveUser` returning `null` or throwing responds `401`.

### Always on — end-user-scoped, no capability flag needed

| Method | Path | Proxies to |
| --- | --- | --- |
| `POST` | `/chat` | `client.chat.stream(agentId, {messages, threadId, resume, contextOverride})`, streamed out as SSE. `agentId`/`messages` required in the body. Response carries an `x-persona-run-id` header — see [Reconnect and resume](#reconnect-and-resume). |
| `GET` | `/chat/:runId/resume` | Reattaches to the run started by the matching `POST /chat`. See [Reconnect and resume](#reconnect-and-resume). |
| `GET` | `/threads` | `client.threads.list({page, limit})` |
| `POST` | `/threads` | `client.threads.create({agentId})` |
| `POST` | `/threads/bulk-delete` | `client.threads.bulkDelete(ids)` |
| `GET` | `/threads/:id` | `client.threads.get(id)` |
| `PATCH` | `/threads/:id` | `client.threads.update(id, {title?, isArchived?})` |
| `DELETE` | `/threads/:id` | `client.threads.delete(id)` → `204` |
| `GET` | `/threads/:id/messages` | `client.threads.getMessages(id)` — full history + graph state, the same data `chat.stream()` resumes from; load a past conversation on page reopen. |
| `GET` | `/agents` | `client.agents.list({page, limit, search, category, scope})` — read-only discovery, e.g. "let the user pick an agent." |
| `GET` | `/files` | `client.files.list({page, limit})` |
| `POST` | `/files` | `client.files.upload({filename, content, contentType?, agentId?, threadId?})` — multipart, `file` part required. `201` |
| `POST` | `/files/bulk-delete` | `client.files.bulkDelete(ids)` |
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

`scope` for memory routes is `'user'` (default) or `'agent'` (`agentId` then required).

For `POST /files`, a framework adapter must parse the incoming multipart body and populate
`RuntimeRequest.file` (`{filename, content: Uint8Array, contentType?}`) plus put any other form
fields (`agentId`, `threadId`) on `RuntimeRequest.body` — the runtime itself never touches raw
bytes or a specific multipart parser. See `examples/node-handler.ts`'s `readMultipartBody` for
the reference approach (it also handles `POST /knowledge/:id/documents`'s multi-file `files`
field, below).

### Opt-in — Project-level admin surface, `capabilities.*` gated

See [Capabilities](#capabilities--admin-surface) for what these are, why they default off, and
how to enable them safely.

| Method | Path | Capability | Proxies to |
| --- | --- | --- | --- |
| `POST` | `/agents` | `agentsWrite` | `client.agents.create(input)` |
| `GET`/`PATCH`/`DELETE` | `/agents/:id` | `agentsWrite` | `client.agents.get/update/delete(id)` |
| `POST` | `/agents/bulk-delete` | `agentsWrite` | `client.agents.bulkDelete(ids)` |
| `GET`/`POST` | `/mcps` | `mcps` | `client.mcps.list/create` |
| `GET`/`PATCH`/`DELETE` | `/mcps/:id` | `mcps` | `client.mcps.get/update/delete(id)` |
| `POST` | `/mcps/bulk-delete` | `mcps` | `client.mcps.bulkDelete(ids)` |
| `GET` | `/mcps/:id/usage` | `mcps` | `client.mcps.getUsage(id)` |
| `POST` | `/mcps/:id/test` | `mcps` | `client.mcps.testConnection(id)` |
| `GET` | `/mcps/:id/resource?uri=` | `mcps` | `client.mcps.readResource(id, uri)` |
| `POST` | `/mcps/:id/call-tool` | `mcps` | `client.mcps.callTool(id, name, arguments)` |
| `GET`/`POST` | `/providers` | `providers` | `client.providers.list/create` — **holds API keys** |
| `GET`/`PATCH`/`DELETE` | `/providers/:id` | `providers` | `client.providers.get/update/delete(id)` |
| `POST` | `/providers/bulk-delete` | `providers` | `client.providers.bulkDelete(ids)` |
| `POST` | `/providers/:id/test` | `providers` | `client.providers.testConnection(id)` |
| `GET` | `/providers/:id/models` | `providers` | `client.providers.getModels(id)` |
| `GET` | `/providers/:id/usage` | `providers` | `client.providers.getUsage(id)` |
| `GET`/`POST` | `/skills` | `skills` | `client.skills.list/create` |
| `GET`/`PATCH`/`DELETE` | `/skills/:id` | `skills` | `client.skills.get/update/delete(id)` |
| `POST` | `/skills/bulk-delete` | `skills` | `client.skills.bulkDelete(ids)` |
| `GET` | `/skills/:id/usage` | `skills` | `client.skills.getUsage(id)` |
| `GET`/`POST` | `/knowledge` | `knowledge` | `client.knowledge.list/create` |
| `GET`/`PATCH`/`DELETE` | `/knowledge/:id` | `knowledge` | `client.knowledge.get/update/delete(id)` |
| `POST` | `/knowledge/bulk-delete` | `knowledge` | `client.knowledge.bulkDelete(ids)` |
| `GET` | `/knowledge/:id/usage` | `knowledge` | `client.knowledge.getUsage(id)` |
| `POST` | `/knowledge/:id/documents` | `knowledge` | `client.knowledge.uploadDocuments(id, files)` — multipart, one or more `files` parts required. `201` |
| `GET` | `/knowledge/:id/documents` | `knowledge` | `client.knowledge.listDocuments(id)` |
| `DELETE` | `/knowledge/:id/documents/:sourceName` | `knowledge` | `client.knowledge.deleteDocument(id, sourceName)` |
| `POST` | `/knowledge/:id/search` | `knowledge` | `client.knowledge.search(id, query, {topK?})` |
| `GET`/`POST` | `/stores` | `stores` | `client.stores.list/create` |
| `GET`/`PATCH`/`DELETE` | `/stores/:id` | `stores` | `client.stores.get/update/delete(id)` |
| `GET` | `/stores/:id/files` | `stores` | `client.stores.listFiles(id)` |
| `GET`/`PUT`/`DELETE` | `/stores/:id/file` | `stores` | `client.stores.getFile/writeFile/deleteFile(id, {path, content?})` |
| `GET` | `/audit-logs` | `auditLogs` | `client.auditLogs.list({page, limit, eventType})` |
| `POST` | `/architect` | `architect` | `client.architect.stream({messages, resume})`, streamed out as SSE, same `x-persona-run-id`/reconnect mechanics as `/chat`. No `agentId` — the Architect builds/edits the caller's own Agents. |
| `GET` | `/architect/:runId/resume` | `architect` | Reattaches to the matching `POST /architect` run. |

A disabled capability's routes are simply absent from the route table — a request to one 404s
(or, where an always-on route shares the same path with a different method, e.g. `POST /agents`
while only `GET /agents` is always-on, `405`) rather than 403, so a disabled capability leaks no
information about what it would have done.

## Capabilities — admin surface

The routes above are split into two trust tiers, and this is a deliberate design choice, not an
oversight:

- **Always on**: things an end user does in their own chat session — send messages, manage their
  own conversations/files/memory, connect their own MCP account. Scoped entirely to whichever
  user `resolveUser` returns.
- **Opt-in via `capabilities`**: Project-level configuration — LLM provider credentials, skill
  authoring, knowledge base and vector store management, security audit logs, an agent-building
  co-pilot, and full Agent/MCP-server CRUD. **Every one of these defaults to `false`.** Upgrading
  this package never silently exposes new surface to whoever `resolveUser` accepts.

```ts
createRuntime({
  // ...
  capabilities: {
    agentsWrite: false, // default
    mcps: false,        // default
    providers: false,   // default — holds API keys, think hard before enabling
    skills: false,       // default
    knowledge: false,    // default
    stores: false,        // default
    auditLogs: false,     // default
    architect: false,     // default
  },
});
```

**Most hosts should never turn any of these on**, and should instead call `@personaai/sdk`
directly from their own admin backend/CLI/setup script for Project configuration — that's what
"belongs to the host application" means in practice.

If you *do* want an admin surface reachable over HTTP (e.g. building your own internal admin
tool on top of this runtime), the right pattern is **two separate `createRuntime()` calls
mounted at two different paths**, each with its own `resolveUser`:

```ts
const appRuntime = createRuntime({
  baseUrl, credential,
  resolveUser: resolveEndUser, // your normal app auth — any logged-in user
});

const adminRuntime = createRuntime({
  baseUrl, credential,
  resolveUser: resolveAdminUser, // a stricter check — only your team
  capabilities: { providers: true, skills: true, knowledge: true, stores: true, auditLogs: true, architect: true, mcps: true, agentsWrite: true },
});

// mount appRuntime at /api/persona, adminRuntime at /api/admin/persona,
// each behind whatever auth middleware your framework adapter wires up
```

This is coarse-grained by design: a capability is either fully on or fully off for whoever
`resolveUser` accepts on that mount — there's no per-user or per-action permission model inside
the runtime itself (e.g. "this user can update Agents but not delete them" isn't expressible).
If you need that, enforce it in `resolveUser` (reject the request before it reaches the route) or
in a hook, not by asking this runtime for finer granularity than "on this mount, for this
resolved identity, is the capability on."

## Lifecycle hooks

Plain async event listeners, not middleware — the runtime proceeds with sensible defaults when a
hook is omitted, and a hook that wants to reject a run just throws (the throw is caught and
routed through the same sanitized error response as any other failure). **All eight are wired.**

```ts
createRuntime({
  // ...
  hooks: {
    beforeRun(ctx) {
      // ctx: { userId, kind: 'chat' | 'architect', agentId?, threadId?, messages }
      // Fires before POST /chat's or POST /architect's stream starts.
      // agentId is only set for kind: 'chat' — the Architect has none of its own.
    },
    afterRun(ctx, result) {
      // result: { text, eventCount, interrupted, erroredInBand }
      // erroredInBand is true when the stream's last event was RUN_ERROR —
      // that's a normal completed-run outcome, not a thrown exception, so
      // afterRun still fires (onError does not).
    },
    onError(ctx, error) {
      // ctx.phase: 'auth' | 'chat' | 'architect'
      // Fires on a thrown exception only: the initial request failing
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

## Reconnect and resume

If a client's connection to `/chat` drops mid-stream, it can pick up exactly where it left off:

```ts
const res = await fetch('/chat', { method: 'POST', body: JSON.stringify({ agentId, messages }) });
const runId = res.headers.get('x-persona-run-id')!;
// ... connection drops after receiving N frames ...
const resumed = await fetch(`/chat/${runId}/resume?since=${lastSeqSeen}`);
// streams every frame after `lastSeqSeen`, then continues live until the run finishes
```

This works because a chat run is never tied to the HTTP response that started it. `POST /chat`
constructs an internal `RunDriver` that starts pumping `chat.stream()` the moment the run begins
and keeps running independently of whether anyone is still listening — buffering every formatted
SSE frame with a sequence number and broadcasting to live subscribers. `GET /chat/:runId/resume`
just attaches a new subscriber to that same driver: it replays whatever's already buffered after
`since`, then streams new frames live until the run finishes. Lifecycle hooks (`afterRun`,
`onError`, etc.) fire exactly once per run regardless of how many times a client reconnects —
they belong to the driver, not to any one HTTP response.

Finished runs stay resumable for 5 minutes by default before an internal eviction sweep (running
every 60s) removes them; the registry also caps out at 1000 tracked runs by default, evicting the
oldest-finished ones first if a host's traffic pattern leaves many runs unclaimed. Both are
configurable:

```ts
createRuntime({
  // ...
  runGraceMs: 5 * 60 * 1000, // default
  maxTrackedRuns: 1000, // default
});
```

A resume request for an evicted, unknown, or someone-else's run returns `404 RUN_NOT_FOUND`
(never `403` — a `404` doesn't confirm whether the id ever existed).

**Honest limitation: this is single-process and in-memory only.** A `RunDriver` holds a live
upstream connection and a JS closure over its subscribers — it cannot be represented in Redis or
shared across separate runtime instances. This closes the reconnect gap for the common
single-instance deployment (the client dropped and came back, same server process still running).
If you run more than one instance behind a load balancer — multiple Kubernetes pods, a PM2
cluster, etc. — a reconnect that lands on a *different* instance than the one running the
original pump won't find the run (`404 RUN_NOT_FOUND`) even though it's still live elsewhere.

**Today's mitigation (deployment-level, no code change):** configure your load balancer for
session affinity / sticky sessions (route a given client to the same instance) so reconnects
land back where the run actually lives. This doesn't survive that instance crashing or being
redeployed, and doesn't apply to serverless (no persistent instance to stick to), but covers the
common case for free.

**Planned (not yet built):** a pluggable `RunBroker` interface — publish/subscribe/claim-ownership
for run frames — so a host can back it with Redis (or anything else) and get resume working
across instances, including a resume request landing on an instance that never touched the
original pump. The in-memory behavior above would remain the zero-config default; a Redis (or
similar) implementation would be opt-in, not a dependency this package forces on everyone.
Deliberately deferred rather than built speculatively — track
[issue #229](https://github.com/hasanraiyan/agent-marketplace/issues/229) or open a new one if you
need this now.

`createRuntime()` returns a `close()` method that stops the eviction timer; the timer is also
`unref`'d so it won't itself keep a Node process alive, but call `close()` if you construct
runtimes repeatedly in a long-lived process (e.g. per-test-suite setup) to avoid accumulating
timers.

## Heartbeats and backpressure

`POST /chat` and `GET /chat/:runId/resume` both send an SSE comment-line heartbeat
(`: heartbeat\n\n`) during any gap between real AG-UI events — e.g. a long-running tool call with
no token output — so intermediary proxies and load balancers with an idle-connection timeout
don't kill the stream. Comment lines are invisible to any `data:`-only SSE parser (including
`@personaai/sdk`'s own `parseAguiEventStream`), so a consumer never sees them as part of the
event sequence.

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

**Backpressure has a real, deliberate tradeoff as of reconnect support.** Before reconnect
existed, a slow or disconnected consumer propagated backpressure all the way back to Persona's
server — the runtime never pulled a frame it hadn't been asked for. That's no longer true: a
`RunDriver`'s pump starts draining `chat.stream()` the moment the run begins and keeps going
regardless of subscriber speed, because resumability requires buffering whatever a reconnecting
client might ask to replay. You cannot have both "backpressure all the way to the source" and "a
disconnected client can come back and get what it missed" — they're in direct tension, and this
runtime chose resumability. What's still true and tested (`test/runDriver.test.ts`): the pump
drains the upstream generator exactly once, strictly in order, with no duplicate or skipped
`next()` calls, no matter how many subscribers attach or how slowly they read. Per-run buffers
are bounded by that one run's event count (not indefinite) and released after the grace period
described above. The Node bridge in `examples/` still layers transport-level backpressure via
`res.write()`'s return value and the `drain` event — that protects against one slow subscriber
blocking the Node process's memory, but it no longer protects against the *runtime itself*
buffering an in-progress run that nobody is currently reading.

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

This is v0.5.1. Every SDK resource now has a route (see [Routes](#routes)); what's left is either a
genuine unclosed gap or an intentional package boundary, not an oversight:

- **Multi-instance reconnect/resume** — see
  [Reconnect and resume](#reconnect-and-resume) above. Single-process resume is implemented and
  tested; sharing a live run across separate runtime instances would need a message-broker
  architecture this package doesn't provide. This is the one real gap.
- **Fine-grained (per-user, per-action) permissions within an enabled capability** — **by
  design**, not a gap: see [Capabilities](#capabilities--admin-surface). A capability is on or off
  per mount; anything finer belongs in `resolveUser` or a hook, not the runtime.
- Framework adapters beyond the shipped ones (`@personaai/node`, `@personaai/fastify`,
  `@personaai/hono`) — **by design**, not a gap: this package is the foundation they're meant to
  wrap, not a replacement for them. `@personaai/nextjs` (Wave 2), `@personaai/express` and
  `@personaai/nestjs` (Wave 3) have shipped.

## Roadmap

- A pluggable `RunBroker` interface for multi-instance reconnect/resume (Redis or similar,
  opt-in) — see [Reconnect and resume](#reconnect-and-resume).
- Framework adapters (Wave 2–3 of the ecosystem plan) are the natural next step once this runtime
  is battle-tested — each should be a thin translation layer, proving the framework-neutral
  contract here is actually sufficient.
