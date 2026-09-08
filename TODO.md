# Platform UI — TODO

Status legend: ✅ built · ⚠️ built but needs fixes · 🚧 needs building

Work area: `platform/` (Developer Studio). Backend is complete for all of these —
the gaps below are all frontend.

---

## 1. Agents tab — 🚧 NEEDS BUILDING (biggest gap)

**Current state:** only the list page exists (`projects/[projectId]/agents/page.tsx`).
Its "New" button points at `/agents/new` and rows point at `/agents/[id]/edit` —
**both routes 404.**

**API already available** (`platform/src/lib/api/projects.ts`):
- `createProjectAgent`, `updateProjectAgent`, `deleteProjectAgent`, `bulkDeleteProjectAgents`
- `createProjectAgentVoiceSession` (for the Playground)

**Tasks:**
- [ ] **Agent create page** — `projects/[projectId]/agents/new/page.tsx`
- [ ] **Agent edit page** — `projects/[projectId]/agents/[agentId]/edit/page.tsx`
      (load agent from list, find by id — same pattern as the MCP edit page)
- [ ] **Agent builder form** — name, description, system prompt, model/provider,
      enable/disable. Follow the MCP/REST-Tool edit-page conventions (Breadcrumb,
      Card grid, inline `FieldError` instead of toasts)
- [ ] Decide how agents attach Skills / Knowledge / MCP / REST Tools / RCP /
      Secrets — check the backend agent schema + the legacy developer studio
      (`frontend/src/app/developer/projects/[id]/agents/`) for the attach model
      before building the pickers

---

## 2. Playground — ⚠️ PAGE EXISTS, NOT WIRED

**Current state:** `projects/[projectId]/playground/page.tsx` is a **static
component-gallery demo** (mock messages, toggle buttons). The comment in the file
says it all: not yet connected to a real agent.

**Assets that already exist:**
- Full chat component set: `ChatScroller`, `ChatMessage`, `ChatComposer`,
  `ChatEmptyState`, `InterruptPanel`, `VoiceIndicator`, `ThinkingIndicator`,
  `SubagentSheet`, `WorkspaceFilePanel` (`platform/src/components/chat`)
- `useAguiChat` hook + AG-UI client (`platform/src/lib/agui`)
- `useVoiceSession` hook (`platform/src/hooks/use-voice-session.ts`)

**Tasks:**
- [ ] Pick which agent to test (agent selector — reuse the project's agent list)
- [ ] Wire `useAguiChat` to the agent's AG-UI streaming endpoint
- [ ] Replace the demo sections with a real chat UI (empty state → composer →
      message stream → tool traces / subagents / workspace files)
- [ ] Wire interrupt panels (clarification + HITL) to real AG-UI interrupts
- [ ] Wire voice (start/stop a voice session per agent)

---

## 3. Knowledge UI — ⚠️ BUILT, has an issue

**Current state:** list + new + detail pages built
(`knowledge/page.tsx`, `knowledge/new/page.tsx`, `knowledge/[kbId]/page.tsx`).

- [ ] Investigate + fix the reported issue
      somethign is failing uabe to cra tha  knowlege base 
- [ ] Re-verify end-to-end: create KB → upload docs → query from an agent

---

## 4. Stores UI — ⚠️ BUILT, has an issue

**Current state:** list + new + edit pages built
(`stores/page.tsx`, `stores/new/page.tsx`, `stores/[storeId]/edit/page.tsx`).

- [ ] Investigate + fix the reported issue
            somethign is failing uabe to cra tha  knowlege base 

- [ ] Re-verify end-to-end: create store → save records → read from an agent

---

## 5. MCP UI — ⚠️ BUILT, has an issue

**Current state:** list + new + edit pages built
(`mcps/page.tsx`, `mcps/new/page.tsx`, `mcps/[mcpId]/edit/page.tsx`). The edit
page covers transport, auth (api-key / OAuth owner+user), dynamic registration,
usage, and delete-with-usage-guard.

- [ ] Investigate + fix the reported issue
      whicht do concnet to teh cmcp it redie to old platform inst of this platform.persona* it redi to teh persona.  we need to find first how the cmp conn work and we need to built that 
- [ ] Re-verify end-to-end: add server → Test Connection → attach to an agent

---

## Done recently (for context)

- ✅ REST Tools fully built in the platform (list was there; editor, new/edit
  pages, secret picker, cURL paste, test-call ported from the legacy frontend)
- ✅ Tool Sources removed from the platform UI (feature no longer needed)
- ✅ Delete-confirmation buttons fixed (missing `--destructive-foreground` theme
  var made text black on red)
- ✅ Skills editor: Ctrl+S / Cmd+S save shortcut; project switcher redesigned +
  app icon added

---

## How to pick up a task

1. Check the "API already available" note — most backend wiring is done.
2. Copy the conventions from the closest completed page (MCP edit page is the
   reference for form pages; REST-Tool editor for builder-style pages).
3. Every page: `tsc --noEmit` + `pnpm exec eslint <file>` + a dev-server smoke
   test before calling it done.