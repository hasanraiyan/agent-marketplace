# Changelog

All notable changes to `@personaai/sdk` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

## 0.7.5

- **New: `Agent.sandboxEnabled` / `CreateAgentInput.sandboxEnabled` / `UpdateAgentInput.sandboxEnabled`.**
  When `true`, the Agent gets real shell execution in an isolated CodeSandbox VM instead of the
  default virtual (MongoDB-backed) workspace filesystem. Requires a `CSB_API_KEY` Project Secret to
  exist first — there is no `secrets` SDK resource yet, so create one via the platform UI or
  `POST /api/v1/developer/secrets` directly. Setting it to `true` without that secret present is
  rejected with a 400. `@default false`. Requires `agent-backend`'s matching support (shipped
  alongside this release).

## 0.7.4

- **New: `chat.stream()`/`chat.sendMessage()` accept `context: Record<string, unknown>`.** Distinct
  from `contextOverride` (a string appended to the system prompt): `context` is **never shown to
  the model in any form** — it only ever feeds an RCP tool's resolver (see your Project's RCP
  Sources `paramContextMap` configuration), read live at the moment that tool is actually called. A
  mapped param is permanently absent from the model's tool schema, not conditionally so. Must be a
  flat object of string/number/boolean values only (no nesting), capped at 2000 bytes serialized —
  a violation is rejected with a 400, not truncated or coerced. Resent on every turn you want it to
  apply to; it is never remembered from an earlier `chat.stream()` call. Requires `agent-backend`'s
  matching support (shipped alongside this release).

## 0.7.3

- **New: `voice.createSession(agentId, { context })`.** Same field/cap/contract as `chat.stream()`'s
  `context` — never shown to the model, only ever read live by an RCP tool's resolver. This is the
  **at-connect seed only**: unlike text chat (fresh `context` on every message), a voice call is
  one continuous session, so refreshing it mid-call means sending `{ type: 'voice.context', context
  }` over the already-open WebSocket yourself (this SDK never touches that socket). Requires
  `agent-backend`'s matching voice session + `VoiceSession` support (shipped alongside this
  release).

## 0.7.2

- **New: `voice.createSession(agentId, { contextOverride })`.** Same field/cap/contract as
  `chat.stream()`'s `contextOverride` — appended to the Agent's system instruction for that call.
  Unlike text chat, this is a **one-time append at connect**, not re-applied per turn: Gemini
  Live's system instruction is fixed for the whole call, so changing it mid-call requires ending
  the session and starting a new one. Sent as a JSON body field (`agentId`/`threadId` stay headers,
  unchanged) — requires `agent-backend`'s matching voice session support (shipped alongside this
  release).

## 0.7.1

- **`defineRestTool`'s `auth: { type: 'bearerSecret' }` no longer requires `secretRef`.** Omit it
  and the tool falls back, at call time, to whichever secret is configured on the REST Tool Source
  itself — the common case ("this whole source's tools share one key") now needs zero Secret ids
  anywhere in your code. Pass an explicit `secretRef` only when one specific tool needs a
  *different* secret from the rest of the source. Requires `agent-backend`'s matching REST Tool
  Source fallback (shipped alongside this release) — a tool built with an older `@personaai/sdk`
  that hand-set a fake/placeholder `secretRef` will still fail until that field is removed, since
  the fallback only triggers when `secretRef` is genuinely absent, not merely invalid.

## 0.7.0

- **New: `client.restTools`** (`RestToolsResource`) — plain CRUD over
  `/api/v1/developer/rest-tools` (`create`/`list`/`get`/`update`/`delete`/`getUsage`/
  `bulkDelete`/`test`), mirroring `McpsResource`'s shape.
