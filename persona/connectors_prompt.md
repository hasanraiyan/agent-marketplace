# Task: Build the full "Connectors" experience in the Flutter app (match the web)

## Role
You are an autonomous Flutter engineer working in the `persona/` app (the Android/Flutter
client of agent-marketplace). Pick up this file and implement the change end-to-end: read
the referenced files (Flutter + the Next.js web reference + the Express backend), write the
code, and make sure `flutter analyze` passes.

## Problem (what's wrong / missing today)
The web frontend has a polished, unified **Connectors** hub under `/dashboard/connectors`
with four sub-areas — **Skills, Knowledge Bases, MCP Servers, and AI Memory** — each with
list / create / detail / edit flows, a shared left nav, a public skills marketplace, file
upload for knowledge, and OAuth/API-key auth for MCP servers.

The Flutter app only has **partial, scattered** versions of three of these (Skills, MCP
Servers, Knowledge) buried under the **Profile** tab as plain list/form screens. It is
**missing**: the unified Connectors landing hub, the connectors nav, the **public skills
marketplace**, skill/MCP **detail pages**, MCP **OAuth + API-key** flows, knowledge **file
upload + document management**, and the **entire AI Memory** feature. The "Connectors" item
in the side drawer currently just routes to `/profile`.

## Goal
Bring the Flutter app to **feature + UX parity with the web Connectors area**: a dedicated
Connectors hub with the 4 cards, a connectors nav, and complete list/create/detail/edit
flows for **Skills, Knowledge, MCPs, and Memory** — translated into idiomatic Flutter
(Riverpod + go_router + AppColors/AppTypography), **not** a port of React/Tailwind.

---

## Reference: web (the design + behaviour to mirror — DO NOT port React, match the UX)

Read these under `frontend/src/`:
- `app/dashboard/connectors/layout.jsx` — two-pane layout (left `ConnectorsNav` + content),
  per-section header (title/description/action button), wrapped in `ConnectorsProvider`.
- `app/dashboard/connectors/page.jsx` — **landing**: 4 `ConnectorCard`s (icon tile, title,
  uppercase badge, description, divider, `{count} items` + "Manage →"). Order + colors:
  Skills (CORE, purple), Knowledge Bases (RAG, green), MCP Servers (PROTOCOL, blue),
  AI Memory (MEMORY, violet).
- `app/dashboard/connectors/connectors-context.jsx` — shared state: on mount fetches skills
  (mine + public), mcps, knowledge in parallel; memory lazy. Optimistic create/update/
  delete/toggle with toasts.
- `components/skills/connectors-nav.jsx` — context-sensitive left nav (per current section),
  "All Connectors" back-link, per-section action button.
- **Skills:** `app/dashboard/connectors/skills/page.jsx` (list + search + empty),
  `skills/new/page.jsx` + `components/skills/skill-editor.jsx` (shared create/edit form),
  `skills/[id]/page.jsx` + `components/skills/skill-detail.jsx` (detail + used-by-agents +
  SKILL.md render + copy + delete), `skills/[id]/edit/page.jsx`, `skills/public/page.jsx`
  (public marketplace).
- **MCPs:** `app/dashboard/connectors/mcps/page.jsx` (list), `mcps/new/page.jsx` +
  `components/skills/mcp-editor.jsx` (shared form: transport / auth-type / auth-mode
  `SelectCard`s, OAuth DCR + manual, API key), `mcps/[id]/page.jsx` +
  `components/skills/mcp-detail.jsx` (detail: test connection, tools/resources/templates,
  OAuth connect/disconnect, enable toggle, used-by-agents), `mcps/[id]/edit/page.jsx`.
- **Knowledge:** `app/dashboard/connectors/knowledge/page.jsx` (list), `knowledge/new/page.jsx`
  (create form: name, description, AI provider select, advanced vector settings),
  `knowledge/[id]/page.jsx` (detail = inline edit of name/description + drag/drop file
  upload + documents list with delete).
- **Memory:** `app/dashboard/connectors/memory/page.jsx` (single dashboard: profile summary
  + preferences, agent memories list with inline edit/delete/search, inline create form,
  overview stats, "Clear All Memory" danger zone).
