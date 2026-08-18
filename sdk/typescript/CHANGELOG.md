# Changelog

All notable changes to `@personaai/sdk` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

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
