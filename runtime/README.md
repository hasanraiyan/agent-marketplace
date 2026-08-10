# @personaai/runtime

Framework-agnostic runtime engine for [Persona](https://persona.hasanraiyan.me). This is the
shared engine every framework adapter (`@personaai/express`, `@personaai/nextjs`, ...) is meant
to be a thin translation layer over — see
[the SDK Ecosystem plan](https://github.com/hasanraiyan/agent-marketplace/blob/feat/ai/product-research/11-sdk-new/package-ecosystem.md).

**v0.4.** Not installed directly by most developers yet — there is no published framework
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
| `POST` | `/chat` | `client.chat.stream(agentId, {messages, threadId, resume, contextOverride})`, streamed out as SSE. `agentId`/`messages` required in the body. Response carries an `x-persona-run-id` header — see [Reconnect and resume](#reconnect-and-resume). |
| `GET` | `/chat/:runId/resume` | Reattaches to the run started by the matching `POST /chat`, replaying frames after `?since=<seq>` (default `-1`, from the start) then continuing live until the run finishes. `404` if the run is unknown, already evicted, or belongs to a different user. |
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
single-instance deployment (the client dropped and came back, same server process still running),
which is what "not implemented" meant in earlier releases. True multi-instance resume — the
client reconnects and lands on a *different* process/instance than the one running the original
pump — would need a fundamentally different architecture (a message broker relaying AG-UI events
between processes, with exactly one process owning the actual upstream pump) and is out of scope
here.

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

This is v0.4 — still not the full [issue #229](https://github.com/hasanraiyan/agent-marketplace/issues/229)
checklist, and two of these are intentionally out of scope for this package rather than gaps:

- **Multi-instance reconnect/resume** — see
  [Reconnect and resume](#reconnect-and-resume) above. Single-process resume is implemented and
  tested; sharing a live run across separate runtime instances would need a message-broker
  architecture this package doesn't provide.
- Any published framework adapter (`@personaai/express`, `@personaai/nextjs`, `@personaai/node`,
  `@personaai/fastify`, `@personaai/hono`, `@personaai/nestjs`) — **by design**, not a gap: this
  package is the foundation they're meant to wrap, not a replacement for them.
- Authorization/RBAC for MCP owner-mode OAuth routes — **by design**, not a gap: the runtime
  exposes the raw capability, gating who's allowed to call it is the host's own business decision
  (see the Routes section above).

## Roadmap

Framework adapters (Wave 2–3 of the ecosystem plan) are the natural next step once this runtime
is battle-tested — each should be a thin translation layer, proving the framework-neutral
contract here is actually sufficient.
