# Pending Tasks

## ~Flutter app (`persona/`): migrate memory feature to the file-based memory API~

**Status:** ✅ Complete (2026-07-19).

All four Flutter memory files updated to match the new file-based API (see
`agent-backend/docs/STORE_BACKEND_UPGRADE_PLAN.md`):

| File | Change |
|---|---|
| `memory_model.dart` | Replaced KV models (`MemoryProfileModel`, `AgentMemoryEntryModel`) with file-based models (`MemoryFileModel`, `AgentMemoryGroupModel`, `AllMemoryDataModel`) |
| `memory_remote_datasource.dart` | Updated endpoints: `GET /memory` → file-based response; `PUT /memory/file` for writes; `DELETE /memory/file` for deletes |
| `memory_provider.dart` | File-based CRUD with optimistic updates for user files + agent file groups |
| `memory_screen.dart` | Full UI rewrite: user files section, agent file groups, create form (scope/agent/path/content), inline edit/delete, search filtering, overview stats, clear-all dialog |

`flutter analyze` passes clean. Matches web reference `frontend/src/app/dashboard/connectors/memory/page.jsx`.
