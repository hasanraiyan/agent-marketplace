# Changelog

All notable changes to `@personaai/runtime` are documented here. The package was built through
its 0.1 → 0.5 milestones before being published, so the pre-publish versions are backfilled from
the repo's history (squashed into the package's founding PR).

## 0.6.0

- **New: `POST /threads/:id/reset`, always on.** Proxies to `@personaai/sdk@^0.5.0`'s new
  `threads.reset(threadId)` — clears a Thread's message history, workspace files/todos, and
  subagent traces in place, keeping the same `_id`/`threadId`/title, so a caller can start a fresh
  conversation without the identity change that `delete()` + `create()` would force. Bumps the
  `@personaai/sdk` dependency to `^0.5.0` (was `^0.4.5`) to pick up the new method.

## 0.5.4

- Logger now via `@personaai/sdk@^0.4.5` re-exporting `@personaai/logger@^0.1.0` — no direct `logger` dep needed (still OFF by default, same `runtime`/`runtime:route`/`runtime:sdk` namespaces). Keeps `sdk` as the single server import; client adapters (`react`/`nextjs`) import `logger` directly.

## 0.5.3

- **Built-in logging — consumes the foundational logger from `@personaai/sdk@^0.4.4`.** `CreateRuntimeOptions` now accepts `logLevel` (`'off'|'error'|'warn'|'info'|'debug'|'trace'`, default `'off'`) and `logger` (custom `Logger` from the SDK, child-namespaced as `runtime`/`runtime:route`/`runtime:route:chat`/`runtime:sdk`). `createRuntime` logs init (mode, mountPath, capabilities) at `debug`/`info`/`trace`, `handle()` logs route match (`info`/`warn`), auth (`debug`/`warn`), handler start/success (`info`/`debug`/`trace`) and errors (`warn`/`error`), and the per-request `PersonaClient` inherits `runtime:sdk` so every SDK `HttpClient` call also logs when the runtime is enabled. `POST /chat` and `POST /architect` now log `runId` lifecycle via `ctx.logger`. Nothing logs unless the caller opts in — same OFF-default contract as the SDK.

## 0.5.2

- **New: `GET /agents/:id/mcp-connections`, always on (not gated behind any capability).** The
  underlying per-MCP status/authorize primitives (`getUserConnectionStatus`,
  `getUserAuthorizeUrl`) already existed as always-on routes, but there was no way to discover
  *which* MCPs an Agent has attached without `agentsWrite` (a write-tier capability inappropriate
  to grant just to show a "connect your account" banner in a chat UI). Returns
  `{ mcpId, name, description, connected, authorizeUrl }[]` for every `authType: 'oauth',
  authMode: 'user'` MCP the Agent has, in one call. Requires `@personaai/sdk@^0.4.3`.

## 0.5.1

Patch release — three backward-compatible bug fixes from review findings:

- `resolveUser` results are now normalized: anything that isn't a non-empty string (e.g. an
  async resolver that falls through without an explicit `return null` and yields `undefined`)
  is treated as unauthenticated and responds `401`. Previously `undefined` passed the `=== null`
  check and silently downgraded an auth-required route to a project-scoped call.
- `afterRun` is now isolated in its own try/catch — a throwing `afterRun` (e.g. a failed
  audit-log write) can no longer fire `onError` for a run that genuinely succeeded, or append a
  synthesized `RUN_ERROR` frame onto an already-finished stream.
