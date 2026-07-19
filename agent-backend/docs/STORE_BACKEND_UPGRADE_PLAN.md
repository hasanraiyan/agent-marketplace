# Upgrade Plan: DB-Backed Agent Filesystem (StoreBackend) for Skills & Memories

Goal: stop seeding skills into ephemeral graph state on every invoke. Give each deep
agent a persistent virtual filesystem where `/skills/` is served **live from MongoDB**
and `/memories/` persists per user+agent — modeled on the working implementation in
`D:/projects/dostify/backend` (studied 2026-07-19).

---

## 1. Where we are today

| Piece | File | Behavior |
|---|---|---|
| Backend | `src/factories/agentFactory.js:361` | `backend: new VersionedStateBackend()` (extends `StateBackend`) — all files thread-scoped, lost across threads |
| Skills | `agentFactory.js:225-258` | DB skills rendered to `/skills/<dir>/SKILL.md` strings (`skillFiles`) |
| Seeding | `src/routes/agui.routes.js:168-173` | `skillFiles` injected into invoke input `files` map on **every request** |
| Store | `src/utils/mongoStore.js` | Generic `MongoDBStore extends BaseStore` (`agent_memories` collection), passed as `store:`, used only by memory tools |
| Skill model | Mongo `Skill` | `name`, `description`, `instructions` — single blob, no multi-file support |
| deepagents | `package.json` | **1.9.0** |

Problems: skill copies bloat every thread's checkpoints; agent writes never survive a
thread; `skillFiles` plumbing couples factory → route → invoke input.

---

## 2. Research: how dostify does it (deepagents 1.10.5)

Dostify's `backend/src/skills/` + `agent.service.ts` implement the full pattern. Key
findings, with the parts worth copying:

### 2.1 The big idea: a `BaseStore` *facade* over the skills collection — no sync job

`SkillsStore extends BaseStore` (`dostify/backend/src/skills/skills-store.ts`) does
**not** mirror skill files into a separate store collection. It implements
`batch()` (get/put/search/listNamespaces) by reading/writing the `Skill` Mongo
documents directly. Files live as a nested array on the skill doc:

```ts
// Skill schema (dostify): ownerId, scope, name, description, isEnabled,
// status(draft|valid|invalid), source, fileCount, hasScripts, validationErrors,
// files: [{ path, content, mimeType, createdAt, updatedAt }],       // drafts
// enabledFiles: [{ ... }]                                           // live copy
```

- Store key `/<skill-name>/<relative-path>` maps to `{ name: skillName }` doc +
  nested file entry. `search(namespacePrefix)` fans out all nested files as items.
- **DB is the single source of truth.** Agent reads are always live; skill CRUD in
  the UI is instantly visible to the agent. No backfill, no sync hooks, no drift.
- Writes through the store re-run validation and update metadata
  (`updateMetadataFromFiles`: parses SKILL.md frontmatter, sets status/fileCount).
- Path safety: `normalizeKey` rejects `..`, `~`, null bytes, backslashes.

### 2.2 Multi-file skills work out of the box

Skill = folder; `SKILL.md` required; `references/`, `scripts/`, `assets/` optional.
deepagents' skills middleware only scans `<dir>/SKILL.md` for frontmatter
(progressive disclosure); other files are just readable via `read_file`/`glob`/`grep`.
Dostify enforces the Agent Skills spec limits (name ≤64 lowercase-hyphen chars,
description ≤1024, SKILL.md ≤ ~500 lines, paths one level deep) in a
`SkillValidator` with unit tests.

### 2.3 Draft vs enabled: two file arrays, agent sees only `enabled`

The store namespace is `[userId, 'enabled' | 'drafts']`. The agent's route uses
`enabledUserNamespace(userId)` → `[userId, 'enabled']`, so **draft/disabled skills
are invisible to the agent** without any filtering logic in the middleware.
Enabling a skill = copying `files` → `enabledFiles`.

### 2.4 Runtime wiring (`agent.service.ts:426-503`)

```ts
backend: new CompositeBackend(new VersionedStateBackend(), {
  '/memories/': new StoreBackend({
    store: memoryService.store,
    namespace: (rt) => [rt.config?.configurable?.userId ?? 'anonymous'],
  }),
  '/skills/system/': readonlyBackend(new FilesystemBackend({
    rootDir: path.resolve(cwd, 'system-skills'), virtualMode: true })),
  '/skills/user/': new StoreBackend({
    store: skillsService.store,
    namespace: (rt) => enabledUserNamespace(rt.config?.configurable?.userId),
  }),
}),
skills: ['/skills/system/', '/skills/user/'],
memory: ['/memories/index.md'],
```

