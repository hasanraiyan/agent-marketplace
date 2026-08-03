# Changelog

All notable changes to `@personaai/sdk` are documented here, starting from this file's
introduction — versions before 0.2.0 aren't backfilled.

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