- Fixed the documented no-adapter quickstart: it previously imported from
  `@personaai/runtime/examples/node-handler.js`, which cannot resolve after a real `npm install`
  (the package's `files` only ships `dist/`, and `exports` only maps `.`). Docs now say to copy
  the file into your own project instead.

## 0.5.0

Every SDK resource now has a route. The whole non-chat SDK surface that previously had no HTTP
routes — and the end-user-scoped gaps that did — are now reachable, with Project-level admin
operations gated behind opt-in `capabilities.*` flags:

- **New always-on (end-user-scoped) routes:** `GET /threads/:id/messages`,
  `POST /threads/bulk-delete`, `POST /files/bulk-delete`.
- **New capability-gated routes** (all default `false`, so upgrading never silently exposes new
  surface):
  - `agentsWrite` — full Agent CRUD beyond the always-on read-only `GET /agents`.
  - `mcps` — full MCP server CRUD + `testConnection`/`readResource`/`callTool` (separate from the
    always-on `/mcps/:id/oauth/*` end-user routes).
  - `providers`, `skills`, `knowledge` (incl. multi-file document upload/search), `stores`,
    `auditLogs` — full CRUD each.
  - `architect` — `POST /architect` + `GET /architect/:runId/resume`, reusing the exact same
    RunDriver/heartbeat/reconnect machinery as `/chat` (extracted into a shared
    `createResumeRoute(kind)` factory; `RunContext` gained a `kind: 'chat' | 'architect'`
    discriminant and `agentId` became optional, since the Architect has no Agent of its own).
- A disabled capability's routes are absent from the route table entirely (`404`, never `403` —
  a disabled capability leaks nothing about what it would have done).
- `RuntimeRequest` gained a plural `files` field (alongside the existing singular `file`) for
  knowledge's multi-file document upload.
- `/health`'s `capabilities` field now reflects the actually-resolved `RuntimeCapabilities`,
  not a static object — a monitoring tool can confirm what's live without reading config.
- Internal: extracted `src/routeHelpers.ts` (`json`/`noContent`/`requireParam`/
  `requireBodyObject`/`requireStringField`/`toInt`) and deduplicated every route file against it.

## 0.4.0

Reconnect/resume for dropped chat connections — the gap v0.3 flagged as unbuildable turned out to
be implementable entirely within this package, by decoupling a run's lifecycle from any single
HTTP connection:

- `POST /chat` now constructs a `RunDriver` that starts pumping `chat.stream()` the moment the
  run begins and keeps running independently of whether anyone is still listening — buffering
  every formatted SSE frame with a sequence number and broadcasting to live subscribers. The
  response carries an `x-persona-run-id` header.
- New `GET /chat/:runId/resume?since=<seq>` reattaches a subscriber to the **same** driver:
  replays buffered frames after `since`, then continues live until the run finishes.
- Lifecycle hooks (including tool-call hooks and `onThreadCreate`) moved into the driver's pump
  loop so they fire **exactly once per run** regardless of how many times a client reconnects.