Two things to note:
- **`namespace` is a function of the runtime** (`rt.config.configurable.userId`) —
  one shared agent instance serves all users with per-user isolation resolved at
  call time. Requires deepagents ≥ 1.10 (our 1.9.0 types only allow `string[]`).
- **`readonlyBackend()` is a plain object wrapper**, not a subclass: delegates
  `ls/read/readRaw/grep/glob/downloadFiles`, and returns
  `{ error: '...read-only.', path, filesUpdate: null }` from `write`,
  `{ ...same, occurrences: 0 }` from `edit`, and per-file
  `{ path, error: 'permission_denied' }` from `uploadFiles`. Copy these shapes.

### 2.5 Explicit invocation

`$skill-name <text>` in a user message is rewritten server-side to
`"Use the skill at /skills/user/<name>/SKILL.md for the following request: …"` —
no new tool needed, the file tools + skills middleware handle the rest.

### 2.6 System skills

Shipped in a repo folder (`system-skills/skill-creator/SKILL.md`), served read-only
via `FilesystemBackend({ virtualMode: true })`. Read-only wrapper makes host-disk
serving safe even multi-tenant.

### 2.7 Memory system: files, not key-value pairs

Dostify's memory (`backend/src/memory/`) is the same facade pattern applied to
memories — **no KV tools at all**:

- `memory_files` collection, **one doc per virtual file**:
  `{ namespace: [userId], key: '/preferences.md', content, mimeType }` with a
  unique `{namespace, key}` index (`schemas/memory-file.schema.ts`).
- `MemoriesStore extends BaseStore` over it; `MemoryService` wraps it with
  file CRUD (`listFiles/readFile/writeFile/deleteFile`) for the REST API/UI,
  and `ensureDefaultFile(userId)` seeds `/memories/index.md` before runs.
- Runtime: `/memories/` route → user-scoped `StoreBackend`, **plus**
  `memory: ['/memories/index.md']` on `createDeepAgent` — deepagents auto-loads
  that file into the system prompt every run (AGENTS.md-style), so the index is
  always in context without a tool call.
- The agent manages memory with the ordinary `write_file`/`edit_file` tools,
  steered by system-prompt rules (`agent.service.ts:329-352`):
  - `index.md` is auto-loaded; every other `/memories/*.md` must be `read_file`d
    when relevant (progressive disclosure, same as skills).
  - Index stays an index — one-line summaries pointing at topic files:
    `/memories/preferences.md`, `/memories/people.md`, `/memories/facts.md`,
    `/memories/projects.md`; split a topic out once it grows past 2-3 bullets.
  - Never store secrets in memory.
- The AG-UI state snapshot deliberately excludes `/memories/` and `/skills/`
  from the user-visible VFS (`agent.service.ts:2254`); memory has its own UI via
  the memory controller.

---

## 3. Target architecture for agent-marketplace

Differences from dostify: our skills are **agent-level marketplace entities**
(shared by all users of an agent, edited via Architect/`manage_skill` + UI), not
user-owned. So `/skills/` must be read-only in chat, and the namespace is keyed by
`agentId`, not `userId`.

```
CompositeBackend
├── default            → VersionedStateBackend                 (ephemeral scratch, unchanged)
├── "/skills/system/"  → readonly(FilesystemBackend)           repo folder system-skills/ (Architect skill lives here)
├── "/skills/"         → readonly(StoreBackend over AgentSkillsStore)
│                          namespace: (rt) => ['agents', rt.config.configurable.agentId, 'enabled']
├── "/memories/user/"  → StoreBackend over MemoryFilesStore      (cross-agent, per user)
│                          namespace: (rt) => ['users', userId]
└── "/memories/agent/" → StoreBackend over MemoryFilesStore      (per user + agent)
                           namespace: (rt) => ['users', userId, 'agents', agentId]
```

Plus `memory: ['/memories/user/index.md', '/memories/agent/index.md']` on
`createDeepAgent` so both indexes are auto-loaded into the system prompt each run.

- **`AgentSkillsStore extends BaseStore`** — dostify-style facade over our existing
  `Skill` collection: resolves `agentId` → agent's attached skills → serves
  `/<slug>/SKILL.md` (+ future extra files). **Deletes the whole sync-service idea**
  from the previous version of this plan — no mirror, no backfill, no drift.
