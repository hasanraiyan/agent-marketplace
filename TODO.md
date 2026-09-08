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

## 4. Stores UI — ✅ FIXED

**Current state:** list + new + edit pages built
(`stores/page.tsx`, `stores/new/page.tsx`, `stores/[storeId]/edit/page.tsx`).

- [x] Reported issue (creating a store was failing) — confirmed fixed by
      the user (2026-09-08).
- [x] Re-verified end-to-end by the user: create store → save records →
      read from an agent.

---

## 5. MCP UI — ✅ FIXED (OAuth owner-connect end-to-end)

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
- [x] Fixed the actual root cause behind the `public_metadata`/`openid`
      `invalid_scope` failures (retested against Context7's
      `clerk.context7.com` — same failure class, this time on the plain
      `openid` scope). The earlier "respect caller-supplied scopes" fix
      only helped when scopes WERE supplied — the fallback when they
      weren't was still `discovered.scopesSupported` (every scope the
      discovery doc advertises). Two independent Clerk instances now
      confirm a DCR-registered client is granted none of the advertised
      scopes by default, so that fallback was never safe. Changed
      `createMcp`'s DCR and manual branches to default to `[]` (no `scope`
      param sent at all — the server applies its own default grant)
      instead of `discovered.scopesSupported`. Also threads the resolved
      scope list into `dynamicClientRegistration`'s registration request
      itself (was previously never sent at registration time at all),
      matching the SDK's documented Scope Selection Strategy (SEP-835).
- [ ] Manual step still needed for MCPs created *before* this fix — their
      bad scopes are already stored in the DB, so the code fix doesn't
      retroactively touch them:
      - project `6a97f0fc25f0ae6efb32b390`, mcp `6a9fd8d09a67f0dc7c5e7f21`
        (pyqdeck, rejected `public_metadata`/`private_metadata`)
      - project `6a97f0fc25f0ae6efb32b390`, mcp `6a9ffbf8a87879ba06afab6c`
        (Context7, rejected `openid`)
      For each: open its Platform edit page, clear the Scopes field to
      empty (or an explicit minimal list if the server documents one it
      actually needs), save, then Connect again. `updateMcp` reuses the
      existing `clientId`, so this doesn't re-run Dynamic Client
      Registration.
