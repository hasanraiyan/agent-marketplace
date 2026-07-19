# Pending Tasks

## Flutter app (`persona/`): migrate memory feature to the file-based memory API

**Status:** Pending — deliberately deferred (2026-07-19).
**Context:** The backend and web frontend moved from key-value memory to file-based
memory (see `agent-backend/docs/STORE_BACKEND_UPGRADE_PLAN.md`, commits `9442ac0`
and `c3cddbc` on `feat/persona-setup`). The Flutter app still targets the old KV
API, so its memory screen will break against the new backend.

### What changed on the backend

| Old (KV) | New (files) |
|---|---|
| `GET /memory` → `{ profile: { summary, preferences }, agentMemories: [{ agentId, agentName, key, value }] }` | `GET /memory` → `{ userFiles: [{ scope, path, content, mimeType, createdAt, updatedAt }], agentMemories: [{ agentId, agentName, files: [...] }] }` |
| `POST /memory` (`{ agentId, key, value }`) | `PUT /memory/file` (`{ scope: 'user'\|'agent', agentId?, path, content }`) |
| `PUT /memory/:agentId/:key` (`{ value }`) | same `PUT /memory/file` (overwrites) |
| `DELETE /memory/:agentId/:key` | `DELETE /memory/file?scope=&agentId=&path=` (path URL-encoded) |
| `DELETE /memory/all` | unchanged |
| `GET /agents/:id/memory` → KV entries | → memory files `[{ path, content, mimeType, createdAt, updatedAt }]` |
| `DELETE /agents/:id/memory/:key` | `DELETE /agents/:id/memory/:path` (URL-encoded file path) |

### Flutter files to update

- `persona/lib/features/memory/data/models/memory_model.dart` — model becomes a
  memory *file* (scope, agentId?, path, content, mimeType, timestamps).
- `persona/lib/features/memory/data/datasources/memory_remote_datasource.dart` —
  new endpoints above.
- `persona/lib/features/memory/presentation/providers/memory_provider.dart` and
  `.../pages/memory_screen.dart` — UI: user files + per-agent file groups,
  markdown content editing (multi-line), create-file form (scope/agent/path/content).
- Check `persona/lib/core/config/api_constants.dart` for memory route constants.

Reference implementation: the web version in
`frontend/src/app/dashboard/connectors/memory/page.jsx` + `frontend/src/lib/api/memory.js`.

### Also worth doing in the same pass

- Remove/replace any Flutter UI that edits `user.profile.summary/preferences` as
  "AI memory" — that KV data no longer feeds agents (the web settings page now
  just links to the memory dashboard).