- `/skills/` read-only in chat (wrapper): agent writes get a clean error; skill
  editing stays on the existing `manage_skill` tool path (HITL-gated) and the UI.
- `/memories/` reuses the existing `MongoDBStore` (`agent_memories`), agent-writable,
  isolated per user+agent.
- `userId`/`agentId` must be passed in `configurable` at invoke time
  (`agui.routes.js`) — check what's already there; `thread_id` is.

---

## 4. Phases

### Phase 0 — Prerequisites

1. **Upgrade `deepagents` 1.9.0 → ^1.10.x** (dostify runs 1.10.5). Needed for
   `namespace: (rt) => string[]` functions and `store:` in `StoreBackendOptions`.
   Re-run the existing test suite; check changelog for `createDeepAgent` breaking
   changes (dostify also uses `registerHarnessProfile` — not needed here).
2. Pass `agentId` + `userId` through `configurable` in `agui.routes.js` invoke
   config (verify current shape first).

### Phase 1 — `AgentSkillsStore` facade + read-only wrapper

1. `src/utils/agentSkillsStore.js`: `BaseStore` subclass implementing `batch()`
   ops against `agentRepository`/`skillRepository`:
   - namespace `['agents', <agentId>, 'enabled']`
   - `search`: load agent, populate skills, emit one item per skill file with
     value `{ content, mimeType, created_at, modified_at }` (reuse the existing
     slugify + JSON-frontmatter renderer extracted from `agentFactory.js:237-257`
     into `src/utils/skillMarkdown.js`)
   - `get`: single-file lookup
   - `put`: **reject** (read-only store; belt-and-braces under the wrapper)
   - Copy dostify's `normalizeKey` path validation.
   - Architect's hardcoded skill moves to `system-skills/agent-architecture/SKILL.md`
     served by the FilesystemBackend route (dostify pattern) — deletes the
     special-case seeding.
2. `src/utils/readonlyBackend.js`: copy dostify's wrapper verbatim (object
   delegating reads, erroring writes with the exact result shapes in §2.4).

### Phase 2 — Wire CompositeBackend in `agentFactory.js`

- Replace `backend:` with the CompositeBackend from §3; keep
  `store: getGlobalStore()` for memory tools.
- `skills: ['/skills/system/', '/skills/']` unconditionally (empty dirs are fine).
- Add a `/memories/` note to the system prompt block.
- Delete `skillFiles` construction + return plumbing; delete `files: skillFiles`
  injection in `agui.routes.js`. Old threads' checkpointed `/skills/` state gets
  shadowed by the route — no cleanup needed.
- Cache note: with runtime-resolved namespaces the compiled instance no longer
  depends on userId for backend reasons (per-user MCP + Architect still do).

### Phase 3 — Multi-file skills (schema)

- Add `files: [{ path, content, mimeType, createdAt, updatedAt }]` to the Skill
  model (path validated with `normalizeKey`; `SKILL.md` stays generated from
  `instructions` for back-compat, or migrate `instructions` into `files`).
- `AgentSkillsStore.search` emits these alongside SKILL.md.
- Port dostify's `SkillValidator` rules (+ its spec tests) — worth copying nearly
  verbatim: frontmatter parse, name/folder match, size caps, path traversal.
- UI/API: attach reference files when authoring a skill (later).

### Phase 4 — Memory system: KV → file-based (all memory types)

Current state to replace:
- **User memory**: `user.profile.{summary, preferences: Map}` on the User doc;
  injected into the prompt at build time (`agentFactory.js:324-351`); managed by
  `save_user_preference`/`get_user_preferences` tools + `memoryCollector.service.js`
  background extraction.
- **Agent memory**: `save_agent_memory`/`get_agent_memories` KV pairs in
  `agent_memories`, namespace `[agentId]` — note this is **agent-global**: user A's
  chats write memories user B's runs can read. The migration fixes this by scoping
  agent memories per user+agent.
- UI: `memory.service.js`/`memory.controller.js`/`memory.routes.js` aggregate
  profile + KV docs for display.

Steps (dostify §2.7 as the template):