- [x] Fixed a real bug reported directly: editing an MCP (not creating one)
      and checking "Use dynamic client registration" always failed with
      "Client ID is required when auth type is oauth", 100% of the time.
      Root cause: `agent-backend/src/modules/mcp/mcp.service.js`'s
      `updateMcp` had **no Dynamic Client Registration branch at all**
      (unlike `createMcp`, which does) — it unconditionally required a
      `clientId`, either from the payload or the existing record, with no
      code path that ever ran registration. So switching an MCP to OAuth +
      DCR from the edit page could never work. Fixed by mirroring
      `createMcp`'s DCR branch in `updateMcp`, gated on
      `data.useDynamicRegistration && !hasClientId` so an MCP that already
      has a client (DCR'd earlier or manually entered) keeps reusing it on
      further edits instead of re-registering and orphaning connected
      tokens. Also fixed a related latent crash in the same code region:
      `existing.oauth.clientSecretEncrypted` (no optional chaining) would
      throw if an MCP was being switched from `none`/`apiKey` to `oauth`
      for the first time, since `existing.oauth` is `undefined` in that
      case — now `existing.oauth?.clientSecretEncrypted`.
      Also fixed the matching frontend bug: `platform`'s MCP edit page
      pre-filled the "Use dynamic client registration" checkbox from
      `found.useDynamicRegistration`, a field the API response never
      actually has (it's `found.oauth.dynamicallyRegistered`, nested) — so
      opening an already-DCR'd MCP to edit always showed the checkbox
      unchecked. Fixed to read the real field; removed the incorrect
      top-level `useDynamicRegistration` from the `Mcp` TS interface.
- [x] Fixed two more real bugs found live-testing (user hit both directly):
      1. `invalid_client: The requested OAuth 2.0 Client does not exist` —
         a regression from the SDK migration. `dynamicClientRegistration`
         hardcoded `tokenEndpointAuthMethod: 'client_secret_basic'`/`'none'`
         as literals instead of trusting `token_endpoint_auth_method` from
         the server's own registration response — RFC 7591 lets the server
         assign a different method than what was requested. The old
         hand-rolled client never used Basic auth at all (always POST
         body), so a wrong guess here was harmless before; the new SDK
         code actually acts on it, so a wrong guess now fails for real.
         Fixed: `mcp-oauth-client.js`'s `dynamicClientRegistration` now
         returns `data.token_endpoint_auth_method || <requested>` instead
         of a hardcoded literal.
      2. User caught a second issue in the previous `updateMcp` fix
         directly: reusing `existing.oauth.clientId` on edit is only safe
         when the authorization server hasn't changed. If the MCP's URL
         is edited to point at a different server, the old clientId
         belongs to the *old* server and reusing it fails downstream with
         the same confusing `invalid_client: does not exist` once Connect
         is clicked. Fixed: `updateMcp` now compares the freshly
         discovered `authorization_endpoint` against the stored one;
         if they differ, the old clientId/secret/authMethod/ownerToken are
         all treated as gone (server-scoped, not MCP-scoped) — forcing a
         clear upfront "provide a new Client ID or enable dynamic
         registration" validation error instead of a late, confusing
         provider-side failure.
- [x] Re-verified end-to-end by the user: owner-connect OAuth now
      completes successfully (2026-09-08). MCP OAuth connect flow is
      considered fixed — remaining scope is just the Platform UI TODO
      items below and the manual re-save step for any MCP records still
      carrying pre-fix stale data (see above).
- [x] Feature parity gap closed: user compared the old FRONTEND (Persona
      Studio's separate MCP *detail* page — `frontend/.../studio/
      (resources)/connectors/[id]/page.jsx` + `mcp-detail.jsx`, not the
      Developer Studio `/developer/...` pages this whole section was
      otherwise about) against Platform's edit page and found it missing:
      a live Connected/Not-connected status (Platform always showed both
      Connect and Disconnect buttons with no status awareness at all), and
      a "Test Connection" action + Tools/Resources/UI-templates display
      (Platform's Tools card existed in the JSX but nothing ever populated
      it — no Test Connection call existed for Project-scoped MCPs at all).
      Root cause: the Project-admin admin API (`project.routes.js`, shared
      by Platform and the legacy `/developer/...` pages) never had a
      `POST /mcps/:mcpId/test` route — only the Persona-only `mcp.routes.js`
      had one. `mcpService.testConnection` already generalizes via
      `context` like every other MCP service method, so it needed no
      changes — added `projectController.testMcpConnection` +
      `adminRouter.post('/mcps/:mcpId/test', ...)` as a thin pass-through,
      and `testProjectMcpConnection` in `platform/src/lib/api/projects.ts`.
      Platform's edit page now: tracks `ownerConnected` from
      `mcp.oauth.ownerConnected` (already returned by `toSafeJson`, just
      never read), shows a single Connect/Reconnect button + a Disconnect
      button only when connected (matching the old page's UX), reads the
      `?connected=owner`/`?error=oauth_failed` query params the OAuth
      redirect has always sent but this page never acknowledged, and has a
      "Test connection" button that populates always-visible Tools/
      Resources/UI-templates cards with proper empty states (was
      previously silently blank since `mcp.tools` never got populated for
      any Project MCP). Verified: full `next build` succeeds (TypeScript
      clean, no Suspense-boundary issues from the added `useSearchParams`),
      backend boots clean.

---


---

## How to pick up a task

1. Check the "API already available" note — most backend wiring is done.
2. Copy the conventions from the closest completed page (MCP edit page is the
   reference for form pages; REST-Tool editor for builder-style pages).
3. Every page: `tsc --noEmit` + `pnpm exec eslint <file>` + a dev-server smoke
   test before calling it done.