- API client shapes: `lib/api/{skills,mcps,knowledge,memory,providers,core}.js`.

### Exact UX details to honour (from the web)
- **Lists** are responsive card grids (1/2/3/4 cols), each with: gradient icon tile,
  status/visibility badge, line-clamped name + description, footer stat + CTA. Consistent
  **empty states** (icon tile + heading + body + pill action) and **no-search-results**
  states (search icon + "Clear search"). Search is **client-side** over loaded data.
- **Skill editor fields:** Name (auto-slugified to `[a-z0-9-]`, "Will be saved as: {slug}"),
  Description (Textarea, max **1024**, live counter), Instructions/SKILL.md (monospace,
  max **50,000**, counter), Public Marketplace `Switch`. Validation requires name +
  description + instructions. (Web also drafts to localStorage in create mode — optional.)
- **Skill detail:** identity card (Public/Private + owner badge), SKILL.md markdown render +
  Copy, "Used by Agents" grid, owner-only Edit/Delete (AlertDialog warns if used by agents),
  details card (Type/Visibility/Used-by/Created/Updated).
- **Public skills marketplace:** own search; cards show author (`ownerId.username` or
  "Community"); link to the same skill detail page.
- **MCP editor fields:** Name, Description, Transport (`http`|`sse` SelectCards), Server URL,
  Auth Type (`none`|`oauth`|`apiKey` SelectCards), Auth Mode (`owner`|`user`). apiKey → key
  field. oauth → DCR auto-register checkbox (create only) OR manual Client ID / Client
  Secret. Edit mode: password fields show "Leave blank to keep current".
- **MCP detail:** Test Connection (toast tool/resource counts), tools / resources /
  resourceTemplates lists, OAuth connect/reconnect/disconnect (owner + per-user), enable
  `Switch` (toggle), Configure (edit), Remove (dialog), used-by-agents.
- **Knowledge create fields:** Name, Description, **AI Provider** select (from
  `getProviders()`, auto-select default; amber warning + link to provider settings if none),
  advanced (collapsible): Embedding Model (`text-embedding-3-small` 1536 default /
  `-3-large` 3072 / `ada-002` 1536), Chunk Size (800), Chunk Overlap (100), Top K (5,
  max 50).
- **Knowledge detail:** inline edit name/description only; drag/drop or pick files
  (`.pdf,.txt,.md,.json,.csv`, ≤20MB, ≤10 files, multipart field name `files`); documents
  list (fileName, KB size, `{chunkCount} chunks`, delete-with-confirm).
- **Memory dashboard:** profile summary + preferences (read-only), agent memories list
  (agent badge + key + updatedAt + value; inline edit value; delete; search), inline create
  (Agent select + Key + Value), overview stats, "Clear All Memory" confirm dialog.

---

## Reference: backend (the real API contract — base prefix `/api/v1`, Bearer auth)

