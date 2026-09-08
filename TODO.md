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

## 5. MCP UI — ✅ FIXED (OAuth owner-connect redirect)

**Current state:** list + new + edit pages built
(`mcps/page.tsx`, `mcps/new/page.tsx`, `mcps/[mcpId]/edit/page.tsx`). The edit
page covers transport, auth (api-key / OAuth owner+user), dynamic registration,
usage, and delete-with-usage-guard.

- [x] Fixed: owner-connect OAuth redirected back to the old
      persona.hasanraiyan.me dashboard instead of
      platform.persona.hasanraiyan.me after connecting.
      Root cause: `agent-backend/src/modules/mcp/mcp.service.js`'s
      `handleOwnerCallback` always built the return URL from
      `config.websiteUrl` + a stale `/developer/projects/.../mcps/.../edit`
      path — the frontend/'s legacy route, not platform/'s
      (`/projects/.../mcps/.../edit`, no `/developer` prefix). Both apps hit
      the identical `ProjectAdmin`-context backend route, so the backend
      couldn't tell which app initiated the flow.
      Fix: added `config.platformUrl` (env `PLATFORM_URL`) and a
      `returnApp=platform` param that `platform/src/lib/api/projects.ts`'s
      `getProjectMcpOwnerAuthorizeUrl` now sends, signed into the OAuth
      `state` token and read back in `_ownerRedirectBase()` to pick the
      right app/domain. frontend/'s legacy `/developer/...` flow is
      untouched (still defaults to the old path when `returnApp` is absent).
- [x] Found separately (by user): a *different* MCP OAuth failure —
      `invalid_scope: ... not allowed to request scope 'public_metadata'`
      from Clerk (clerk.pyqdeck.in) — hit when creating an MCP with Dynamic
      Client Registration and no explicit Scopes. Root cause:
      `mcp.service.js`'s `createMcp` DCR branch (~line 131) unconditionally
      sets `oauth.scopes = discovered.scopesSupported` (every scope the
      target server's discovery doc advertises), unlike the manual-clientId
      branch which respects a user-supplied scope list. Clerk advertises
      `public_metadata`/`private_metadata` in discovery but doesn't grant
      them to a freshly dynamically-registered client by default.
      Workaround used: edit the MCP's Scopes field to an explicit,
      narrower list and retry Connect.
      Not yet fixed in code — `createMcp`'s DCR branch should respect a
      user-supplied `data.oauth.scopes` the same way the manual branch does
      (`platform`'s New MCP form already has a Scopes input for this).
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