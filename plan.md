# Persona SDK Documentation System — Architecture Plan v2 (Greenfield, JS-only)

> **Status:** Discovery Complete — Greenfield design, awaiting approval before legacy deletion  
> **Supersedes:** v1 (All-SDK) — now scoped per new directive  
> **Scope:** **JavaScript / Node.js SDKs ONLY** — `@personaai/sdk`, `@personaai/runtime`, `@personaai/adapters`, `@personaai/react`  
> **Explicitly OUT of scope:** `sdk/python` (old, unmaintained), `sdk/logger` (internal), `sdk/ui` (deprecated — replaced by `shadcn` registry at `platform/registry.json`), `sdk/devtools` (internal)  
> **Legacy handling:** All existing docs at `platform/content/docs/**` are **LEGACY ONLY** — treated as reference, not carried forward. New system is built from scratch in a fresh structure, legacy deleted only after this plan is approved.  
> **Approved base:** The **platform** Next.js infrastructure for docs (`platform/` with `content/docs/registry.json` + `src/lib/docs/mdx.ts` + `Streamdown/shiki`) is **approved** and retained as the website host — only its *content* is rebuilt greenfield.  
> **Method:** Read-only audit. Every conclusion grounded in inspected files.  
> **Date:** 2026-09-15  
> **Grounding legend:** `FACT` = path+line verified · `INFERENCE` = strongly implied · `RECOMMENDATION` = proposed design choice  

---

## Table of Contents

