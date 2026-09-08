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
      Client Registration and no explicit Scopes. Confirmed the
      `scopes_supported` list (which includes `public_metadata`/
      `private_metadata`) is generated entirely by Clerk itself as the
      identity provider — checked `D:\projects\PYQDECK\server` (the MCP
      server being connected to) and its `mcp/adminAuth.js`/
      `publicMcpAuth.js` just verify bearer tokens against Clerk, they don't
      define any discovery/scopes document — so there was nothing to fix on
      that side.
- [x] Fixed in code: `agent-backend/src/modules/mcp/mcp.service.js`'s
      `createMcp` DCR branch now uses
      `data.oauth?.scopes?.length ? data.oauth.scopes : discovered.scopesSupported`
      (same pattern the manual-clientId branch already used), instead of
      unconditionally forcing `oauth.scopes = discovered.scopesSupported`.
      `platform`'s New MCP form already sends `data.oauth.scopes` when the
      Scopes field is filled in, dynamic-registration or not — it was just
      being silently ignored by the backend for the DCR path. Fixes this
      for every newly-created MCP going forward.
- [x] Fixed a bigger, protocol-level bug (user noticed our MCP OAuth client
      also fails against unrelated third-party servers — e.g. Context7's
      `https://mcp.context7.com/mcp` — while Claude connects to the same
      servers fine): `agent-backend/src/modules/mcp/mcp-oauth-client.js`
      never sent the `resource` parameter (RFC 8707 Resource Indicators)
      on the authorize request, token exchange, or token refresh. The MCP
      Authorization spec (2025-06-18) requires clients to send `resource`
      (the MCP server's canonical URL) so a multi-tenant authorization
      server can audience-bind the issued token to that specific resource —
      reference clients like Claude send it; ours never did. Fixed:
      `buildAuthorizationUrl`/`exchangeCodeForToken`/`refreshAccessToken`
      now all accept and send `resource`, wired from `mcp.url` at every
      call site in `mcp.service.js` and `mcp-token.service.js`. This is
      likely the real root cause behind broader OAuth interop failures,
      not just the pyqdeck/Clerk case — worth retesting Context7 and any
      other previously-failing MCP server after this deploys.
- [x] Migrated `agent-backend/src/modules/mcp/mcp-oauth-client.js` off the
      hand-rolled OAuth implementation onto the official
      `@modelcontextprotocol/sdk`'s `client/auth.js` module (already a
      dependency, v1.29.0) — user asked to check for a library that
      handles this instead of hand-rolling it, and this SDK does. Kept the
      same exported function names/shapes so `mcp.service.js`/
      `mcp-token.service.js` needed almost no call-site changes. Gains over
      the old code: OIDC-fallback discovery, structured OAuth error
      parsing, and — the real correctness fix — proper client-auth-method
      selection at the token endpoint (`selectClientAuthMethod`: HTTP
      Basic / POST-body / public, based on how the client was actually
      registered). The old code never used HTTP Basic auth at all, always
      putting `client_secret` in the POST body regardless of what the
      server expected — a second, independent interop bug beyond the
      missing `resource` param. `tokenEndpointAuthMethod` (already stored
      per-MCP from registration) is now threaded through
      `exchangeCodeForToken`/`refreshAccessToken` so the SDK picks the
      right method instead of guessing. Verified: app boots clean, module
      imports resolve, pure functions (`generatePkcePair`,
      `buildAuthorizationUrl`) produce identical output to before.
- [ ] Manual step still needed for the MCP created *before* this fix
      (project `6a97f0fc25f0ae6efb32b390`, mcp `6a9fd8d09a67f0dc7c5e7f21`):
      its bad scopes are already stored in the DB, so the code fix doesn't
      retroactively touch it. Open its Platform edit page, replace Scopes
      with an explicit list that excludes `public_metadata`/
      `private_metadata` (pyqdeck's MCP only needs a signed-in Clerk
      account — no metadata access), save, then Connect again.
      `updateMcp` reuses the existing `clientId`, so this doesn't re-run
      Dynamic Client Registration against Clerk.
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