- New `RunDriver` (`src/runDriver.ts`, absorbing the old `sse.ts`'s event processing),
  `runRegistry.ts` (`evictStaleRuns` — pure and directly testable), and `heartbeat.ts`
  (`withHeartbeats`, now generic over any `AsyncIterable<string>`).
- New config: `runGraceMs` (how long a finished run stays resumable, default 5 min) and
  `maxTrackedRuns` (cap on in-memory tracked runs, default 1000, evicting oldest-finished first,
  never in-flight). `Runtime.close()` stops the eviction timer (unref'd, so it never blocks
  process exit on its own).
- **Deliberate, documented tradeoff:** to support reconnect, a driver's pump now drains the
  upstream stream eagerly regardless of subscriber speed — the v0.3 guarantee of backpressure
  propagating all the way back to Persona's server no longer holds for `/chat` runs. You cannot
  have both "backpressure to the source" and "a disconnected client can come back for what it
  missed"; this runtime chose resumability.
- **Honest scope limit:** single-process/in-memory only. A `RunDriver` holds a live upstream
  connection and can't be represented in Redis or shared across runtime instances — true
  multi-instance resume needs a message-broker architecture this package doesn't provide.
- Fixed a real bug found while building this: `withHeartbeats` never called `.return()` on its
  underlying iterator when torn down early, which would have silently leaked RunDriver
  subscriptions on every disconnect.

## 0.3.0

SSE heartbeats, backpressure verification, and an honest reconnect-gap writeup:

- **Heartbeats:** `POST /chat` now sends an SSE comment-line heartbeat (`: heartbeat\n\n`)
  during any gap between real AG-UI events (e.g. a long-running tool call with no token output),
  so proxies/load balancers with an idle-connection timeout don't kill the stream. Comment lines
  are invisible to any `data:`-only SSE parser (including the SDK's own), so the AG-UI event
  sequence a consumer sees never changes. Configurable via `heartbeatIntervalMs` (default
  `15000`), implemented as a `Promise.race` between the pending upstream `next()` and a timer —
  re-racing the *same* pending call on a heartbeat rather than ever issuing an extra pull.
- **Backpressure:** verified to already work correctly via the pull-based generator chain —
  nothing to build. Added `test/backpressure.test.ts` proving `chatEventsToSseBody` never calls
  the upstream generator's `next()` ahead of what the consumer has drained.
- **Reconnect/resume:** documented as not implemented at this layer (later built in 0.4.0).

## 0.2.0

Files, memory, MCP OAuth routes, and the remaining lifecycle hooks — closing every gap v0.1
flagged as "not yet implemented":

- **Files:** `GET`/`POST /files`, `GET`/`DELETE /files/:id` — upload proxies to
  `client.files.upload()`; download streams the raw `Response` through as a new
  `RuntimeBinaryResponse` kind (the buffered/stream union couldn't represent bytes before this).
- **Memory:** `GET /memory`, `GET`/`PUT`/`DELETE /memory/file`.
- **MCP OAuth:** five routes wrapping `McpOAuthResource` — authorize-URL/status/disconnect. The
  SDK has no callback handler at all (Persona's own backend receives the OAuth provider's
  redirect directly), so the runtime only needs the authorize-URL/status/disconnect surface.
- **All 8 lifecycle hooks now wired:** `beforeToolCall`/`afterToolCall` fire by intercepting
  `TOOL_CALL_START`/`TOOL_CALL_RESULT` events already flowing through the chat SSE relay
  (correlating `toolCallId` → tool name across the two); `onFileUpload`/`onMemoryWrite` fire
  after their respective routes succeed; `onThreadCreate` fires on explicit `POST /threads`
  *and* when a `POST /chat` run's `RUN_STARTED` event reports a `threadId` that wasn't supplied
  on the way in (Persona created one implicitly for that turn).
- `RuntimeRequest` gains an optional `file` field (adapter-parsed, kept separate from the JSON
  `body`) so multipart upload doesn't overload the JSON-body contract. The Node bridge in
  `examples/` parses multipart via native `Request`/`FormData` (undici) — no new dependency.

## 0.1.0

Wave 1 foundation package — the framework-agnostic runtime engine every adapter package
(`@personaai/express`, `@personaai/nextjs`, ...) is meant to wrap:

- **Chat streaming:** `POST /chat` relays `client.chat.stream()` as SSE, byte-for-byte matching
  the SDK's own inbound frame format.
- **Threads CRUD** (`GET`/`POST /threads`, `GET`/`PATCH`/`DELETE /threads/:id`) and read-only
  **Agent listing** (`GET /agents`).
- **Health/capability probe:** `GET /health` → `{status, version, capabilities}` via
  `client.whoami()`.
- **Lifecycle hooks:** `beforeRun`/`afterRun`/`onError` wired around the chat route. The
  remaining five hooks (tool-call/file/thread/memory) were declared in the public types for
  forward compatibility and documented as not-yet-invoked.
- **The user resolver contract:** `resolveUser` is the single point of contact between the
  host's auth world and the runtime's — every route except `/health` requires a resolved user.
- A tested Node `http` bridge at `examples/node-handler.ts` for running the runtime end to end
  until a real framework adapter ships — deliberately not exported as `@personaai/node`.
