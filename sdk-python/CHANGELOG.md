# Changelog

All notable changes to `persona-agent-sdk` (`personaai`) are documented here, starting from this
file's introduction — versions before 0.2.0 aren't backfilled.

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