All endpoints require Clerk Bearer auth (already handled by the app's Dio client). Response
envelope is `{ data: <payload> }` (lists → array, create/get → object). Entities use Mongo
`_id` (with `id` fallback). Read `agent-backend/src/{routes,controllers,models,validators}/`
for exact rules; key points:

- **Skills** `/skills`:
  - `GET /skills` (mine), `GET /skills/public` (`page`,`limit`,`search`), `GET /skills/search`
    (`q`,`scope`,`limit`), `POST /skills`, `GET /skills/:id`, `GET /skills/:id/agents`,
    `PATCH /skills/:id`, `DELETE /skills/:id`.
  - Model: `name` (req, min2/max64, `^[a-z0-9-]+$`, lowercased), `description` (req,
    min10/max1024), `instructions` (req, min10/max50000), `isPublic` (bool),
    optional `codeSnippets[]`. Unique `{ownerId,name}` → **409** on dup.
- **MCPs** `/mcps`:
  - `GET /mcps`, `POST /mcps`, `GET /mcps/:id`, `GET /mcps/:id/agents`, `PATCH /mcps/:id`,
    `DELETE /mcps/:id`, `POST /mcps/:id/test`, `GET /mcps/:id/resource?uri=`,
    `POST /mcps/:id/call-tool` (`{name,arguments}`), and OAuth:
    `GET /mcps/:id/oauth/owner/authorize`, `GET /mcps/:id/oauth/user/authorize?returnTo=`,
    `GET /mcps/:id/oauth/user/status`, `DELETE /mcps/:id/oauth/user/connection`,
    `DELETE /mcps/:id/oauth/owner/connection`.
  - Model: `name` (req,2..100), `description` (≤500), `transport` enum `http|sse` (req),
    `url` (req, URL), `authType` enum `none|oauth|apiKey` (def none), `authMode` enum
    `owner|user` (def owner), `oauth` subdoc, `apiKey` (create payload), `isEnabled` (def
    true), plus server-populated `tools[]`, `resources[]`, `resourceTemplates[]`,
    `lastTestedAt`. Create payload: `{name,description,transport,url,authType,authMode,
    useDynamicRegistration?, oauth:{clientId,clientSecret,scopes?}?, apiKey?}`. Safe JSON
    strips secrets → exposes `hasApiKey`, `oauth.{clientId,hasClientSecret,...,ownerConnected}`.
    Refinements: oauth ⇒ DCR true OR `oauth` present; apiKey ⇒ `apiKey` present. Unique
    `{ownerId,name}` → **409**.
- **Knowledge** `/knowledge`:
  - `POST /knowledge`, `GET /knowledge`, `GET /knowledge/:id`, `PATCH /knowledge/:id`,
    `DELETE /knowledge/:id`, `POST /knowledge/:id/upload` (multipart, field `files`, ≤10,
    ≤20MB, `.pdf/.txt/.md/.json/.csv`), `GET /knowledge/:id/documents`,
    `DELETE /knowledge/:id/documents/:sourceName` (URL-encode sourceName),
    `POST /knowledge/:id/search` (`{query, topK≤50}`).
  - Model: `name` (req, max200), `description` (≤1000), `embeddingModel` (def
    `text-embedding-3-small`), `providerId` (ObjectId), `chunkSize` (800), `chunkOverlap`
    (100), `topK` (5), server-managed `documents[]`, `documentCount`, `chunkCount`.
- **Memory** `/memory` (no Mongoose model; raw collection):
  - `GET /memory` → `{ profile:{summary,preferences{}}, agentMemories:[{agentId,agentName,
    key,value,createdAt,updatedAt}] }`. `POST /memory` (`{agentId,key,value}` all req),
    `PUT /memory/:agentId/:key` (`{value}`), `DELETE /memory/:agentId/:key`,
    `DELETE /memory/all`.
- **Providers** `/providers` — used by the knowledge create form's "AI Provider" select.

---

## Reference: current Flutter implementation (what exists / extend vs build)

- **Routing** — `lib/core/router/router.dart`, `lib/core/router/route_names.dart`. Connector
  routes currently live under **`/profile/...`**: `providers`, `mcps`, `skills`, `knowledge`
  (`route_names.dart:28-45`). The side-drawer **"Connectors"** nav item
  (`lib/features/shell/presentation/pages/main_shell.dart`) routes to `RouteNames.profile`.
- **Profile hub** — `lib/features/profile/presentation/pages/profile_screen.dart` currently
  lists LLM Providers / MCP Servers / Skills / Knowledge Bases as simple tiles
  (`profile_screen.dart:54-77`). Decide: either build a dedicated Connectors hub screen +
  route, or repurpose this — but match the web's 4-card landing (note web's Connectors =
  Skills/Knowledge/MCPs/**Memory**, and keeps LLM Providers separate under settings).
- **Skills (partial)** — `lib/features/skills/`:
  `data/datasources/skill_remote_datasource.dart`, `data/models/skill_model.dart`,
  `presentation/pages/skills_screen.dart`, `skill_form_screen.dart`,
  `presentation/providers/skills_provider.dart`. **Missing:** public marketplace, detail
  page, used-by-agents, SKILL.md markdown render, slug helper, char counters.
- **MCP Servers (partial)** — `lib/features/mcp_servers/`:
  `mcp_remote_datasource.dart`, `mcp_model.dart`, `mcp_list_screen.dart`,
  `mcp_form_screen.dart`, `mcp_provider.dart`. **Missing:** detail page, transport/auth
  SelectCards, OAuth (DCR + manual + connect/disconnect), API-key, test-connection, tools/
  resources display, enable toggle. (Note: empty scaffold dirs also exist at
  `lib/features/mcp_config/` — ignore or remove.)
- **Knowledge (partial)** — `lib/features/knowledge/`:
  `knowledge_remote_datasource.dart`, `knowledge_model.dart`, `knowledge_list_screen.dart`,
  `knowledge_detail_screen.dart`, `knowledge_provider.dart`. **Missing:** create form with
  provider + vector settings, file upload + document management.
- **Providers** — `lib/features/provider_keys/` (`provider_remote_datasource.dart`,
  `provider_model.dart`, `provider_notifier.dart`) — reuse for the knowledge "AI Provider"
  select.
- **Memory** — **does not exist**. Build a new feature folder
  `lib/features/memory/{data,presentation}` end-to-end.
- **Networking** — `lib/core/network/dio_client.dart`, `lib/core/network/api_response.dart`,
  `lib/core/config/api_constants.dart` (has `mcps`, `skills`, `knowledge`, `providers`; add
  `memory` and `skillsPublic` etc. as needed). Auth header is already attached by the Dio
  client.
- **Shared widgets/theme** — `lib/shared/widgets/{empty_state.dart,skeleton_loader.dart}`,
  `lib/shared/utils/responsive.dart`, `lib/core/theme/{colors.dart,typography.dart}`. Reuse
  the existing card / empty-state / skeleton patterns (see `marketplace_screen.dart` and
  `sidebar_thread_list.dart` for current styling conventions).

---

## Implementation tasks

1. **Connectors hub + nav + routes.**
   - Create a Connectors landing screen with the **4 cards** (Skills, Knowledge, MCP
     Servers, AI Memory) mirroring `page.jsx` (icon tile, uppercase badge, description,
     `{count} items`, Manage →). Wire live counts from the providers.
   - Add a Connectors **nav/sub-navigation** appropriate for mobile (e.g. the hub cards
     themselves + a back affordance on each sub-screen; a desktop/tablet left rail is
     optional but nice for the wide shell).
   - Point the side-drawer **"Connectors"** item to the new hub. Decide route layout — e.g.
     move to `/connectors/...` (skills, mcps, knowledge, memory) or keep `/profile/...`; keep
     `route_names.dart` + `router.dart` consistent and update all `context.push` call sites.

2. **Skills parity.** Extend `lib/features/skills/`:
   - List screen: card grid, client-side search, empty + no-results states, "New Skill".
   - **Skill editor** (shared create/edit): Name (slugify + "Will be saved as"), Description
     (max 1024 + counter), Instructions/SKILL.md (monospace, max 50000 + counter), Public
     `Switch`; validation (all required); 409 duplicate-name handling.
   - **Skill detail**: identity (Public/Private + owner), SKILL.md markdown render + Copy,
     **Used by Agents** (`GET /skills/:id/agents`), owner-only Edit/Delete (confirm dialog),
     details card.
   - **Public marketplace** screen (`GET /skills/public`, `page`/`limit`/`search`): cards
     with author, link to the same detail page.

3. **MCP parity.** Extend `lib/features/mcp_servers/`:
   - List screen: card grid (status badge, tools count, transport pill), search, empty.
   - **MCP editor** (shared): Name, Description, Transport SelectCards (`http`/`sse`), URL,
     Auth Type SelectCards (`none`/`oauth`/`apiKey`), Auth Mode SelectCards (`owner`/`user`),
     conditional API-key field, OAuth DCR checkbox (create) + manual Client ID/Secret; edit
     "leave blank to keep" placeholders; validation per backend refinements.
   - **MCP detail**: Test Connection (`POST /:id/test`, toast counts), tools / resources /
     resourceTemplates lists, enable `Switch` (PATCH `{isEnabled}`), Configure, Remove
     (dialog), used-by-agents, and OAuth connect/reconnect/disconnect (owner + per-user) —
     authorize endpoints return a URL to open in a browser (use `url_launcher`; note the
     Windows webview limitation already handled elsewhere). If full OAuth browser round-trip
     is out of scope on mobile, implement connect via external browser + status polling and
     **document any limitation** — don't block the rest.

4. **Knowledge parity.** Extend `lib/features/knowledge/`:
   - List screen: card grid (docs/chunks, RAG pill), search, empty.
   - **Create form**: Name, Description, **AI Provider** select (reuse `provider_keys`;
     auto-select default; amber warning + link if none), collapsible advanced (Embedding
     Model, Chunk Size 800, Chunk Overlap 100, Top K 5/max 50).
   - **Detail**: inline edit name/description; **file upload** (pick `.pdf/.txt/.md/.json/
     .csv`, ≤20MB, multipart field `files`) with progress; **documents list** (fileName, size,
     chunks, delete-with-confirm via `DELETE /:id/documents/:sourceName`).

5. **Memory (new feature).** Build `lib/features/memory/`:
   - Datasource for `GET/POST /memory`, `PUT/DELETE /memory/:agentId/:key`,
     `DELETE /memory/all`; model for `{profile, agentMemories[]}`.
   - **Dashboard screen**: profile summary + preferences (read-only), agent memories list
     (agent badge + key + updatedAt + value; inline edit value; delete; search), inline
     create (Agent select sourced from the user's agents — see
     `agent_provider.dart` `myAgentsProvider`; Key; Value), overview stats, **Clear All
     Memory** confirm dialog.
   - Add the route + hub card.

## Constraints & conventions
- Match the **surrounding Flutter code style**: Riverpod (`ConsumerWidget`/`AsyncNotifier`),
  `AppColors`/`AppTypography`, dark mode via `Theme.of(context).brightness`, the existing
  card/empty/skeleton/dialog patterns. **Don't** introduce new theming primitives or port
  Tailwind classes.
- Reuse existing datasources/models/providers where present; extend rather than rewrite.
- Keep the existing chat-open and agent contracts intact; don't break current `/profile`
  routes used elsewhere until call sites are migrated.
- Respect backend validation client-side (char limits, required fields, slug regex, enums)
  and surface **409 duplicate-name** errors cleanly.
- Confirmations use `showDialog` (AlertDialog); transient feedback uses SnackBars.
- Markdown (SKILL.md) → use the markdown package already in `pubspec.yaml`
  (`flutter_markdown`); file picking → add a picker package if not present (note it in
  pubspec) ; opening OAuth URLs → `url_launcher`.
- Works in **both** phone and tablet/wide layouts (the app has narrow + wide shells).

## Acceptance criteria
- [ ] A **Connectors hub** shows 4 cards (Skills, Knowledge, MCP Servers, AI Memory) with
      live counts; the side-drawer "Connectors" item opens it.
- [ ] **Skills**: list+search, create/edit (slug + counters + public), detail (SKILL.md
      render + copy + used-by-agents + delete), and a **public marketplace**.
- [ ] **MCPs**: list+search, create/edit (transport/auth/mode SelectCards, OAuth DCR +
      manual, API key), detail (test connection, tools/resources, enable toggle, remove,
      used-by-agents, OAuth connect/disconnect or a documented limitation).
- [ ] **Knowledge**: list+search, create (provider + vector settings), detail (inline edit,
      file upload, documents list with delete).
- [ ] **Memory**: dashboard with profile + agent memories (create/edit/delete/search),
      overview stats, clear-all.
- [ ] All states handled: loading skeletons, empty states, no-search-results, errors.
- [ ] Backend contract honoured (`/api/v1`, `{data}` envelope, field names, limits, 409s).
- [ ] Works on phone + tablet; `flutter analyze` is clean; no dead routes/unused imports.

## Suggested order of work
1. Routes + Connectors hub screen + nav; point the drawer item at it.
2. Skills: detail page + public marketplace + editor parity (extend existing).
3. Knowledge: create form (with providers) + detail upload/documents.
4. MCPs: editor (SelectCards + auth) + detail (test/tools/toggle) + OAuth (external browser).
5. Memory: new feature end-to-end.
6. `flutter analyze` and self-review against acceptance criteria.