1. **`MemoryFilesStore`** — new collection `memory_files`, one doc per file
   `{ namespace: [String], key, content, mimeType, timestamps }`, unique
   `{namespace, key}` index; `BaseStore` facade copied from dostify's
   `MemoriesStore` (it's small), plus dostify's `normalizeKey` path validation.
   Keep the existing `MongoDBStore`/`agent_memories` untouched during migration.
2. **Wire routes** `/memories/user/` and `/memories/agent/` (§3) +
   `memory: [.../index.md]` auto-load; `ensureDefaultFile` for both namespaces
   before runs (seed `index.md` skeleton).
3. **Replace the prompt block**: swap `AUTOMATIC PERSISTENT MEMORY RULES` and the
   `USER PROFILE & PREFERENCES` injection for dostify-style memory rules
   (index + topic files: `preferences.md`, `facts.md`, `projects.md`,
   agent-side `learnings.md`; auto-loaded index vs read-on-demand topic files;
   no secrets). The build-time profile injection becomes unnecessary — the
   auto-loaded `/memories/user/index.md` replaces it.
4. **Retire the 4 KV tools** (`memory.tools.js`) — the agent uses
   `write_file`/`edit_file` on `/memories/` instead. Keep the tools for one
   release as deprecated aliases that write to the new files if we want a soft
   landing, then delete.
5. **Migration script** `scripts/migrate-memories-to-files.js`:
   - `user.profile.summary` + `preferences` Map → `/memories/user/index.md`
     (summary) + `/memories/user/preferences.md` (one bullet per KV pair),
     namespace `['users', userId]`.
   - `agent_memories` docs (namespace `[agentId]`) → `/memories/agent/learnings.md`
     under `['users', <agent ownerId>, 'agents', agentId]` — assigned to the
     agent's owner since KV agent memories had no user attribution.
   - Idempotent; leaves source data in place (read-path switches over).
6. **Rewrite memory UI backend** (`memory.service.js`, controller, routes) to
   file CRUD over `MemoryFilesStore` (list/read/write/delete per namespace),
   mirroring dostify's `MemoryService`+controller shape.
7. **`memoryCollector.service.js`**: update the background extractor to append
   to `/memories/user/*.md` files instead of `user.profile` — or retire it, since
   the in-chat memory rules now cover proactive saving.
8. Hide `/memories/` (and `/skills/`) from the AG-UI files snapshot if not
   already (dostify does this deliberately; check `aguiTranslator.js`).

### Phase 5 — Polish (optional)

- Explicit `$skill-name` invocation rewrite in the message pipeline (dostify §2.5).
- Draft/enabled skill states (dostify §2.3) if the marketplace grows skill
  drafts — namespace `['agents', agentId, 'enabled'|'drafts']` slot is already
  reserved by the design.
- TTL/cleanup job for `/memories/` growth; memory usage analytics.

---

## 5. Testing (adapt dostify's checklist)

- `AgentSkillsStore` unit tests through `StoreBackend.ls/read/glob/grep`
  (mongodb-memory-server).
- Create skill via API → **new thread, no seeding** → skills middleware lists it;
  `read_file /skills/<slug>/SKILL.md` returns it; supporting file readable.
- Agent `write_file /skills/...` → read-only error (both routes).
- `/memories/agent/x.md` written in thread 1 readable in thread 2 (same
  user+agent); invisible to a different user on the same agent.
- `/memories/user/preferences.md` visible from a *different* agent, same user.
- `memory:` auto-load: index content appears in the run's system prompt without a
  `read_file` call; agent updates a topic file and the index via `edit_file`.
- Migration script: profile KV + `agent_memories` KV land in the right files
  and namespaces; script is idempotent on re-run.
- deepagents upgrade regression: existing chat/tool/interrupt flows.
- Checkpoint size shrinks for skill-heavy agents.

## 6. Risks

| Risk | Mitigation |
|---|---|
| deepagents 1.9 → 1.10 breaking changes | Phase 0 isolated PR; full regression before backend wiring |
| `configurable.agentId` missing on some invoke path (resume, subagent) | Facade returns empty results + logs; read-only so no corruption possible |
| Facade `search` loads all skill files per `ls` | Skills are small; populate() is one indexed query; measure |
| Per-run Mongo reads on skill discovery | Same as dostify in production; acceptable |
| `/.versions/` doesn't cover store routes | Fine: `/skills/` read-only; `/memories/` low-risk |
| KV→file migration loses structure (Map keys → markdown bullets) | Acceptable — files are the new source of truth; keep source data until verified |
| Old agent-global `agent_memories` reattributed to owner only | Document it; other users' runs simply start fresh memory files |
| `memory:` auto-load grows prompt if index bloats | Prompt rules keep index an index; cap index file size in memory UI validation |

**PR order**: Phase 0 → Phase 1+2 (the payoff: seeding deleted) → Phase 3 →
Phase 4 (memory migration, its own PR + migration script) → Phase 5.
