# Changelog

All notable changes to `persona-agent-sdk` (`personaai`) are documented here, starting from this
file's introduction — versions before 0.2.0 aren't backfilled.

## 0.3.0

Added the three Developer Platform surfaces the Node SDK already had, with full sync/async pairs
(`persona.*` / `await persona.*`):

- **`memory`** — `persona.memory.list()`, `get_file(path, *, scope=None, agent_id=None)`,
  `write_file(path, content, *, scope=None, agent_id=None)`, `delete_file(path, *, scope=None,
  agent_id=None)`. A subject's memory files (the same `/memories/user/`/`/memories/agent/`
  filesystem an Agent's own `write_file`/`read_file` tool calls see). Requires `external_user_id`.
- **`stores`** — `persona.stores.create/list/get/update/delete` plus `list_files(store_id)`,
  `get_file(store_id, path)`, `write_file(store_id, path, content)`, `delete_file(store_id, path)`.
  Named, scoped mount points assignable to Agents (`Agent.storeMounts`). Config CRUD works with a
  bare Project credential; file CRUD needs `external_user_id` only when the Store's `scope` is
  `externalUser`.
- **`architect`** — `persona.architect.stream(messages, *, resume=None)` /
  `send_message(messages, *, resume=None)`. A conversational co-pilot that creates/edits Agents
  via tool calls; no `agent_id`/`thread_id` (it's always the one dedicated Architect). Works with
  or without `external_user_id` (Project-owned vs. per-user Agents).

New exported types: `MemoryFile`, `MemoryAgentGroup`, `MemoryListResult`, `MemoryFileScopeParams`,
`GetMemoryFileParams`, `WriteMemoryFileInput`, `DeleteMemoryFileParams`, `Store`, `StoreScope`,
`StoreAccessMode`, `CreateStoreInput`, `UpdateStoreInput`, `DiscoverStoresParams`, `StoreFile`,
`GetStoreFileParams`, `DeleteStoreFileParams`, `WriteStoreFileInput`, plus `Stores`/`AsyncStores`,
`Memory`/`AsyncMemory`, `ArchitectClient`/`AsyncArchitectClient`.

## 0.2.3

Docs-only release — every resource method and TypedDict now has full docstrings (`Args`,
`Returns`, defaults, `Example` where useful), so your editor's hover/autocomplete shows what to
pass without needing to check the guide. No behavior or API surface changes.

## 0.2.2

Added a new top-level `audit_logs` resource — `persona.audit_logs.list(params=None)` — read-only,
control-plane only (mirrors `providers`). Covers Project-lifecycle events only (credential
minted/revoked, membership changes, suspend/restore), not resource CRUD.

## 0.2.1

Added an optional `idempotency_key` keyword argument to every resource's `create()` (and
`files.upload()`), sent as the `Idempotency-Key` request header. A safe retry with the same key
(e.g. after a network timeout) replays the original response instead of creating a duplicate
resource. Purely additive — omitting the argument is unchanged from every prior version.

## 0.2.0

**Breaking:** `list()`/`discover()` on `agents`, `skills`, `knowledge`, `mcps`, `threads`, and
`files` now return a pagination envelope — `PaginatedResult[T]`, i.e. `{"items": list[T],
"pagination": {"total", "page", "limit", "pages"}}` — instead of a bare list. Update any code
indexing the result directly as a list (e.g. `skills = persona.skills.list()` →
`skills = persona.skills.list()["items"]`). `providers.list()` is unaffected — it stays a bare
list, since Providers have no discovery concept.

Also added in this release:

- `bulk_delete(ids)` on all 7 resources — best-effort batch delete, `{"deleted", "failed"}`.
- `get_usage(id)` on Providers/Skills/MCP/Knowledge — check what's referencing a resource before
  deleting it.