1. [Legacy Treatment](#1-legacy-treatment)
2. [Repository Discovery — Revised Scope](#2-repository-discovery--revised-scope)
3. [Understand Each SDK (JS-only)](#3-understand-each-sdk--js-only)
4. [Compare the SDKs](#4-compare-the-sdks)
5. [Documentation Information Architecture](#5-documentation-information-architecture)
6. [Repository Architecture — Where Docs Live](#6-repository-architecture--where-docs-live)
7. [Versioning Strategy](#7-versioning-strategy)
8. [Source of Truth](#8-source-of-truth)
9. [Documentation Generation](#9-documentation-generation)
10. [Documentation Website Architecture](#10-documentation-website-architecture)
11. [CI/CD and Release Workflow](#11-cicd-and-release-workflow)
12. [Documentation Quality](#12-documentation-quality)
13. [Industry Comparison](#13-industry-comparison)
14. [Final Recommendation](#14-final-recommendation)
15. [Migration — Legacy Deletion & Greenfield Boot](#15-migration--legacy-deletion--greenfield-boot)
16. [Self-Challenge Pass](#16-self-challenge-pass)
17. [Appendix — Evidence Index](#17-appendix--evidence-index)

---

## 1. Legacy Treatment

### 1.1 What is "legacy"

**FACT — Existing docs site exists but is legacy:**

- Location: `platform/content/docs/{sdk}/v{version}/` with 4 SDKs, 2 versions each (FACT `platform/content/docs/` listing):
  - `sdk/v0.7.5`, `sdk/v0.8.0` (pkg is `0.9.0` — lag)
  - `runtime/v0.9.5`, `runtime/v0.10.0` (pkg `0.11.0` — lag)
  - `adapters/v0.1.0`, `adapters/v0.2.0` (pkg `0.3.0` — lag)
  - `react/v0.8.1`, `react/v0.9.0` (pkg `0.10.0` — lag)
- Registry: `platform/content/docs/registry.json:32` (`sdks:[sdk,runtime,adapters,react]` with `latest+versions[]`)
- Tracking: `platform/content/docs/_tracking.json` (`{sdk,version,from,date,commit}`)
- Coverage check: `sdk/typescript/scripts/check-docs-coverage.mjs` (only `sdk` → `react/v0.9.0/types.mdx`)
- **INFERENCE:** Content is hand-copied per version (`v0.7.5` → `v0.8.0` diff), no generation, no per-SDK `docs/` source. Structure is usable but content is stale (latest trails package by 1 minor) and incomplete (missing `python`/`ui` already shows drift risk).

**RECOMMENDATION — Treat as legacy only:**

- **Do NOT migrate content file-by-file.** Use legacy only as *style reference* (frontmatter shape, `index.mdx` → `quickstart.mdx` → `guides/` → `resources/` grouping, `getDocsNavigation()` folder order). Do not preserve legacy MDX files into new system.
- **New system is built in a **fresh directory** `platform/content/docs-v2/` (or `docs/` — final name `platform/content/docs/` after legacy deletion). Legacy `platform/content/docs/**` stays untouched until approval, then **deleted in one commit** (Step 2 of §15).
- **Excluded SDKs are not brought forward:** No `python` docs (old), no `logger` docs (internal, single `concepts/logger.mdx` line if needed), no `ui` docs (deprecated — replaced by `shadcn` registry documented at `platform/README.md:15` `npx shadcn add https://platform…/r/chat.json`). This cuts new docs surface by ~35%.

### 1.2 What is "approved"

**FACT — Platform infra is approved:**

- `platform/` is Next.js 16.3 App Router with `gray-matter` + `Streamdown` + `remarkGfm` + `@streamdown/code` + `shiki 3` (FACT `platform/package.json:12`, `platform/src/lib/docs/mdx.ts:1`, `platform/src/components/docs/docs-renderer.tsx:1`).
- Routing: `content/docs/{sdk}/v{version}/` + `src/lib/docs/mdx.ts:37` `listDocs/readDoc/getDocsNavigation` + `src/lib/docs/registry.ts:10` `resolveVersion` + `components/docs/version-picker.tsx:1` (slug-preserving version switch).
- Layout: `docs/[sdk]/[version]/[...slug]` with `DocsSidebar`/`DocsBreadcrumbs`/`DocsPager`/`DocsRenderer` (collapsible, mobile drawer).
- Deploy: Vercel (`vercel.json` + `outputFileTracingIncludes: content/docs/**`).

**RECOMMENDATION — Keep the *infra*, rebuild the *content*:**

- Retain `platform/src/lib/docs/mdx.ts`, `registry.ts`, `docs-renderer.tsx`, `docs-sidebar.tsx`, `version-picker.tsx` — only adapt them to new `content/docs-v2/` path and to 4-SDK registry (no `python`/`ui`).
- Do not introduce a new docs framework (Docusaurus/Mintlify) — the approved platform infra already solves versioned file-system routing. Greenfield means *content* from scratch, not *framework* from scratch.

---

## 2. Repository Discovery — Revised Scope

### 2.1 Greenfield SDK inventory (JS-only)

**FACT — `sdk/` contains 8 packages, but greenfield covers exactly 4:**

| Folder | Published name | Version (`package.json:3`) | Include? | Reason |
|---|---|---|---|---|
| `sdk/typescript/` | `@personaai/sdk` (+ `@personaai/sdk/rest-tools`) | `0.9.0` | **YES** | L1 Foundation — raw API client. Server-side only. |
| `sdk/runtime/` | `@personaai/runtime` | `0.11.0` | **YES** | L2 Engine — every adapter wraps it. |
| `sdk/adapters/` | `@personaai/adapters` (`express`/`nestjs`/`nextjs`/`nextjs/server`) | `0.3.0` | **YES** | L2 Thin wrappers — single dep, shared `src/shared/`. Hero package. |
| `sdk/react/` | `@personaai/react` | `0.10.0` | **YES** | L3 Hooks & State — `PersonaProvider` + 12 hooks. Client-side. |
| `sdk/python/` | `persona-agent-sdk` | `0.3.0` | **NO** | Old, unmaintained — per directive. |
| `sdk/logger/` | `@personaai/logger` | `0.1.0` | **NO** | Internal leaf — OFF by default, zero-dep. One line in concepts if needed. |
| `sdk/ui/` | `@personaai/ui` | `0.9.1` | **NO** | Deprecated — replaced by `shadcn` registry at `platform/registry.json` (`chat`, `mcp-app`, `file-explorer` components via `npx shadcn add`). No SDK docs. |
| `sdk/devtools/` | `@personaai/devtools` | `0.1.2` | **NO** | Internal dev-only panel — README-only. |

Legacy pointers still on npm: `@personaai/express`, `@personaai/nestjs`, `@personaai/nextjs` frozen/deprecated at registry pointing to `@personaai/adapters/*` (deleted `2026-09-14`, `adapters/CHANGELOG.md:8`).

### 2.2 Package managers, languages, build, test (JS-only)

| Concern | FACT |
|---|---|
| **Package managers** | `pnpm@10` per-package (each `pnpm-lock.yaml`). **No root workspace** (`AGENTS.md:146`). Each `type:module`, `node>=18`. |
| **Languages** | TypeScript only (greenfield scope). ESM dual `esm+cjs+dts` via `tsup@8.3.5` (`tsup.config.ts:entry` lists subpaths). |
| **Frameworks** | SDK: native `fetch`. Runtime: neutral `RuntimeRequest/Response`. Adapters: `express@5` (peer `>=4`), `next@>=14/react>=18`, `@nestjs/*@10\|11`. React: React 18+. |
| **Build** | `tsup` per package. Adapters `tsup.config.ts:4` multi-entry `express/index, nestjs/index, nextjs/server, nextjs/client`. |
| **Test** | `vitest@3` + `supertest` (+ mocked `fetch` for SDK, real HTTP for runtime/adapters). Lint `eslint+typescript-eslint`, `prettier`. `pnpm typecheck = tsc --noEmit`. |
| **Git tags** | Only 2 tags: `@personaai/react@0.8.0`, `sdk/express-v0.1.0`. Release **deliberate manual** — CI never publishes. |
| **Version independence** | No lockstep — `sdk 0.9` vs `runtime 0.11` vs `react 0.10` vs `adapters 0.3`. Adapters tracks latest (`runtime^0.11 react^0.10 sdk^0.9`). |
| **Existing docs infra** | READMEs (300–440 LOC) + heavy JSDoc (`types/agent.ts:67`, `chat.ts:51`) + `runtime/examples/node-handler.ts` (copy-paste) + `examples/agent-chat/`. No `typedoc.json`, no generated API reference. Changelogs detailed (TS 237, runtime 275 lines). |

### 2.3 Current CI gap (JS-only lens)

**FACT — `.github/workflows/test.yml:52` matrix covers only 2 of 4 in-scope packages:**

- Covered: `typescript`, `runtime`, `adapters/express` (subpath)
- **Missing (in-scope but not in CI):** `react` — only 3 `test/*.mjs`, <10% runtime coverage; adapters `nestjs/nextjs` paths not fully matrix-tested.
- Out-of-scope already correctly ignored (but python was in matrix — will be removed).

---

## 3. Understand Each SDK — JS-only

### `@personaai/sdk` — L1 Foundation (`sdk/typescript/src/index.ts:189`)

- **Identity:** `@personaai/sdk@0.9.0`, MIT, `deps @ag-ui/core@0.0.57 @personaai/logger@0.1.0`, `peer zod optional`. **Production 0.9.x** (12 releases since `0.2.0`, only `0.2.0` breaking). Manual release.
- **Public API (60+ exports):**
  - `PersonaClient({baseUrl, credential, externalUserId?, fetch?, maxRetries?, logLevel?, logger?})` + `whoami(): PrincipalContext` + low-level `HttpClient`
  - Resources (13): `providers`, `skills`, `agents`, `knowledge` (documents upload/search), `mcps`+`mcps.oauth`, `restTools`, `threads`, `memory`, `stores`, `files`, `auditLogs`, `voice`, `workflows` (0.8), `chat`, `architect`
  - Streaming `ChatClient.stream(agentId, SendMessageOptions)→AsyncGenerator<AguiEvent>`, `sendMessage→ChatResult`, `ArchitectClient` + `EventType/AGUI_SCHEMA_VERSION/PersonaRunErrorEvent/Clarification/Hitl/McpApp/Subagent/Workflow*Payload`
  - Secondary entry `@personaai/sdk/rest-tools` → `defineRestTool()` (zod-gated)
  - Errors `PersonaApiError/PersonaAuthError/PersonaValidationError` (`errors.ts:54`)
  - Types (19 files): `Agent/Workflow/Thread/File/Knowledge/Mcp/Provider/Skill/Store/Memory/Voice/AuditLog` + `BulkDeleteResult/PaginatedResult/PrincipalContext/ResourceUsage`
  - Logging re-export from `@personaai/logger`
- **DX:** `npm install @personaai/sdk` → `new PersonaClient({baseUrl, credential})` → `whoami()` → `agents.create({name,systemPrompt,providerId})` → per-request `new PersonaClient({…,externalUserId})` → `threads.create` → `chat.stream/sendMessage` with `threadId/resume/contextOverride/context` → `interrupt` resume. Confusing: `externalUserId` dual-mode, `context` vs `contextOverride`, `storeMounts` bare-ids vs populated, `restToolsManifest` host-served, `providers.list()` → `[]` when `externalUserId` set.
- **Docs today:** README + full JSDoc + `platform/content/docs/sdk/v0.7.5|v0.8.0/` (legacy — to be rebuilt).

### `@personaai/runtime` — L2 Engine (`sdk/runtime/src/runtime.ts:644`)

- **Identity:** `@personaai/runtime@0.11.0`, deps `sdk^0.9 @ag-ui/core rcp-sdk@0.1`. Not installed directly (per `package-ecosystem.md:88`).
- **Public API (`types/options.ts:161`):** `createRuntime({baseUrl, credential, resolveUser, mountPath, mode, fetch, heartbeatIntervalMs, runGraceMs, maxTrackedRuns, capabilities, restToolsManifest, rcpManifest, logLevel, logger, hooks}) → {handle, close}`. `RuntimeCapabilities` (9 flags, default `false`): `agentsWrite/mcps/providers/skills/knowledge/stores/auditLogs/architect/workflowsWrite`. `RestToolsManifestOptions`, `RcpManifestOptions`. `RuntimeHooks` (9+): `beforeRun/afterRun/onError/beforeToolCall/afterToolCall/onFileUpload/onThreadCreate/onMemoryWrite/onVoiceSessionCreate` + workflow hooks. Routes ~35 always-on (`chat`, `threads`, `files`, `memory`, `mcpOAuth`, `workflows` stream, `voice/sessions`, `health`) + ~30 capability-gated.
- **DX:** Sacred `resolveUser:(request)=>string|null` is the one touch-point. Two-tier capability trust. Single-process reconnect only (honest limitation). Host example `createServer(toNodeHandler(runtime))` from `examples/node-handler.ts`.
- **Docs today:** 438-line README (routes, capabilities, hooks, reconnect/heartbeat) + legacy `platform/content/docs/runtime/v0.9.5|v0.10.0/`.

### `@personaai/adapters` — One Dep, Three Frameworks (`sdk/adapters/README.md:145`)

- **Identity:** `@personaai/adapters@0.3.0`, **one package, 4 exports** (`express`, `nestjs`, `nextjs`, `nextjs/server`). Peer `express>=4`, `next>=14/react>=18`, `@nestjs/*@10\|11`. Deps `runtime^0.11 react^0.10 sdk^0.9 logger^0.1`.
- **Public API:** `adapters/express: toExpressRouter(runtime), createExpressAdapter(opts), TranslationError, toRuntimeRequest, writeRuntimeResponse`. `adapters/nestjs: PersonaModule.forRoot/forRootAsync, PersonaService.forUser(id)`. `adapters/nextjs/server: createPersonaHandler(opts), toNextRouteHandlers`. `adapters/nextjs: PersonaProvider/useChat re-export`. Shared core `src/shared/` not exported.
- **DX:** `npm install @personaai/adapters` → one subpath import per framework (3 quickstarts, 6 LOC each). `resolveUserFrom` replaces `resolveUser` (framework-aware). Migration is import-path change. Express 4 compat in `compat/express4/`.
- **Docs today:** README exports table + 3 quickstarts + legacy `platform/content/docs/adapters/v0.1.0|v0.2.0/`.

### `@personaai/react` — L3 Hooks (`sdk/react/src/index.ts:32`)

- **Identity:** `@personaai/react@0.10.0`, peer `react>=18`, dep `logger^0.1`, side-effect-free. Client-side, never holds credential.
- **Public API:** `PersonaProvider({baseUrl,getAuthToken,defaultAgentId,logLevel})` + 12 hooks: `useChat` (913 LOC), `useArchitectChat`, `useWorkflowStream`, `useWorkflows`, `useWorkflow`, `useWorkflowRuns`, `useVoice`, `useThreads`, `useFiles`, `useMemory`, `useAgents`, `useConnection` (+ `useMcp`, `useMcpConnections`). Utils `streaming.ts:openSSEStream`. Types: `PersonaMessage(roles user/assistant/reasoning/system)`, `PersonaToolCall`, `PersonaInterrupt(hitl/clarification)`, `PersonaWorkspaceFile/Todo/PresentedFile/SandboxCommand`, `PersonaStreamingEvent` union.
- **DX:** `npm install @personaai/react` → wrap `PersonaProvider` → `useChat({agentId,threadId})` → `{messages,input,handleSubmit,isStreaming,interrupt,resumeInterrupt,files,todos,sandboxCommands,voice}`. Ephemeral new-chat (`startNewChat/isEphemeral/currentThreadId/onThreadCreated`) since 0.8.
- **Docs today:** README quickstart + hooks table + legacy `platform/content/docs/react/v0.8.1|v0.9.0/`.

---

## 4. Compare the SDKs

### 4.1 Shared vs Per-SDK (JS-only — Python differences removed)

| Dimension | Shared — ONE concepts page | Per-SDK |
|---|---|---|
| **Credential** | `PERSONA_CREDENTIAL` `<keyId>.<secret>`, `Authorization: Bearer` identical across SDK/Runtime | — |
| **External user** | `externalUserId` / `x-persona-external-user-id` dual-mode (control-plane vs runtime-plane) identical — **concepts/external-users** | — |
| **Domain entities** | `Agent/Skill/Knowledge/Mcp/Provider/Thread/File/Memory/Store/Workflow` shapes mirrored. Pagination `{items,pagination{total,page,limit,pages}}`, `BulkDeleteResult`, `ResourceUsage` identical. | Minor drift: `WorkflowDraft` TS vs `PersonaWorkflowDraft` React (field `position`/`data` subset) |
| **Streaming protocol** | AG-UI SSE `data: JSON\n\n` + `EventType.*` single protocol (TS `@ag-ui/core`, React `streaming.ts`). Shared events `TEXT_MESSAGE_CHUNK/TOOL_CALL_*/REASONING_*/CUSTOM(hitl_request…)/STATE_SNAPSHOT/RUN_ERROR/title`. | Transport: SDK `AsyncGenerator` vs React hook state + `onEvent`. Resume: SDK `threadId+resume` vs Runtime HTTP `GET /chat/:runId/resume?since=seq` + `x-persona-run-id`. |
| **Auth warning** | "Never bundle credential" verbatim across READMEs — shared. | Mounting: Express `app.use(router)` vs NestJS `Module.forRoot` vs Next.js `route.ts createPersonaHandler`. |
| **Errors** | `PersonaApiError/PersonaAuthError/PersonaValidationError` + `{success:false,code,message}` + `429 Retry-After` shared | Runtime `RuntimeHttpError{status,code}` + `errorToResponse(mode development\|production)` different surface |
| **Capabilities** | — | `RuntimeCapabilities` 9 flags **only** runtime/adapters — SDK has no capabilities |
| **Voice** | `POST /voice/sessions → {ticket,wsUrl} → new WebSocket(wsUrl)` shared runtime/react SDK | — |
| **REST/RCP tools** | `defineRestTool` (zod) host-served `GET /rest-tools/manifest` + `GET /rcp/manifest` (`rcp-sdk`) — same idea | — |

**INFERENCE — Structurally consistent:** TS SDK ↔ Runtime ↔ React are *intentionally parallel* (gap audits `product-research/10-developer-platform/03`). Runtime routes 1:1 proxy SDK methods. React hooks 1:1 runtime HTTP (`useChat → POST /chat`). Drift is small (UI dep stale, adapters `src/shared/` not exported).

**FACT — Inconsistencies new docs must handle explicitly:**

1. Runtime `context` vs `contextOverride`: prompt-appended vs never-shown (RCP-only) — needs dedicated `concepts/context-vs-override.mdx`.
2. Ephemeral `threadId: undefined` — React-only concept, SDK always explicit `threadId`.
3. Adapters `src/shared/` not exported — docs must not list as public API.
4. `@personaai/ui` absence: docs must not reference its props; instead link to `shadcn` registry (`/r/chat.json`).

### 4.2 One page vs per-SDK

**Shared (concept/platform layer — version-agnostic):** Credentials & Projects · External Users · Project vs ExternalUser ownership · Pagination/Errors/Idempotency/`whoami()` · AG-UI Event Model · `context` vs `contextOverride` · Workflows mental model

**Per-SDK (code samples, types, mounting):** Installation · Client construction (`PersonaClient` vs `createRuntime` vs `createPersonaHandler`) · Per-resource recipes · Chat streaming consumption · Thread history loading · Capabilities/hooks (runtime only) · Voice transport · Adapters framework tab

---

## 5. Documentation Information Architecture

### Organized by *task/layer + SDK*, with shared concepts as spine

**Why:** New dev's first question is "how do I add chat to my Next.js app in 5 minutes" not "which resource do I call". DX vision (`dx-vision.md:73` — outcome-first) and 4-level ladder (`package-ecosystem.md:144` L1→L4) demand *choose-abstraction-first*, then task, then resource. `platform/content/docs/registry.json` already uses SDK-as-top-level — preserve it.

### Navigation — Greenfield

```
Documentation  (/docs)                               ← landing: 4 cards (SDK / Runtime / Adapters / React)
│
├── Concepts (cross-SDK, version-agnostic)           ← ONE set, linked FROM every versioned SDK page
│   ├── Credentials & Projects
│   ├── External Users (dual-mode rule)
│   ├── Threads & Memory & Stores
│   ├── AG-UI Protocol & Events
│   ├── context vs contextOverride
│   ├── Errors · Pagination · Idempotency
│   └── Workflows mental model
│
├── SDKs (versioned per-package — registry.json driven)
│   ├── @personaai/sdk   v0.9 (latest)               ← fresh build, no legacy v0.7.5 copy
│   │   ├── Overview  (index.mdx)    ← install + auth + hello-agent
│   │   ├── Quickstart               ← one file to first chat
│   │   ├── Guides/  auth · threads · chat-streaming · workflows · logging · rest-tools · voice
│   │   └── Resources/  agents · skills · knowledge · …  (+ Types index — generated)
│   │
│   ├── @personaai/runtime  v0.11 (latest)
│   │   ├── Overview + Quickstart (raw Node handler)
│   │   ├── Guides/  resolve-user · capabilities · hooks · streaming-and-resume · manifests · custom-host
│   │   └── Routes/  core · capabilities  (generated table + handwritten)
│   │
│   ├── @personaai/adapters  v0.3 (latest)
│   │   ├── Quickstart (tabs: Express / Next.js / NestJS)
│   │   ├── Guides/  express · nextjs · nestjs · shared-core · migration-from-legacy-packages
│   │   └── Reference (re-exports per subpath)
│   │
│   └── @personaai/react  v0.10 (latest)
│       ├── Quickstart + Provider
│       ├── Guides/  ephemeral · streaming · voice · workflows · architect
│       ├── Hooks/  useChat · useThreads · useVoice · …  (per-hook MDX)
│       └── Types  (generated)
│
├── Changelogs  (per-package, rendered from sdk/*/CHANGELOG.md)
├── Migration   (per-package breaking notes: sdk 0.2→0.3, adapters legacy packages)
└── API Reference  (alias — points into each SDK's Resources/Hooks/Routes)
```

**Navigation rules:**

- Top toggle is **SDK** (per `getSdks()`) + **Version picker** (existing `VersionPicker` rewrites `/docs/:sdk/vA/… → /docs/:sdk/vB/…` preserving slug). Greenfield starts with **single version per SDK** (the current `package.json:version`); no legacy `v0.7.5` folders carried forward.
- Within SDK, order: **Getting Started → Guides (tasks) → Resources/Hooks/Routes (reference)**. Matches `platform/src/lib/docs/mdx.ts:212` `folderOrder ["routes","guides","resources","hooks"]` + `quickstart` pinned second.
- **Concepts** is *outside* version folders (`content/concepts/`). Every versioned page links `See [External Users](/concepts/external-users)`.
- Search scopes to current SDK+version by default, toggle "all docs".
- No `python`/`logger`/`ui` entries in registry for greenfield.

---

## 6. Repository Architecture — Where Docs Live

### Decision: **Hybrid — but dedicated-host, greenfield**

**Chosen:** **Dedicated docs site host is `platform/`** (approved infra), **source authoring lives next to SDK code**, **published immutable snapshots are the single rendering truth**.

**Rejected alternatives:**

| Option | Why rejected |
|---|---|
| **A — Docs inside each SDK only** (`sdk/typescript/docs/` served directly) | Fragments IA — no single site renders `DocsSidebar` across 4 SDKs. Shared concepts (`concepts/external-users`) would be duplicated. Platform deploy would `cp` from 4 locations with no version registry. |
| **B — One central docs repo only** (pure `platform/content/docs/` authoring, no `sdk/*/docs/`) | Decouples docs from code — PR adding `knowledge.search({topK})` can merge without updating docs because docs live elsewhere. History drift guaranteed (current legacy's exact failure mode — docs lag packages by 1 minor). |
| **C — Separate GitHub repo for docs** | Would lose `check-docs-coverage` file-local check (needs `src/index.ts` + docs in same commit) and double deploy pipeline for 4-package ecosystem. Overkill at this scale. |

### Chosen: Hybrid (lean JS-only)

```
agent-marketplace/
├── sdk/
│   ├── typescript/
│   │   ├── src/
│   │   ├── docs/                   # NEW: source MDX (guides/*.mdx — authored alongside src/)
│   │   ├── typedoc.json            # NEW: TypeDoc config
│   │   └── CHANGELOG.md
│   ├── runtime/
│   │   ├── src/
│   │   ├── docs/                   # NEW
│   │   └── typedoc.json            # NEW
│   ├── adapters/
│   │   ├── src/
│   │   ├── docs/                   # NEW
│   │   └── typedoc.json            # NEW
│   ├── react/
│   │   ├── src/
│   │   ├── docs/                   # NEW
│   │   └── typedoc.json            # NEW
│   ├── python/                     # OUT-OF-SCOPE (no docs/)
│   ├── logger/                     # OUT-OF-SCOPE
│   ├── ui/                         # OUT-OF-SCOPE (shadcn registry replaces)
│   └── devtools/                   # OUT-OF-SCOPE
├── platform/
│   ├── content/
│   │   ├── concepts/               # NEW: credentials, external-users, ag-ui, context-*.mdx
│   │   ├── migration/              # NEW: breaking migrations (markdown, not per-version)
│   │   ├── changelogs/             # GENERATED: rendered CHANGELOG.md per SDK
│   │   └── docs/                   # PUBLISHED, IMMUTABLE snapshots (what registry.json points to)
│   │       ├── registry.json        # owns latest pointer — greenfield: 4 entries only
│   │       ├── _tracking.json       # build history
│   │       ├── sdk/v0.9.0/…        # fresh build from sdk/typescript/docs + generated types
│   │       ├── runtime/v0.11.0/…
│   │       ├── adapters/v0.3.0/…
│   │       └── react/v0.10.0/…     # single latest per SDK at greenfield boot
│   ├── src/lib/docs/               # Consumers (adapted to docs/ path)
│   └── scripts/
│       ├── snapshot-docs.mjs       # NEW: sdk/X/docs → platform/content/docs/X/vNEW
│       ├── typedoc-to-mdx.mjs      # NEW: typedoc JSON → platform/content/docs/X/resources/generated
│       └── build-search.mjs        # NEW
├── agent-backend/docs/             # Internal backend docs (keep, not SDK surface)
├── docs/                           # NOT USED — platform/content/docs is the one truth (avoid second docs root)
└── examples/agent-chat/            # reusable Next.js example referenced by adapters/runtime guides
```

**How it works:**

- Authoring: contributor edits `sdk/typescript/docs/guides/chat.mdx` in same PR as `sdk/typescript/src/chat/chat-client.ts`. `sdk/typescript/docs/` is the *source*.
- Publishing: `scripts/snapshot-docs.mjs sdk-typescript --to v0.9.0` copies source + runs `typedoc-to-mdx` into `platform/content/docs/sdk/v0.9.0/`. That folder is **committed and immutable** — what the site renders. No per-request stitching.
- Concepts (`platform/content/concepts/`) live outside version folders, not per-SDK, consumed alongside versioned docs.
- **Why this survives growth to 6 SDKs:** Adding `sdk/fastify/docs/` is one new source folder + one registry row — no site restructure.

### Fresh vs legacy on disk

- Legacy `platform/content/docs/sdk/v0.7.5`, `v0.8.0`, etc. are **not** copied into new system. Greenfield starts at **single `v{current-package-version}` per SDK** (0.9, 0.11, 0.3, 0.10). Old versions are accessible only via Git history until first minor bump after greenfield, where the snapshot process naturally creates `v0.9.0 → v0.10.0` archives going forward.

---

## 7. Versioning Strategy

### Greenfield baseline

- Old `platform/content/docs/**` versions are discarded (legacy). New registry starts at `latest = current package.json:version` with **single entry** per SDK:
  ```json
  { "sdks": [
    { "id":"sdk",      "title":"@personaai/sdk",      "latest":"0.9.0", "versions":["0.9.0"] },
    { "id":"runtime",  "title":"@personaai/runtime",  "latest":"0.11.0","versions":["0.11.0"] },
    { "id":"adapters", "title":"@personaai/adapters", "latest":"0.3.0", "versions":["0.3.0"] },
    { "id":"react",    "title":"@personaai/react",    "latest":"0.10.0","versions":["0.10.0"] }
  ]}
  ```

### Policy (RECOMMENDATION)

| Question | Answer | Why |
|---|---|---|
| **Every patch → new docs?** | **No.** | Patches have zero docs-affecting change (see CHANGELOGs). Patch → reuse docs of its `minor` folder + changelog entry. |
| **Granularity** | **Per `minor` (0.minor) until 1.0; per `major` after 1.0.** Breaking `0.x` → new `v0.minor` folder. Never per-patch. | Matches CHANGELOGs: only `0.2.0` was breaking; rest additive. Mirrors Stripe/Supabase 0.x pattern. |
| **Breaking release** | **Keep old `v{prev-minor}/` forever** (immutable). Copy to `v{new-minor}/`, add migration at `content/migration/`, update `registry.json latest`, banner on old version. Old URLs never 404. | No link rot for tutorials pinned to `v0.9.0`. |
| **Old docs accessible** | Via `VersionPicker` + `/docs/:sdk` → `latest` redirect (existing). `rel=canonical` to latest. | |
| **Identify latest** | `registry.json:latest` is SOOT. Build-validated (`latest ∈ versions`). Displayed as Badge. | |
| **Docs ↔ npm mapping** | **Exact:** `docs vX.Y.Z` ↔ `npm @personaai/pkg@X.Y.Z` (header "Documents @personaai/sdk 0.9.0"). Patch `0.9.1` stays at `v0.9` but changelog notes "also applies to 0.9.1". | |
| **Git tags** | `sdk/<name>/v<version>` and `docs/<sdk>/v<version>` tags atomically on publish. | |
| **Deprecated versions** | Old adapters `v0.1`/`v0.2` docs remain readable (but greenfield has no `v0.1`/`v0.2` — they exist only in Git history of legacy). | |

---

## 8. Source of Truth

| Information | **Source of truth** | Generated or manual? | Anti-drift |
|---|---|---|---|
| **API methods (list)** | `src/<pkg>/index.ts` + `src/resources/*.ts` (4 pkgs) | **Generated** — TypeDoc index | Extend `check-docs-coverage.mjs` to 4 pkgs + CI |
| **Types / interfaces / fields** | `src/types/*.ts` | **Generated** — TypeDoc + JSDoc | CI fails if `types` gap |
| **Install command + version** | `package.json:version` — template-injects into MDX header | **Generated** (header banner) | Build injects `v{version}` into `index.mdx` frontmatter |
| **Quickstart wiring** | Hand-written `quickstart.mdx` per SDK | **Manual** — code-checked | MDX `code` blocks linted (`tsc --noEmit` on fenced `ts`) |
| **Tutorials / concepts** | Hand-written (`content/concepts/` + `content/docs/{sdk}/v{ver}/guides/*.mdx`) | **Manual** | SDK maintainer owns |
| **Examples (>10 lines)** | `sdk/{pkg}/examples/` or embedded snippet | **Manual** but **tested** via `tsc --noEmit` | Extract as real `*.ts` under `examples/` |
| **Auth flow** | `platform/content/concepts/` single page | **Manual** | Platform docs owner |
| **Backend API endpoints** | SDK resource method is contract, not backend `@openapi`. Don't duplicate backend OpenAPI. | **SDK is truth** | `test/resources/*.test.ts` assert request paths |
| **Changelog** | `sdk/{pkg}/CHANGELOG.md` — render into docs | **Manual entry, generated rendering** | `scripts/sync-changelog.mjs` copies MD |
| **Version / latest** | `platform/content/docs/registry.json:latest` | **Manual edit** (part of release) | CI: `latest ∈ versions`, `latest` matches `package.json` up to minor |
| **Migration guides** | `content/migration/{sdk}/from-to.mdx` | **Manual** | Required for breaking PR (label+CI) |

**Principle:** Never maintain same fact in two places. If `src/types/agent.ts:22` says `webSearchEnabled: boolean`, `resources/agents.mdx` Agent table is *rendered* from JSDoc, not re-typed.

---

## 9. Documentation Generation

| Tool | Fits? | Problem it solves | Recommendation |
|---|---|---|---|
| **TypeDoc** (`typedoc`) | **Yes — STRONG FIT for 4 JS packages** | Generates per-type/field/method pages from existing JSDoc on `types/*.ts`/`resources/*.ts`. Prevents 19 manual type tables drifting. | **Adopt for sdk/runtime/react/adapters ONLY.** Emit JSON and render via `Streamdown` inside `platform` — not TypeDoc HTML. One `typedoc --json dist/typedoc.json` per package. **Exclude `logger` (internal) and `ui` (deprecated).** |
| **TSDoc/JSDoc** | Already in use — TypeDoc reads it. | Already solved. | Keep as-is; TypeDoc consumes it. Add `eslint-plugin-jsdoc`. |
| **OpenAPI** | **No for SDK docs.** | Backend generates `openapi.json`, but SDK docs document SDK methods, not raw routes. Two competing refs drift. | Do **not** feed backend `openapi.json` into SDK platform. Keep backend OpenAPI internal. |
| **Generated examples runner** | **Partial** | Verify code blocks compile. | Add `scripts/check-mdx-code.mjs` (extract ````ts` → `tsc --noEmit`). |
| **Storybook** | **Not for docs site** | `@personaai/ui` deprecated — `shadcn` registry gallery replaces it. | Skip. If `ui` needed, reuse `platform/src/components` gallery against mock runtime. |

---

## 10. Documentation Website Architecture

### Retained infra (FACT — approved)

- `platform/` Next.js 16.3 + `gray-matter` + `Streamdown` + `remarkGfm` + `@streamdown/code` + `shiki 3`
- `content/docs/{sdk}/v{version}/` (after greenfield: `platform/content/docs/` with 4 SDKs) + `src/lib/docs/mdx.ts:37` `listDocs/readDoc/getDocsNavigation` + `src/lib/docs/registry.ts:10` `resolveVersion` + `components/docs/version-picker.tsx:1`
- `docs/[sdk]/[version]/[...slug]` with `DocsSidebar`/`DocsBreadcrumbs`/`DocsPager`/`DocsRenderer`
- Deploy Vercel (`vercel.json` + `outputFileTracingIncludes: content/docs/**`)

### Evaluation vs alternatives

| Framework | Pros | Cons | Verdict |
|---|---|---|---|
| **Docusaurus 3** | Versioned docs first-class, search, i18n. | Must move out of `platform/` (has 40-page custom impl + `projects/[projectId]` dashboard). Two Next.js apps double ops. Less control to embed `PersonaChatView` live example. | **Not recommended** — would fragment the platform. |
| **Mintlify** | Gorgeous out-of-box, LLM-friendly. | Proprietary, hosting off-infra. No advantage over existing file-system routing. | **Not recommended** — vendor lock-in. |
| **Custom Next.js (current `platform/`)** | **Already built, version-aware, approved.** Tightest integration with `registry.json`, `VersionPicker`, `shadcn` registry, `PersonaProvider` playground. Full control to render TypeDoc JSON, search via `pagefind`/`flexsearch`. Zero migration framework-wise — only content is rebuilt. | Search homegrown (needs impl). Must build API-reference rendering. | **RECOMMENDED — keep and harden `platform/`.** |

**How pieces work in greenfield:**

- **Consumes Markdown:** `fs.readFileSync` + `gray-matter` + `Streamdown` (today). Add step: pre-build TypeDoc JSON → `content/docs/{sdk}/v{ver}/resources/*.generated.mdx` fragments (not overwriting hand-written guides). Greenfield content is *only* 4 SDKs.
- **Versioning:** Per §7 — single `v{current}` per SDK at boot, then immutable `v{prev}` copies on minor bumps. `registry.json` holds only `["0.9.0"]` at boot, grows on bumps. `VersionPicker` works unchanged.
- **API reference:** `TypeDoc --json → typedoc.json → scripts/typedoc-to-mdx.mjs → content/docs/{sdk}/v{ver}/resources/*.generated.mdx`. Generated MDX committed into snapshot so Git diff shows changes. Hand-written prose in adjacent `guides/*.mdx`.
- **Search:** `flexsearch`/`pagefind` client index built at `platform build` over `listDocs()` content (`scripts/build-search.mjs`). Don't use Algolia pre-1.0.
- **Deployment:** `platform/` via Vercel. Whole site prerendered (`generateStaticParams` enumerates `listDocs`). Keep `outputFileTracingIncludes: content/docs/**`.

---

## 11. CI/CD and Release Workflow

### Today's pipeline (FACT)

- `.github/workflows/test.yml` matrix: 4 dirs (`typescript`, `runtime`, `adapters/express`, `python`) → `pnpm install → typecheck → lint → test`. Missing: `react` (and `adapters` `nestjs`/`nextjs` fully); `python` will be removed for greenfield.
- No release step — `npm publish` manual.
- No docs-build CI.

### Greenfield end-to-end (RECOMMENDATION — JS-only)

```
SDK change (sdk/{pkg}/src/**  where pkg ∈ {typescript,runtime,adapters,react})
  │
  ├─► PR open
  │   ├─ CI: install→typecheck→lint→test for THAT pkg (matrix, fail-fast:false)
  │   │   └─ NEW matrix: typescript, runtime, adapters, react  (python removed)
  │   ├─ CI: docs validation
  │   │   ├─ check-docs-coverage.mjs (extend to 4 pkgs: assert src/index.ts exports in sdk/{pkg}/docs coverage index)
  │   │   ├─ typedoc.json dry-run (fails if TypeDoc broken — 4 pkgs only)
  │   │   └─ mdx-code check (extract ```ts → tsc --noEmit)
  │   ├─ CI: dead-link check (lychee on changed MDX)
  │   └─ Human review: code owner + docs owner (same person per SDK)
  │
  ├─► Merge to feat/ai (eventual main)
  │
  ├─► Release (separate, deliberate — maintainer triggered)
  │   ├─ scripts/bump-version.mjs pkg [patch|minor|major]
  │   │   └─ updates sdk/{pkg}/package.json:version, CHANGELOG.md, registry.json:versions
  │   ├─ IF minor|major: pnpm --dir platform docs:snapshot --sdk {pkg} --from {oldMinor} --to {newMinor}
  │   │   └─ copies sdk/{pkg}/docs/ + runs typedoc-to-mdx → platform/content/docs/{pkg}/v{newMinor}/
  │   ├─ Build + publish: pnpm --dir sdk/{pkg} build && npm publish  (MUST NOT be CI-automatic)
  │   ├─ Tag: git tag sdk/{pkg}/v{newVer} && git push origin tag
  │   ├─ Commit docs snapshot: git tag docs/{pkg}/v{newVer}
  │   └─ Deploy docs: pnpm --dir platform build → deploy (Vercel)
  │       └─ previous v{old} docs stay live, old URLs keep 200
  │
  └─► Post-release
      ├─ Dead-link + version-consistency CI (weekly cron: latest === package.json:version for 4 pkgs)
      └─ Search index rebuild on deploy
```

**Automated vs human:**

| Step | Automated | Human gate? |
|---|---|---|
| typecheck/lint/test/docs-coverage on PR | Automated (must be green) | — |
| Code + adjacent `sdk/{pkg}/docs/*.mdx` update | Manual in PR, checked by reviewer | **Human** (SDK owner) |
| `check-docs-coverage` | Automated (fails PR if export missing) | — |
| MDX code-compiles | Automated | — |
| Merge → `feat/ai` | Manual (`/approve` or CODEOWNERS) | **Human** |
| Release (bump + npm publish + git tag) | Script-assisted, **manually triggered** `gh workflow dispatch release --sdk X --level minor` | **Human** |
| Snapshot docs (`vPrev`→`vNew`) | Script `snapshot-docs.mjs`, **committed + reviewed** as PR (not auto-push) | **Human** |
| Deploy platform docs | Automated on push to `platform/content/docs/**` (Vercel webhook) | — |

**Concrete `.github/workflows/test.yml` greenfield diff:**

```yaml
matrix:
  include:
    - { dir: typescript, toolchain: node }   # @personaai/sdk
    - { dir: runtime,     toolchain: node }   # @personaai/runtime
    - { dir: adapters,    toolchain: node }   # @personaai/adapters (covers express/nestjs/nextjs)
    - { dir: react,       toolchain: node }   # @personaai/react — NEW (was missing)
    # python removed (old, out-of-scope)
    # logger/devtools/ui removed (internal/deprecated, no CI)
```

---

## 12. Documentation Quality

| Area | Rule | How it's tested automatically |
|---|---|---|
| **Broken links** | Every internal `href` must resolve to `listDocs(sdk,ver)` entry + every external link must 200. | CI `lychee --offline` or `markdown-link-check` over `content/docs/**`. Weekly cron for externals. |
| **Outdated examples** | ````ts` blocks must compile under SDK's `tsconfig.json`; import paths shown must exist in that version's `exports`. | `scripts/check-mdx-code.mjs` (extract fenced `ts` → temp `*.ts` → `tsc --noEmit`; fail PR). |
| **API changes (surface)** | `src/index.ts` `export {…}` set is authoritative — docs `Full export index` table must list every exported symbol. | Extend `check-docs-coverage` to 4 pkgs — fails PR if export missing. |
| **Version mismatches** | `registry.json:latest` must equal `sdk/X/package.json:version` up to `minor`. Peer deps in install snippet must match `package.json:peerDependencies`. | CI `check-version-consistency.mjs` fails if `latest` drifts >1 minor; `check-peer-deps.mjs` asserts MDX install block's peers. |
| **Code example realism** | Every `quickstart` snippet copy-paste runnable given prereqs from same page (no missing `getCurrentUserId` undefined). `resolveUser` shows real Clerk/JWT, not stub. | PR template checkbox; `examples/agent-chat` e2e smoke covers Next.js path. |
| **Terminology** | Single glossary (`content/concepts/glossary.mdx`): `Project` (not Workspace), `Credential` (not Token/Secret for auth), `externalUserId` (not userId/sub), `Thread` (not Chat/Session), `Agent` (not Bot), `Skill` (not Tool-pack), `Store` (not VectorStore), `MCP`, `AG-UI`. | `scripts/lint-terms.mjs` regex warns on banned synonyms (non-blocking). |
| **Naming** | Export names TitleCase for types, camelCase for values — MDX tables must reflect actual casing. Install names exact (`@personaai/adapters` not `@personaai/adapter`). | Covered by `check-docs-coverage` + `check-mdx-code`. |
| **Deprecations** | Any deprecated symbol gets `@deprecated` JSDoc + docs yellow callout "Use `Y` since v0.9 — removed in v0.10" + link to `migration/{sdk}/0.9→0.10.mdx`. | CI: fail if symbol `flags.isDeprecated` but docs page lacks callout. |
| **Migration guides** | Required for every breaking minor. Lives at `content/migration/{sdk}/vA→vB.mdx`. Breaking PR label `semver:breaking` blocks merge unless migration file exists. | GitHub label check in CI. |

**Observability beyond lint:** Weekly 404 analytics, zero-result search queries, quickstart abandonment; build-time stale check (package bump but `registry.json:latest` not within 7 days → Slack warning).

---

## 13. Industry Comparison

> Not blind copy — pattern borrowed only where it applies to JS-only, layered, per-package-versioned ecosystem.

| Pattern | Useful pattern | Why it applies / why not to THIS repo |
|---|---|---|
| **Stripe — Language-tabs + per-resource reference + Changelog per version** | Task-first IA: Stripe home is "Accept payments" (task), not "CreateCharge". `▶︎ Node ▶︎ Python` tab persists (greenfield: no Python tab — just `JS/TS`). Changelog per API version (`v2023-10`). | **Apply:** Ladder (L1 raw vs L2 mounted vs L3 hooks) is "choose abstraction first, then resource." Persistent version tab mirrors Stripe. Per-minor versioning (`v0.9 → v0.10`) mirrors `v2023-10`. |
| **Supabase — Product-routed, one site for `auth/database/storage`, each versioned separately** | Separate version registry per product but single docs site. | **Apply directly:** `registry.json:{sdks:[sdk,runtime,adapters,react]}` (4 entries now) is Supabase-shaped. Keep it; don't collapse to monolithic "Persona SDKs v0.9". |
| **Clerk — Framework recipes as first-class** | Left nav groups by *framework* (`Next.js Quickstart`, `Express Quickstart`) above API ref, because *where you call* determines what to show. | **Apply:** `adapters/quickstart.mdx` already does this — keep. TS SDK's `Framework recipes` (README:222) deserves top-level guide per framework — Clerk's lesson. |
| **OpenAI — TS ref generated from OpenAPI** | Generated ref reduces drift. | **Do NOT apply:** SDK is hand-written thin wrappers, not codegen from OpenAPI. Would entangle frontend release with backend and lose `externalUserId` ergonomic. Use TypeDoc (source is SDK), not OpenAPI-gen. |
| **Algolia/Tailwind — Interactive component gallery** | Users flip props and see result inline. | **Not needed for greenfield:** `@personaai/ui` deprecated — `shadcn` registry gallery replaces it. If needed, reuse `platform/src/components` gallery against mock runtime. |
| **MUI/shadcn — Registry-based distribution** | Already built (`platform` `shadcn add https://platform…/r/chat.json`). Docs show CLI per-component. | **Keep:** Align `@personaai/ui` removal notice with `platform/registry.json` canonical command. Docs must link to registry, not bundle install. |
| **Docsy/Kubernetes — Concepts/Tasks/Reference split** | Docsy: *Concepts* (explain what), *Tasks* (how to), *Reference* (exhaustive spec). | **Apply:** Map to `Concepts (concepts/)` / `Guides+Quickstart (Tasks)` / `Resources/Hooks/Routes (Reference)`. Add Diátaxis badge "Tutorial"/"Concept"/"Reference" on header. |
| **Hosting — Mintlify/Docusaurus vs custom** | Mintlify/Docusaurus buy ops outsource + theme. | **Why custom wins:** `platform` IS the dashboard + playground + shadcn registry. No external framework supports embedding live credential-handshake flow (`createRuntime` with opaque `resolveUser`). |

**Bottom line:** This repo's docs architecture is already ~80% of what Supabase/Stripe/Clerk recommend (layered, per-product versioned, task-first). Greenfield scope to JS-only makes it even leaner.

---

## 14. Final Recommendation

### A. Recommended architecture (one-line)

**Keep `platform/` as single versioned docs site host (approved infra); generate per-package reference from TypeDoc into `platform/content/docs/{sdk}/v{ver}/` snapshots; shared concepts in `platform/content/concepts/`; source authoring alongside SDK code at `sdk/{pkg}/docs/`. Legacy `platform/content/docs/**` is discarded greenfield — not migrated.**

### B. Recommended documentation website

- **Stack:** Keep `platform/` Next.js App Router (16.3) + `Streamdown`/`shiki`/`gray-matter`. Add TypeDoc JSON → generated API MDX, `flexsearch`/`pagefind`, `registry.json` (4 entries).
- **Not Docusaurus/Mintlify/custom greenfield framework** (see §13).
- Platform *is* the right host — SDK value prop ("Create Agent → install") links dashboard action to docs code.

### C. Recommended repository structure (greenfield, JS-only)

```
agent-marketplace/
├── sdk/
│   ├── typescript/{src, docs/guides/*.mdx, typedoc.json, CHANGELOG.md}   # YES
│   ├── runtime/{src, docs/guides/*.mdx, typedoc.json, CHANGELOG.md}      # YES
│   ├── adapters/{src, docs/guides/*.mdx, typedoc.json, CHANGELOG.md}     # YES
│   ├── react/{src, docs/guides/*.mdx, typedoc.json, CHANGELOG.md}        # YES
│   ├── python/                     # NO DOCS (old, out-of-scope)
│   ├── logger/                     # NO DOCS (internal)
│   ├── ui/                         # NO DOCS (deprecated → shadcn registry)
│   └── devtools/                   # NO DOCS (internal)
├── platform/
│   ├── content/
│   │   ├── concepts/               # credentials, external-users, ag-ui, context-*.mdx
│   │   ├── migration/{sdk}/        # breaking migrations
│   │   ├── changelogs/             # GENERATED from sdk/*/CHANGELOG.md
│   │   └── docs/                   # PUBLISHED, IMMUTABLE snapshots — GREENFIELD
│   │       ├── registry.json        # 4 entries: sdk 0.9.0, runtime 0.11.0, adapters 0.3.0, react 0.10.0
│   │       ├── _tracking.json
│   │       ├── sdk/v0.9.0/…
│   │       ├── runtime/v0.11.0/…
│   │       ├── adapters/v0.3.0/…
│   │       └── react/v0.10.0/…     # single latest per SDK at boot
│   ├── src/lib/docs/               # Consumers (adapted to docs/ path)
│   └── scripts/{snapshot-docs,typedoc-to-mdx,build-search,check-*}
├── agent-backend/docs/             # Internal backend docs (keep)
└── examples/agent-chat/            # reusable example referenced by guides
```

### D. Recommended Markdown structure

**Per SDK version** `platform/content/docs/{sdk}/v{ver}/`:

```
index.mdx             # overview (title: "@personaai/sdk 0.9.0") + install card
quickstart.mdx        # ONE copy-paste file to first streaming chat
guides/
  auth.mdx · threads.mdx · chat-streaming.mdx · workflows.mdx · logging.mdx · rest-tools.mdx · voice.mdx
  framework-express|nestjs|nextjs.mdx (TS SDK only)
resources/
  agents.mdx  # generated field table (from TypeDoc) + 5-line intro
  skills.mdx · knowledge.mdx · ...  each one
types.mdx             # Full export index (generated)
migration/            # link to content/migration/sdk/v0.9→v0.10.mdx
changelog.mdx         # rendered CHANGELOG.md slice (via sync script)
```

Hand-written prose on top (≤50 lines before generated table), generated table below — contributor never edits table.

### E. Recommended versioning strategy

- **Granularity:** per **minor** until 1.0 (`v0.9.0` covers all `0.9.x` patches). Per **major** after 1.0.
- **Patch:** no new folder — reuse minor docs; changelog notes patch.
- **Breaking `0.x`:** new `v{newMinor}/` is copy+surgery of `v{prev}`; old folder frozen.
- **Registry:** `platform/content/docs/registry.json` 4 entries, `latest` must equal shipped `package.json:version`. Single version at greenfield boot.
- **Routes:** `/docs/:sdk/v:ver/:slug…` (existing). `/docs/:sdk` → `latest`. Old URLs never 404 (after greenfield, old legacy URLs are 404 intentionally — legacy deleted).
- **Git:** tags `sdk/{name}/v{semver}` + `docs/{name}/v{semver}` atomically on publish.

### F. Recommended API-reference strategy

- **JS 4 pkgs (sdk/runtime/react/adapters):** `TypeDoc 0.27` with `typedocOptions: {entryPoints:["src/index.ts"], json:"dist/typedoc.json"}` per pkg. `scripts/typedoc-to-mdx.mjs` renders `typedoc.json.children[]` → `platform/content/docs/{pkg}/v{ver}/resources/*.generated.mdx` + `types.mdx`. Custom `<TypeSignature>` MDX component reads JSON at build-time — not separate TypeDoc HTML.
- **No TypeDoc for `logger`/`ui`/`python`/`devtools`** — per directive.
- **No OpenAPI ingestion** for SDK reference (keep backend OpenAPI internal).
- **Header:** Every generated table carries "Generated from `src/types/agent.ts:22` — do not edit."

### G. Recommended CI/CD workflow

- PR → matrix install (4 pkgs) → typecheck+lint+test → docs: `check-docs-coverage` (4 pkgs) + `typedoc dry-run` + `mdx-code` + `lychee`
- Merge → Release (manual `gh workflow dispatch release --sdk X --level minor`): bump + `snapshot-docs.mjs` → new `platform/content/docs/{pkg}/v{new}` → `npm publish` → `git tag` → platform deploy (Vercel)
- Post: nightly cron dead-link + version-consistency + 404 analytics

### H. Recommended release workflow

Release is **intentional, not CI-automatic** (matches README "publishing is not part of CI"). Tag `sdk/{pkg}/vX.Y.Z` is proof. Content snapshot `docs/{pkg}/vX.Y` is reviewed like code — not silent copy. Patch-only skips `snapshot-docs`.

### I. Recommended documentation ownership model

| Docs layer | Owner | Review |
|---|---|---|
| `sdk/{pkg}/docs/guides/*.mdx` (tasks) | **Package maintainer** | `CODEOWNERS: sdk/typescript/docs/ @sdk-maintainer` must approve |
| `platform/content/concepts/*.mdx` (shared) | **Platform / DX team** | `platform/docs` owner |
| Generated `platform/content/docs/{pkg}/v{ver}/resources/*.generated.mdx` | **Bot** (`typedoc-to-mdx`) — no hand edit | CI regenerates and diffs — human-approved only on `snapshot` PR |
| `platform/src/{app,components,lib}/docs/*` (rendering) | **Platform frontend** | Front platform owner |
| `content/migration/{pkg}/` | **Breaking-PR author** | `semver:breaking` label + CI check |
| Changelogs rendering (`content/changelogs/`) | Package maintainer (writes) → bot (renders) | PR template checklist |

### J. Migration path — reused (see §15)

---

## 15. Migration — Legacy Deletion & Greenfield Boot

> **Gating:** This section executes **ONLY after this plan (v2) is approved**. Until then, legacy `platform/content/docs/**` stays untouched and new system is scaffolded alongside it.

### Step 0 — Approve (0.5d) — **GATE**

Approve this plan v2 (especially §6 repo structure, §7 versioning, §10 website). No files deleted before this.

### Step 1 — Scaffold greenfield alongside legacy (3–4d) — **START NOW**

- Create `sdk/{typescript,runtime,adapters,react}/docs/` source folders with stub `guides/index.mdx` + `typedoc.json` (4 configs).
- Create `sdk/{pkg}/typedoc.json`:
  ```json
  { "entryPoints": ["src/index.ts"], "out": "dist/docs", "json": "dist/typedoc.json",
    "excludePrivate": true, "excludeInternal": true, "readme": "none" }
  ```
  Adapters: `entryPoints: ["src/express/index.ts","src/nestjs/index.ts","src/nextjs/server.ts","src/nextjs/client.ts"]`.
- Create `platform/scripts/snapshot-docs.mjs` (copy source MDX + `typedoc-to-mdx`):
  - Copies `sdk/{pkg}/docs/guides/*.mdx` → `platform/content/docs-v2/{pkg}/v{ver}/guides/`
  - Runs `typedoc --json` per pkg → `typedoc-to-mdx.mjs` → `platform/content/docs-v2/{pkg}/v{ver}/resources/*.generated.mdx` + `types.mdx`
  - Updates `platform/content/docs-v2/registry.json` (4 entries) + `_tracking.json`
- Extend CI: add `react` to matrix, remove `python`, add `typedoc dry-run`, add `check-docs-coverage` for 4 pkgs.
- **Output:** `platform/content/docs-v2/` is the greenfield site content, runnable via `pnpm --dir platform dev` with adapted `src/lib/docs/mdx.ts` path. Legacy `platform/content/docs/` still serves the old site — no deletion yet.

### Step 2 — Legacy deletion (on approval, 0.5d)

- One commit:
  ```bash
  git rm -r platform/content/docs/sdk/v0.7.5 platform/content/docs/sdk/v0.8.0 \
            platform/content/docs/runtime/v0.9.5 platform/content/docs/runtime/v0.10.0 \
            platform/content/docs/adapters/v0.1.0 platform/content/docs/adapters/v0.2.0 \
            platform/content/docs/react/v0.8.1 platform/content/docs/react/v0.9.0
  # (keep folder structure, delete only version contents)
  git mv platform/content/docs-v2 platform/content/docs
  # update platform/src/lib/docs/mdx.ts DOCS_BASE if path changed
  git rm sdk/typescript/scripts/check-docs-coverage.mjs   # replaced by new multi-pkg version
  ```
- Rewrite `platform/content/docs/registry.json` to greenfield 4-entry version (see §7).
- Mark old Git history as legacy: tag `archive/legacy-docs-v1` before deletion for archaeology.

### Step 3 — Seed greenfield content (3–5d)

- Author `platform/content/concepts/{credentials,external-users,threads,ag-ui,context-vs-override,errors,workflows}.mdx` (fresh, not copied from legacy — use legacy as style ref only).
- Author `sdk/{pkg}/docs/guides/*.mdx` sources (the hand-written Guides). Then `snapshot-docs.mjs` to publish into `platform/content/docs/{pkg}/v{ver}/`.
- Seed each `index.mdx` + `quickstart.mdx` + `resources/` generated tables (TypeDoc).
- Wire `platform/src/lib/docs/mdx.ts` `DOCS_BASE` to `content/docs` (post-rename).
- Result: `platform/content/docs/` now has exactly 4 SDKs × 1 version each (`sdk 0.9.0`, `runtime 0.11.0`, `adapters 0.3.0`, `react 0.10.0`).

### Step 4 — Harden & release (1–2d)

- Enable search (`pagefind`/`flexsearch` via `build-search.mjs`), link+term lints, branch protection `docs-coverage must be green`, `check-version-consistency.mjs`.
- Document release workflow (`docs/RELEASE.md`).
- First `npm publish` that bumps a greenfield SDK also demonstrates the snapshot flow (`v0.9.0 → v0.10.0` creates `v0.10.0` folder, keeps `v0.9.0`).

*~8–12 engineer-days, 3 PRs (scaffold → legacy delete → content seed + harden). No docs downtime — legacy serves until Step 2.*

---

## 16. Self-Challenge Pass

| Question | Answer | Why it survives |
|---|---|---|
| **4 SDKs → 6 SKDs?** | **Yes.** `sdk/golang/docs/` appears, `registry.json` gains `{id:"golang"}`, sidebar adds card. No IA restructure — per-product versioning is horizontal. `listDocs` folder-driven, not hardcoded. | Hybrid source `sdk/{pkg}/docs/` is already ready. Risk: CI matrix must read `registry.json` — don't hardcode 4. |
| **SDK v2 breaking?** | **Yes.** `v0.10 → v0.11` copy, old folder immutable, banner on old version, migration guide at `content/migration/`. | No link rot for tutorials pinned to `v0.9.0` (greenfield's first version). |
| **Old user on old docs?** | **Yes.** Old `vX` stays live at `/docs/sdk/vX/…` after greenfield (first old version is greenfield's boot version). Version picker slug-preserving. | Legacy versions intentionally not carried forward — first greenfield version is the only old version initially, which is also latest. So correctness is trivial at boot. |
| **Docs drift from code?** | **Mitigated.** TypeDoc JSON generated from `src/types/*.ts` JSDoc at snapshot — changing `Agent.webSearchEnabled` without docs produces dirty generated diff that PR review catches, and `check-docs-coverage` fails CI. Remaining hole: *prose* drift; reviewer is safety net. | JS-only scope reduces drift surface (19 type files × 4 pkgs). |
| **Over-engineering?** | **No — trimmed.** Dropped: `python`/`logger`/`ui`/`devtools` TypeDocs, Docusaurus/Mintlify, OpenAPI ingestion, Storybook, per-patch folders. Kept: *thin* TypeDoc JSON rendering (≤300-line scripts), one `registry.json`, MDX code-compile check (100-line). | Greenfield with 4 SDKs is leaner than v1's 8-SDK plan. |
| **Why not bring legacy content forward?** | **Intentional.** Legacy trails packages by 1 minor (stale), includes `python`/`ui` that are out-of-scope, and was hand-copied per version (no generation). Rebuilding from SDK READMEs + JSDoc + fresh Guides guarantees `latest` matches `package.json:version` on day one. | Style (frontmatter, `index→quickstart→guides→resources` order) is reused, not content. |

**If over-engineering crept in:** the thin `typedoc-to-mdx.mjs` rendering is the only not-yet-proven piece — keep its first iteration as a single generated `types.mdx` per SDK, not per-field pages. Expand only when search analytics shows users land on type pages.

---

## 17. Appendix — Evidence Index

| Claim | File |
|---|---|
| 8 packages in `sdk/` | `read sdk/` directory + `AGENTS.md:116` |
| JS-only scope (no python/logger/ui) | Directive in user message 2026-09-15 (python old, logger internal, ui deprecated → shadcn) |
| `ui` deprecated → shadcn | `platform/README.md:15` `npx shadcn add https://platform…/r/chat.json`, `platform/registry.json:1` |
| No root workspace | `AGENTS.md:146` |
| Versions JS 4 pkgs | `sdk/typescript/package.json:3 0.9.0`, `runtime/package.json:3 0.11.0`, `adapters/package.json:3 0.3.0`, `react/package.json:3 0.10.0` |
| `sdk/index.ts` 60+ exports | `sdk/typescript/src/index.ts:189` |
| Runtime route count | `sdk/runtime/src/runtime.ts:644` |
| Platform infra approved | `platform/package.json:12` + `platform/src/lib/docs/mdx.ts:1` + `platform/content/docs/registry.json:32` |
| Legacy `platform/content/docs/**` | `platform/content/docs/` listing (4 SDKs ×2 versions) |
| Ladder L1→L4 | `product-research/11-sdk-new/package-ecosystem.md:60` |
| Resolver contract | `runtime/src/types/options.ts:23` `ResolveUser`, `runtime README:98` |
| CI matrix 4/8 pre-greenfield | `.github/workflows/test.yml:52` |
| Only docs validation today | `sdk/typescript/scripts/check-docs-coverage.mjs` |
| Logging OFF by default | `sdk/logger/README.md:2` |

> **Next step:** Approval of §6 (hybrid dedicated-host), §7 (per-minor versioning, greenfield single-version boot), §10 (keep `platform/` infra) gates Step 1 scaffold (already pre-approved verbally — scaffold begins next turn alongside legacy). Legacy deletion (Step 2) waits for explicit approval after scaffold review.