- **New: `defineRestTool()`**, at a separate `@personaai/sdk/rest-tools` entry point so `zod`
  stays an **optional peer dependency** (`^3.23.0 || ^4.0.0`) — the package root never pulls it
  in. Builds a `CreateRestToolInput`-shaped REST tool definition from a zod `args` schema instead
  of hand-writing `paramDescriptors`, with typed `t.arg(name)`/`t.externalUserId` template
  helpers so a definition never needs a hand-typed `"{{token}}"` string — `t.arg()` throws
  immediately for a name not declared in `args`. Meant to be handed to
  `@personaai/runtime`'s new `restToolsManifest` option (`createRuntime({ restToolsManifest:
  { tools: [...] } })`) so a REST Tool Source registered in the Persona dashboard can discover
  it live — see the README's "Defining REST tools in code" section.

## 0.6.0

- **New: `client.voice.createSession(agentId)`** (`VoiceResource`, `VoiceSessionTicket`,
  `VoiceSessionInfo`). Mints a single-use ticket for the voice WebSocket gateway (real-time audio,
  powered by Gemini Live) — `POST /api/v1/developer/voice/sessions`, requires `externalUserId`
  (same as `chat`/`threads`, since voice always runs as a Subject). This SDK never opens the
  WebSocket or touches audio itself: call this from your own server, then hand the returned
  `wsUrl` (ticket already embedded) to your own frontend, which opens `new WebSocket(wsUrl)`
  directly — your Project credential never reaches a browser.

## 0.5.0

- **New: `threads.reset(threadId)`.** Clears a Thread's conversation content in place — message
  history, workspace files/todos, and subagent traces — while keeping the Thread itself (same
  `_id`/`threadId`/title). Use this instead of `delete()` + `create()` when a caller wants a fresh
  conversation without losing the Thread's identity, since a new Thread from `create()` gets a new
  `_id` and breaks anything still holding onto the old one. Long-term agent memory is untouched.
  `POST /api/v1/developer/threads/{id}/reset`, returns the reset `Thread`.

## 0.4.5

- Refactor logger to `@personaai/logger@^0.1.0` — `src/logger.ts` now re-exports the shared isomorphic leaf (`createLogger`, `createNoopLogger`, `setLogLevel`/`getLogLevel`, `LogLevel`, `Logger`, `LogTransport`, `CreateLoggerOptions`) so browser clients (`@personaai/react`, `@personaai/nextjs`) can import from `@personaai/logger` directly without pulling the server bundle. `import { createLogger } from '@personaai/sdk'` keeps working via re-export. No behavior change from 0.4.4; still OFF by default.

## 0.4.4

- **Built-in logging — off by default, selectable per instance or globally, every level.** New `src/logger.ts` (`createLogger`, `createNoopLogger`, `setLogLevel`/`getLogLevel`, `LogLevel`, `Logger`, `LogTransport`, `CreateLoggerOptions`) — zero dependencies, Node + browser safe, shared as the foundational logger for the ecosystem (see `LOGGING_PLAN.md`). `HttpClientOptions`/`PersonaClientOptions` now accept `logLevel` (`'off'|'error'|'warn'|'info'|'debug'|'trace'`, default `'off'`) and `logger` (custom transport, redacts `Authorization: Bearer <keyId>:***` and secret-bearing body keys). `PersonaClient` fans out to `sdk:http`/`sdk:chat`/`sdk:architect` child loggers; `ChatClient`/`ArchitectClient` and `parseAguiEventStream` emit `debug`/`trace` for stream lifecycle and `info`/`warn` for interrupts and `RUN_ERROR`. Nothing logs unless the caller explicitly enables it.

## 0.4.3

- **New: `agents.getMcpConnections(agentId, returnTo?)`.** Until now there was no way for an
  external caller to find out whether the calling user has connected an `authType: 'oauth',
  authMode: 'user'` MCP an Agent has attached — a tool call against an unconnected one is
  silently dropped from the Agent's toolset with no signal anywhere. Returns
  `{ mcpId, name, description, connected, authorizeUrl }[]` for every user-mode MCP the Agent
  has, so a consumer can show a real "Connect" affordance up front instead of a capability just
  quietly not being there. Requires the client to assert an external user
  (`ProjectRuntimeContext`).

## 0.4.2

- Fixed `ThreadMessages`'s field name: 0.4.1 added it as `interrupt`, but the actual wire field
  `checkpointService.getMessages()` returns is `pendingInterrupt` — the type never matched
  reality, so no correctly-typed consumer could have been reading it. Renamed to
  `pendingInterrupt` to match. Type-only change; no runtime behavior differs.

## 0.4.1

Patch release — ships two fixes merged after the 0.4.0 npm release, plus a packaging cleanup:

- `ThreadMessages` gained an optional `interrupt` field — `getMessages()` now surfaces a pending
  HITL/clarification interrupt, so reloading a paused Thread can re-show its approval/
  clarification card without waiting for the next live `chat.stream()` call (raw checkpoint
  state alone can't detect a paused interrupt). Same shape as `ChatResult.interrupt`.
- Fixed `providers.list()`'s JSDoc: it previously claimed the same result whether or not the
  client asserts an external user, but the backend short-circuits a runtime-plane client
  (`externalUserId` set) to a silent empty array before ever querying — the doc now says so.
- Removed an accidental `@personaai/sdk` self-dependency from `package.json` (copy-paste bleed
  from the runtime package's manifest). No behavior change.

## 0.4.0

- **New `architect` client** — `client.architect.stream()` / `.sendMessage()` against the new
  `/api/v1/developer/architect/agui` endpoint. A conversational co-pilot that creates/edits Agents
  via tool calls on your behalf, reachable with just your Project's machine credential — no Clerk
  session required. Ownership follows the same dual-mode convention every other Developer Platform
  resource already uses: omit `externalUserId` on the client and the Architect builds Agents owned
  by your whole Project; set it and the Architect builds Agents owned by that one external user
  instead. Unlike `chat`, there's no `agentId` to pass (it's always this one dedicated Architect)
  and no thread selection — one implicit, per-caller-scoped conversation.

## 0.3.1

- `Agent`/`CreateAgentInput`/`UpdateAgentInput` gained `interruptOn` (a Developer-Platform
  consumer's `create()`/`update()` call previously had this field silently stripped by the
  request validator before it ever reached the database, even though the runtime already fully
  supported it — this closes that gap; not a new capability on the backend, just the first time
  it's actually reachable through the SDK).

## 0.3.0

New resources and chat capabilities, all additive — nothing from 0.2.x changes shape.

- **New `memory` resource** — `persona.memory.list()` / `getFile()` / `writeFile()` /
  `deleteFile()` against `/api/v1/developer/memory`, full CRUD parity with what an Agent's own
  `write_file`/`read_file` tools can already do to `/memories/user/`/`/memories/agent/`.
- **New `stores` resource** — `persona.stores.create()` / `list()` / `get()` / `update()` /
  `delete()` plus `listFiles()` / `getFile()` / `writeFile()` / `deleteFile()` against
  `/api/v1/developer/stores`. Named, scoped mount points (`scope: 'domain' | 'externalUser'`,
  `accessMode: 'readonly' | 'readwrite'`) you assign to Agents via the new `storeMounts` field on
  `agents.create()`/`agents.update()` — a filesystem-backed alternative to `contextOverride` for
  larger reference material an Agent can `read_file` on demand instead of holding in the prompt.
- **New `contextOverride` on `chat.stream()`/`chat.sendMessage()`** — caller-supplied context
  appended to that turn's system prompt only; never persisted to memory, never visible to later
  turns. Capped at 4000 characters server-side (rejected with 400 above that, not truncated).
- **New `GET /api/v1/developer/agui/schema`-backed types** — `ClarificationRequestPayload`,
  `HitlRequestPayload`, `McpAppPayload`, `SubagentActivityPayload` exported from
  `sdk/src/types/aguiEvents.ts`, matching the schema document one-for-one. Every AG-UI stream
  response also now carries the active schema version on the `X-AGUI-Schema-Version` header.
- **Structured run errors** — `ChatResult.error` is now populated as a typed
  `PersonaRunErrorEvent` (`code`, `message`, `retryable`, `providerName`) when a run ends in a
  genuine failure (auth, rate limit, tool error/timeout, context length exceeded) rather than
  finishing normally or pausing on an interrupt. `code` is drawn from `RunErrorCode`.
- `Agent`/`CreateAgentInput`/`UpdateAgentInput` gained `storeMounts` (bare id strings on
  `create`/`update`/`list`, populated `Store` objects on `get()` — same convention as `skills`/
  `mcps`/`knowledgeBases`).

## 0.2.3

Docs-only release — every resource method and exported type now has full JSDoc (`@param`,
`@returns`, defaults, `@example` where useful), so your editor's hover/autocomplete shows what to
pass without needing to check the guide. No behavior or API surface changes.

## 0.2.2

Added a new top-level `auditLogs` resource — `persona.auditLogs.list(params?)` — read-only,
control-plane only (mirrors `providers`). Covers Project-lifecycle events only (credential
minted/revoked, membership changes, suspend/restore), not resource CRUD.

## 0.2.1

Added an optional trailing `idempotencyKey` argument to every resource's `create()` (and
`files.upload()`), sent as the `Idempotency-Key` request header. A safe retry with the same key
(e.g. after a network timeout) replays the original response instead of creating a duplicate
resource. Purely additive — omitting the argument is unchanged from every prior version.

## 0.2.0

**Breaking:** `list()`/`discover()` on `agents`, `skills`, `knowledge`, `mcps`, `threads`, and
`files` now return a pagination envelope — `PaginatedResult<T>`, i.e. `{ items: T[], pagination:
{ total, page, limit, pages } }` — instead of a bare array. Update any code destructuring the
result directly as an array (e.g. `const list = await persona.skills.list()` → `const { items } =
await persona.skills.list()`). `providers.list()` is unaffected — it stays a bare array, since
Providers have no discovery concept.

Also added in this release:

- `bulkDelete(ids)` on all 7 resources — best-effort batch delete, `{ deleted, failed }`.
- `getUsage(id)` on Providers/Skills/MCP/Knowledge — check what's referencing a resource before
  deleting it.
