# Handoff prompt — Agents tab + Playground for the Developer Platform

Paste this whole document into a new Claude session (working directory `D:\projects\agent-marketplace`, branch `feat/ai`).

---

## Mission

Build two features inside `PLATFORM/` (the new Next.js app, platform.persona.hasanraiyan.me):

1. **Agents tab** — the create/edit pages under `/projects/[projectId]/agents/` currently 404. Build:
   - `platform/src/app/projects/[projectId]/agents/new/page.tsx`
   - `platform/src/app/projects/[projectId]/agents/[agentId]/edit/page.tsx`
   - a builder form with attach pickers for **Skills / Knowledge / MCP / REST Tools / RCP / Secrets / Stores** (the fields the backend actually stores — confirm via the backend schema, not assumptions).
2. **Playground** — wire a live agent chat page: pick an agent, chat with it, using the AG-UI streaming stack that already exists in `PLATFORM/` but is not yet wired.

Use `agent-backend/` and the legacy `FRONTEND/` code as the reference. Work in **plan mode first** and get the plan approved before writing code.

## Context you already have

- Both features are open items in `TODO.md` (section 1 = Agents, section 2 = Playground, section 3 = Knowledge).
- `PLATFORM/src/lib/api/projects.ts` already has `createProjectAgent`, `updateProjectAgent`, `deleteProjectAgent`, `bulkDeleteProjectAgents`, `createProjectAgentVoiceSession` — verify their payload shapes against the backend before using them.
- `PLATFORM/` already has an **unwired** AG-UI chat stack: `platform/src/lib/agui` (`useAguiChat`), `platform/src/components/chat/*`, `platform/src/hooks/use-voice-session.ts`.
- Backend agent CRUD lives in `agent-backend/src/modules/projects/project.controller.js` (`createAgent`/`updateAgent`) plus `agent.model.js` / `agent.validator.js`. Project resources are domain-scoped (multi-tenant); ProjectAdmin routes are Clerk-session authed.

## Research passes to run FIRST (use the Explore agent; earlier runs failed on a rate limit — re-run them)

1. **Backend Agent schema + routes** — `agent.model.js`, `agent.validator.js`, `project.controller.js` createAgent/updateAgent, `project.routes.js`. Exact fields, defaults, validation rules, and which attach references are stored (skills, knowledgeBases, mcps, tools/REST, rpc, secrets, stores) and their shapes.
2. **Legacy FRONTEND agent builder** — `frontend/src/app/developer/projects/[id]/agents/` (create/edit pages + attach pickers). If those pages are incomplete, fall back to the Studio agent builder. Note exactly which fields + pickers the old UI posts.
3. **Playground reference vs Platform's existing stack** — how `frontend/src/app/developer/projects/[id]/agents/[agentId]/test/page.jsx` (the working test page) drives a chat with AG-UI, and how it compares to `platform/src/lib/agui`, `platform/src/components/chat/*`, `platform/src/hooks/use-voice-session.ts`. Identify what is missing to get a working chat in PLATFORM.

## Reference conventions (Platform)

- Form pages follow the **MCP edit page** style: `platform/src/app/projects/[projectId]/mcps/[mcpId]/edit/page.tsx` — Breadcrumb, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, `Field`/`FieldLabel`/`FieldDescription`/`FieldError`, `Input`/`Textarea`/`Select`/`Checkbox`/`Alert`, inline `FieldError` for form errors.
- `platform/src/app/projects/[projectId]/knowledge/new/page.tsx` is a good model for a "new resource" page with a provider picker + skeleton loading.
- After mutations, invalidate caches with `deleteCachedByPrefix(cacheKey.resource(projectId, "..."))`.

## Verification

- `tsc --noEmit` and `pnpm exec eslint` clean inside `PLATFORM/`.
- Dev-server smoke test: create an agent, edit it, and (for Playground) send at least one message.
- Git: work off `feat/ai`; create a new branch before editing; commit and push when the user is happy.

## Also pending — do not forget these

- `agent-backend/src/modules/knowledge/knowledge.service.js` has **3 uncommitted fixes**:
  1. `_getQdrantClient()` resets the memoized promise on rejection (`this._qdrantClientPromise.catch(() => { this._qdrantClientPromise = null; })`).
  2. `_createQdrantCollection()` wraps `client.getCollections()` in try/catch with a clear diagnostic (mentions `QDRANT_URL`/`QDRANT_API_KEY`).
  3. `createKnowledgeBase()` deletes the placeholder KB row if Qdrant collection creation fails.
  Boot-verify the backend and commit these.
- **Knowledge upload still fails** with an unknown error. Ask the user for the exact error first, then debug the upload path in `knowledge.service.js` (requirements: Qdrant collection reachable, provider or global OpenAI key present, supported file type, non-empty extracted text).
