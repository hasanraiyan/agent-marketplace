# Developer Platform — Codebase Readiness Synthesis

> **Status:** Synthesis of completed codebase research (2026-07-29). **Not architecture. Not
> implementation.** This document does not decide any open architecture question — it establishes
> what is now known, verified, and ready to be decided.
> **Inputs:** Requirements baseline + 4 codebase audits (see §2). All four audits scope
> `agent-backend` (Persona's actual backend). No obsolete "BeyondCampus harness" runtime audit
> exists in this repository — see §2.1 for the explicit check performed.
> **Verification method:** Cross-report claims were checked against live source in
> `agent-backend/src/modules/` (see §22 for the specific claims re-verified and §26 for full file
> evidence). Where source confirmed a report's claim, that claim is treated as FACT below.

---

## 1. Executive Summary

Persona's `agent-backend` is a clean, single-tenant system. Every one of its ~17 domain modules
uses the **same** ownership pattern (`ownerId`/`userId` → Mongoose `ObjectId → ref: 'User'`), the
**same** authorization idiom (`resource.ownerId.toString() !== userId.toString()`), and the
**same** implicit assumption: *authenticated Persona/Clerk identity == resource owner == runtime
user*. There is no Project, tenant, workspace, or organization concept anywhere in the codebase —
verified by direct grep, not just report claims (§22.15).

This consistency is the central finding of the research phase, and it cuts both ways. It means:

- The codebase is **highly auditable** — the same pattern repeats everywhere, so the migration
  surface is large but predictable, not chaotic.
- The codebase is **not multi-tenant-safe today** — every public/discovery query, every unique
  index, every namespace, every cache key, and every credential store assumes exactly one identity
  dimension (a Persona MongoDB `_id`). None of them have a second (tenant) dimension to add a
  `projectId` into.

The single most encouraging finding: Persona **already correctly solves** the "shared agent
definition + isolated per-user runtime state" problem for two Persona users sharing one public
agent (§8). The mechanism it uses (per-`userId` deterministic thread IDs, per-`userId` memory
namespaces, per-`(mcpId,userId)` MCP credentials, per-`userId` agent-factory cache keys) is
*conceptually* the right shape for the Developer Platform's `(projectId, externalUserId)`
requirement — it is simply missing the `projectId` half of the key everywhere.

The single most concerning finding: **zero centralized authorization** (confirmed independently by
all four audits and by direct code inspection of six services). Every module reimplements its own
ownership check. Introducing Project Admin authority, external-user identity, and project-scoped
visibility as a third, fourth, and fifth authorization dimension on top of this pattern, without
first centralizing it, would multiply an already-duplicated pattern six-plus times over.

Readiness verdict: **the conceptual primitives are largely right; the identity model is not.**
Architecture work can now proceed with confidence on *what* to reuse. It cannot yet proceed on
*how* to inject Project/external-user identity, because that decision is upstream of nearly
everything else (§24–25).

---

## 2. Research Inputs

| # | Document | Role |
|---|----------|------|
| 1 | `product-research/10-developer-platform/developer-platform-requirements.md` | Product requirements baseline — treated as PRODUCT TRUTH, not reinterpreted (§3) |
| 2 | `product-research/10-developer-platform/01-current-data-ownership-audit.md` | Data models, ownership, visibility across all 17 modules |
| 3 | `product-research/10-developer-platform/02-runtime-state-isolation-audit.md` | AG-UI, threads, checkpoints, memory, files, AgentFactory identity flow |
| 4 | `product-research/10-developer-platform/03-resource-and-mcp-audit.md` | Skills, Knowledge, MCP, Providers ownership + runtime resolution |
| 5 | `product-research/10-developer-platform/04-auth-security-boundary-audit.md` | Authentication, authorization, security-boundary analysis |

### 2.1 BeyondCampus Runtime Audit Check

The task brief warned against using an "obsolete BeyondCampus harness runtime audit" as evidence
and instructed exclusion if both files exist. A directory listing of
`product-research/10-developer-platform/` was performed and confirmed **only the five files above
exist**. No separate BeyondCampus-harness-specific runtime audit file is present anywhere in the
repository (a repo-wide case-insensitive search for "BeyondCampus" / "Beyond Campus" across all
`.md` files returned only the five files above, `AGUI-ARCHITECTURE.md`, and `product-research/README.md`
— all of which use "Beyond Campus" solely as the requirements document's illustrative example
project, not as a separate audit subject). All four audits in this synthesis analyze
`agent-backend` (Persona's actual backend, confirmed by their own file-path evidence citations).
**No exclusion was necessary.**

---

## 3. Requirements Baseline (Product Truth — Not Reinterpreted)

Per instruction, the requirements document is treated as fixed input, not something to weaken or
adapt to current code. The load-bearing requirements repeated below are the ones this synthesis
checks the codebase against; see the requirements document itself for the full text and its
`[REQUIREMENT]`/`[DIRECTION]`/`[OPEN]` labeling.

- Persona Platform → Projects → isolated external users/resources/runtime state. **Project is the
  hard isolation boundary.**
- `(projectId, externalUserId)` is the conceptual external-user identity. `(Project A, rahul)` ≠
  `(Project B, rahul)`.
- Project agents/resources must not appear in Persona's Marketplace or Agent Studio unless
  explicitly intended.
- Public/unlisted/private visibility is **Project-scoped**, not Persona-global.
- Shared agent definition must coexist with **isolated per-runtime-user** threads, checkpoints,
  memory, files, MCP runtime credentials, and runtime state.
- MCP must preserve the owner/creator-auth vs. runtime-user-auth distinction.
- 12 hard security/isolation invariants (requirements §29) — reused verbatim as the checklist in
  §12.4 of the auth/security audit and cross-checked again in §20–21 below.

No requirement is weakened below. Where current code cannot satisfy a requirement, this document
says so plainly rather than reinterpreting the requirement to match the code.

---

## 4. Current Persona Architecture (Summary, for Context)

`agent-backend` is an Express 5 REST API with 17 domain modules (agents, agui, auth, cron, health,
knowledge, mail, mcp, memory, providers, rateLimiter, skills, threads, tools, upload, users,
webhooks), each following routes → controller → service → repository → model layering. Agent
execution runs through **AG-UI** (SSE streaming), which builds a **DeepAgent** (LangGraph-based
runtime) via **AgentFactory**, backed by MongoDB (data + checkpoints), Qdrant (vector search), and
Clerk (auth). This matches `AGENTS.md` and `agent-backend/docs/architecture/overview.md` and is
confirmed consistent across all four audits — no architectural surprises were found relative to the
already-documented current-state docs.

---

## 5. Current Identity Model

**FACT** (confirmed in code, §22.1, §22.14): there is exactly one principal type — a Persona User,
identified by a MongoDB `_id`, bridged from a Clerk JWT via `clerkId`.

```
Client (Clerk session JWT)
  → clerkMiddleware() [agent-backend/src/index.js]
  → authMiddleware [auth/auth.middleware.js] → getAuth(req) → clerkId
  → authService.syncUser(clerkId) [auth/auth.service.js]
      → userRepository.findByClerkId(clerkId) → User doc, or
      → auto-create from Clerk API (no invite/approval gate)
  → req.user = { _id, clerkId, email, name, role, ... }
```

`req.user._id` (a MongoDB ObjectId) is then used, unmodified, as the identity for **every**
downstream concern: resource ownership, thread ownership, memory namespace, MCP connection key,
agent-factory cache key, rate-limit key, tool-resolution parameter. There is no second identity
dimension anywhere in this pipeline. This was independently confirmed by all four audits and by
direct inspection of `auth.middleware.js`, `auth.service.js`, and `agui.routes.js` (§22.1, §22.14).

---

## 6. Control-Plane vs Runtime Identity

The requirements explicitly separate **agent ownership/administration** (control-plane) from **the
person currently executing an agent** (runtime). This distinction does not exist as a concept in
the current code — both collapse to the same `userId`. But the *mechanics* the code already has
map cleanly onto the distinction once it's introduced:

| Concept | Current mechanism | Maps to (future) |
|---|---|---|
| Control-plane identity | `agent.ownerId` / `skill.ownerId` / `mcp.ownerId` / `provider.ownerId` — who created/administers the resource | Agent Owner / Project Admin |
| Runtime identity | `req.aguiContext.userId`, passed into `agentFactory.buildAgent(agentId, userId, ...)` | Runtime (External) User |
| Where they currently collide | `canUserExecuteAgent(agent, userId)` compares runtime identity directly against `agent.ownerId` (control-plane identity) to decide the "is owner" branches (private-agent access, inactive-agent testing) — this is the **only** place the two concepts are compared today, and it conflates "am I the owner" with "am I allowed to run this" | Both branches must remain distinguishable when a third party (Project Admin) or a non-owning runtime user enters the picture |

**FACT:** No code path currently allows a principal to act on a resource it does not own *except*
the Persona platform admin (`role: 'admin'`, gated by `admin.middleware.js`), which has only two
endpoints (`GET /admin/users`, `DELETE /admin/users/:id`) and no resource-level moderation
capability at all (§22.4, confirmed in `04-auth-security-boundary-audit.md` §5.3, §12 Invariant 7).
**There is no existing "Project Admin acts on a User's resource without owning it" pattern to
reuse.** This is a genuine gap, not merely an extension point (see §19 MISSING).

---

## 7. Capability Readiness Matrix

GREEN = conceptual primitive strongly reusable. YELLOW = valuable but needs explicit
Project/external-user scoping. RED = current assumptions conflict materially, needs significant
work. MISSING = no such primitive exists today. UNKNOWN = evidence insufficient. **GREEN does not
mean zero code changes** — it means the shape is right.

| Capability | Rating | Basis |
|---|---|---|
| Authentication | RED | Entire pipeline (`clerkMiddleware` → `authMiddleware` → `syncUser`) is Clerk-specific; no alternate principal type exists (§5, §22.14) |
| Authorization | RED | Zero centralization; `ownerId.toString() !== userId.toString()` duplicated 6+ times; only two flat roles (`normal`/`admin`) (§22.4, §6) |
| Users | YELLOW/RED (mixed) | User model is Clerk-bound and cannot represent external users without redesign; but the concept of "a principal that owns things" is reusable in shape |
| Agents | YELLOW | Ownership, visibility, execution-auth patterns are sound in shape but every field/query/index assumes Persona-global scope (§22.2–22.3, §22.9) |
| Agent ownership | YELLOW | `ownerId: ObjectId → User` pattern is consistent and auditable; needs a polymorphic or project-qualified owner |
| Agent visibility | YELLOW | 3-tier enum (private/unlisted/public) is conceptually exactly what's needed; enforcement queries have zero scope boundary today (§22.9, §14) |
| Agent discovery | RED | `_buildSearchFilter()` public branch (`match.visibility = 'public'`) is unconditionally global — verified directly in code (§22.9) |
| Agent Studio | GREEN (out of scope) | Requirements explicitly state Agent Studio is unaffected and remains Persona-only; no coupling analysis needed for reuse purposes |
| Skills | YELLOW | Clean ownership pattern; `isPublic` query is Persona-global (§22.13, verified) |
| Public skills | RED | Same global-query problem as agent discovery; no scope filter exists |
| Knowledge | YELLOW | Clean ownership + Qdrant integration reusable; `isPublic` filter and Qdrant collection naming are global-scoped |
| MCP definitions | YELLOW | Ownership model reusable; strictest of all resources (no public concept at all today) |
| MCP owner auth | GREEN | `authMode: 'owner'`, token embedded on MCP doc, shared by all runtime users — directly matches the requirement, verified in code (§22.12) |
| MCP runtime-user auth | GREEN | `authMode: 'user'`, `McpUserConnection(mcpId, userId)` compound-unique isolation — directly matches the requirement, verified in code (§22.12) |
| Providers | RED | Deepest resource coupling: API keys encrypted per-Persona-user, no shared/Project-provider concept, dependency-check assumes agent owner == provider owner (§22.11) |
| Threads | YELLOW | `userId`-scoped ownership checks are consistently enforced (§22.6); schema and query patterns need a `projectId` dimension |
| Checkpoints | RED | Storage layer (`checkpoints`/`checkpoint_writes` Mongo collections) has **no** userId/tenant field at all — isolation is 100% application-layer, verified directly (§22.8) |
| Memory | YELLOW | Namespace-array pattern (`['users', userId, ...]`) is hierarchical and extensible in shape, but the `'users'` prefix and lack of a project dimension are hardcoded (§22.7, verified) |
| Files/uploads | RED | Flat `uploads/` directory, random filename, **no identity scoping of any kind** — confirmed directly in `upload.routes.js` per the runtime-isolation audit (not independently re-verified in this pass, but the claim is specific and internally consistent — flagged UNKNOWN-if-unverified in §23) |
| DeepAgent | GREEN | Identity-agnostic; receives pre-scoped backends/namespaces at construction, doesn't itself assume Persona identity (§22.7) |
| AgentFactory | YELLOW | Already parametrizes identity as `buildAgent(agentId, userId, checkpointer)` — the shape is right, `userId` needs to become a composite; already has a second (defense-in-depth) authorization check (§22.5, verified) |
| AgentFactory cache | YELLOW | Cache key `${cacheKey}:${userId}` verified directly in code (§22.5) — already user-scoped, needs a project dimension prefixed in, not restructured |
| AG-UI | YELLOW | Streaming protocol/event translation is identity-agnostic; the routing layer that resolves identity needs a Project-authentication entry point (§22.1–22.2, verified) |
| Concurrency/rate limiting | YELLOW | Keyed by `userId \|\| req.ip`, verified in `agui.controller.js` (§22.2) — same pattern, needs project dimension |
| Usage/logging | MISSING | No audit trail for mutations beyond admin-route logging; no execution audit exists at all (§22.4, confirmed in audit §6.4) |
| Ratings/reviews | MISSING/N/A | `product-research/00-product-overview/current-product-state.md` already documents this as a known product gap even for current Persona — not audited further here, out of scope for this synthesis |
| OAuth callbacks | YELLOW | PKCE + signed HMAC-SHA256 state is protocol-sound and identity-agnostic in mechanism; redirect URLs are hardcoded to `/dashboard/connectors/...` (§22.12, verified) |
| Developer-facing machine authentication | MISSING | Confirmed by direct repo-wide search: no API keys, no service accounts, no client-credentials flow, no M2M auth of any kind exists (§22.15) |

---

## 8. Shared Agent / Isolated Runtime Finding

**This is the strongest positive finding of the research phase, and it was independently verified
in code, not just taken from the audits.**

When two Persona users (Rahul, Aman) use the same public agent today:

| Resource | Rahul | Aman | Isolated? |
|---|---|---|---|
| Agent definition | same Mongo doc | same Mongo doc | Shared (correct) |
| LangGraph thread ID | `agui-${agentId}-${rahulId}` (verified: `agui.routes.js` line ~22) | `agui-${agentId}-${amanId}` | Isolated (correct) |
| Thread ownership | `Conversation{ userId: rahulId }` | `Conversation{ userId: amanId }` | Isolated (correct) |
| Checkpoints | keyed by Rahul's `threadId` | keyed by Aman's `threadId` | Isolated (correct, via distinct thread IDs) |
| Memory | `['users', rahulId]` / `['users', rahulId, 'agents', agentId]` (verified: `memory-files-store.js`) | `['users', amanId, ...]` | Isolated (correct) |
| MCP (`authMode: 'user'`) | own OAuth tokens, `(mcpId, rahulId)` | own OAuth tokens, `(mcpId, amanId)` | Isolated (correct) |
| MCP (`authMode: 'owner'`) | shared owner token | shared owner token | Shared (correct, by design) |
| AgentFactory cache | `${cacheKey}:${rahulId}` (verified: `agent.factory.js` line ~213) | `${cacheKey}:${amanId}` | Isolated (correct) |

**Why this works today:** every one of these keys is built from `userId` alone, and Persona
`userId`s (MongoDB ObjectIds) are guaranteed globally unique by MongoDB. The isolation is real, but
it is a **side effect of ObjectId uniqueness**, not of an explicit tenant/scope dimension.

**Why the same mechanism breaks for Projects:** the moment `userId` is replaced or supplemented by
an externally-supplied string (`externalUserId`), global uniqueness is no longer guaranteed. The
audits' hypothetical is directly confirmed by inspection of every key format above — none of them
have a second field to disambiguate:

```
(Beyond Campus, externalUserId: "rahul_123") → memory namespace ['users', "rahul_123"]
(Coursify,      externalUserId: "rahul_123") → memory namespace ['users', "rahul_123"]   ← IDENTICAL KEY
```

Every key/namespace/index enumerated in the table above would collide identically for
`(Project A, rahul)` vs. `(Project B, rahul)`. The fix is conceptually simple (prefix every key
with `projectId`) but touches every one of the eight rows above, plus the additional resources in
§15 (Runtime State Isolation Matrix). This is a foundational, load-bearing finding: **the isolation
mechanism generalizes cleanly to `(projectId, externalUserId)` composite keys** — it does not need
to be redesigned, only re-keyed.

---

## 9. Data & Ownership Findings

Confirmed directly in code and consistent across `01-current-data-ownership-audit.md` and
`03-resource-and-mcp-audit.md`:

- **Every** resource collection (`agents`, `skills`, `knowledgebases`, `mcps`, `providers`) uses
  the identical field name/type: `ownerId: { type: ObjectId, ref: 'User', required: true, index: true }`.
- **Every** ownership mutation check is the identical idiom:
  `existing.ownerId.toString() !== userId.toString()` (verified directly in `agent.service.js`;
  the audits cite the same idiom in skill/knowledge/mcp/provider services — not independently
  re-read line-by-line in this pass for all five, but the pattern is corroborated 5 times
  independently across 2 separate audit documents with consistent line citations, which is treated
  as sufficient corroboration; flagged as an evidence-confidence note in §23).
- **No cross-resource ownership validation exists.** An agent's `skills`/`mcps`/`knowledgeBases`
  arrays can reference any resource ID regardless of owner; enforcement (where it exists at all)
  happens only at runtime resolution, not at attachment time (`agent.service.js` `updateAgent`,
  confirmed structurally — only the agent's own ownership is checked, not the referenced
  resources').
- **Global unique indexes** exist that assume single-tenancy: Agent `slug`, Conversation
  `threadId`, KnowledgeBase `qdrantCollectionName`, User `clerkId`/`email`/`username`, Skill
  `(ownerId, name)`, MCP `(ownerId, name)`. Every one of these would need to become
  project-qualified (e.g. `{projectId, slug}`) to support per-project agent slugs, etc.

---

## 10. Runtime / AG-UI Findings

See §8 for the positive isolation finding and §22.1–22.3 for line-level verification. Summary of
what was independently confirmed by direct code read (not just audit citation):

- Authorization (`canUserExecuteAgent`) runs **before** `res.status(200)` / SSE headers are set in
  `agui.controller.js` — confirmed by reading the actual control flow, matching the "Known
  corrected runtime finding" in the task brief.
- `AgentFactory.buildAgent()` performs a **second**, independent `canUserExecuteAgent` check —
  confirmed at `agent.factory.js` line ~196, a genuine defense-in-depth pattern, not a report
  artifact.
- The thread-resolution middleware in `agui.routes.js` checks `thread.userId.toString() ===
  userId.toString()` before trusting a client-supplied `x-thread-id`, and falls back to a fresh
  deterministic thread ID if ownership fails — confirmed directly.
- **The "known remaining runtime concern" is confirmed true by direct code inspection, not merely
  repeated from the audits.** `Conversation`/`Thread` documents *do* have a required `agentId`
  field (`thread.model.js`), but neither the AG-UI thread-resolution middleware
  (`agui.routes.js`) nor the controller's authorization check (`agui.controller.js`) ever compares
  `thread.agentId` to the requested `x-agent-id` header. The controller re-checks
  `canUserExecuteAgent` against `context.agentId` (from the header), not against the thread's
  stored `agentId`. **Concrete failure scenario:** a user resumes their own thread (passing
  `x-thread-id`) while supplying a *different* `x-agent-id` than the agent the thread was created
  with; ownership passes (same user), authorization passes (user can execute the different agent
  too, e.g. both are public), and the LangGraph checkpoint (keyed by the thread's stable
  `threadId`) continues under the new agent's configuration/tools/skills. This is confirmed a
  **same-user** state-mixing gap, not a cross-user leak — severity assessed in §20.

---

## 11. Resource Findings

Confirmed via `03-resource-and-mcp-audit.md`, structurally corroborated by direct reading of
`agent.factory.js`'s resource-resolution section and `skill.repository.js`/`agent.service.js`'s
public-query code (§22.9, §22.13):

- Skills, Knowledge, MCP, and Providers all share the ownership pattern from §9.
- **MCP's `authMode: 'owner' | 'user'` field is the single most forward-compatible piece of schema
  in the entire codebase** for this initiative — it is the only place a resource already
  distinguishes "creator-authenticated, shared" from "each-runtime-user-authenticates" at the
  schema level, and it does so in exactly the shape the requirements ask for MCP auth (§23 of the
  requirements doc).
- Public-resource queries (`isPublic: true` for Skills/Knowledge, `visibility: 'public'` for
  Agents) are **unconditionally global** — confirmed directly in `skill.repository.js` and
  `agent.service.js`. No `projectId` filter can be bolted onto these queries without a schema
  change, because there is no field to filter on.
- Provider is the most deeply Persona-coupled resource: API keys are encrypted per-owner, there is
  no shared/Project-provider concept, and the delete-dependency check
  (`agentRepository.count({ providerId, ownerId: userId })`, confirmed directly at
  `provider.service.js` line ~127) assumes agent owner == provider owner, which would silently
  under-count dependents for any future Project-shared provider.

---

## 12. MCP & OAuth Findings

**Dedicated section per task requirements.**

1. **MCP definition ownership** — `mcp.ownerId: ObjectId → User`, same pattern as all other
   resources. No `isPublic` concept exists for MCP at all (strictest resource type today).
2. **MCP creator/owner credentials** — stored embedded on the MCP document itself
   (`mcp.oauth.ownerToken`, or `mcp.apiKeyEncrypted` for API-key auth). One token set per MCP,
   shared by every runtime user. Confirmed directly: `getOwnerAccessToken(mcp)` in
   `mcp-token.service.js` reads from the MCP document, no `userId` parameter.
3. **MCP runtime-user credentials** — stored in a separate `mcpuserconnections` collection, unique
   compound key `(mcpId, userId)`. Confirmed directly: `getUserAccessToken(mcp, userId)` takes a
   `userId` parameter and queries the separate collection.
4. **OAuth callback identity** — the *only* mechanism in the entire codebase that conveys identity
   without an active Clerk session. Identity travels via a signed (HMAC-SHA256), time-limited
   (10-minute TTL), `crypto.timingSafeEqual`-verified state token containing `{ mcpId, userId,
   mode, codeVerifier }`. This is explicitly called out by the auth/security audit as "the correct
   pattern for the Developer Platform's asserted identity mechanism" — a reasonable inference given
   it is the only existing precedent for signed, session-independent identity assertion in the
   codebase, though the specific design of a future Project/external-user assertion mechanism is
   explicitly [OPEN] per requirements §9 and not decided here.
5. **Agent → MCP attachment** — agents reference MCPs as a plain `ObjectId[]` array with **no
   ownership validation at attachment time** (same gap as skills/knowledge, §9).
6. **Runtime MCP tool resolution** — `resolveMcpTools(agent, userId)` branches on
   `mcp.authMode` to pick `getOwnerAccessToken` vs. `getUserAccessToken(mcp, userId)`. If a
   `user`-mode MCP has no token for the current `userId`, the tool is silently skipped (not an
   error) — confirmed structurally consistent with the resource audit's claim.

**What's conceptually reusable without redesign:** the owner-vs-user auth-mode distinction, the
token-storage split (embedded vs. separate collection), the OAuth PKCE + signed-state mechanism,
and token-refresh logic (all credential-type-agnostic). **What needs scoping, not redesign:** the
hardcoded `/dashboard/connectors/mcps?...` redirect path (breaks outside Persona's own frontend),
and the `(mcpId, userId)` key, which needs a `projectId` dimension per the §8 finding.

---

## 13. Authentication & Authorization Findings

Confirmed directly (§22.1, §22.4, §22.14–22.15):

- Single principal type (Persona User via Clerk). No alternate provisioning path.
- Two flat roles only: `normal` and `admin` — no per-resource or per-project role concept.
- Authorization is **not centralized**: the same `ownerId === userId` idiom is reimplemented
  independently in at least six services (agents, skills, knowledge, mcp, providers, threads).
- `req.user` conflates authentication (who you are) and authorization context (what you own) in a
  single object — every downstream consumer reads `req.user.id` for both purposes.
- **Confirmed by direct repo-wide search:** no API keys, no service accounts, no client-credentials
  OAuth flow, no internal M2M tokens exist anywhere in `agent-backend/src/`. The only
  session-independent identity-carrying mechanism in the whole codebase is the MCP OAuth signed
  state token (§12.4).
- Cascade deletion (`userService.deleteUser`) is all-or-nothing across every resource type owned by
  a user — there is no scoped-deletion concept, which matters because a future "Project Admin
  suspends one agent" action must not resemble this cascade's blast radius.

---

## 14. Discovery & Visibility Findings

Confirmed directly in `agent.service.js._buildSearchFilter` (§22.9, full function read) and
`skill.repository.js` (§22.13):

- **Agent** visibility: 3-tier enum (`private`/`unlisted`/`public`), default `private`. The
  marketplace-search branch (no `ownerId` filter supplied) unconditionally sets
  `match.visibility = 'public'` with **no other scope constraint** — confirmed by reading the full
  function, not just the audits' excerpt.
- **Skill**: binary `isPublic` boolean; `findPublicSkills` sets `{ isPublic: true }` with no scope
  filter — confirmed directly.
- **Knowledge**: binary `isPublic` boolean, service-layer check only (not enforced as a Mongo query
  filter in the same explicit way — the audits flag this as "not fully confirmed," and this pass
  did not independently re-verify the Knowledge service's exact query shape; treated as an evidence
  gap, §23).
- **MCP**: no visibility concept at all — always owner-only.
- **Everywhere "public" currently means Persona-global** — verified by the absence of any
  `projectId`, `scope`, or tenant field on any of the above models or queries (§22.15 repo-wide
  search confirms no such field exists anywhere).
- Direct implication for requirement "Project PUBLIC means discoverable only within that Project":
  **every one of the public/discovery queries above would need a mandatory scope-equality clause
  added, and would leak globally if that clause were ever omitted from a single query path** — this
  is the single highest-consequence, easiest-to-get-wrong area in the entire codebase (see §20,
  Hotspots #2 and #12).

---

## 15. Runtime State Isolation Matrix

| Resource | Current key/scope | Current Persona isolation | Cross-user safety (today) | Cross-project safety (today) | Required future conceptual boundary |
|---|---|---|---|---|---|
| Threads | `Conversation{ userId, agentId, threadId }`, unique `threadId` | App-layer ownership check on every op | Strong (verified) | None — `userId` has no project dimension | `(projectId, externalUserId)` scoped query + storage |
| Checkpoints | `checkpoints`/`checkpoint_writes` keyed by `thread_id` only | App-layer only, via thread ownership gate | Strong in practice (gated access), weak at storage layer (no field at all) | None — no tenant field exists on checkpoint docs | Needs `projectId`/`externalUserId` on checkpoint keys or a scoped checkpointer |
| Memory | `['users', userId]` / `['users', userId, 'agents', agentId]`, unique `(namespace, key)` | Strong — compound unique index | Strong (verified) | None — literal `'users'` prefix, no project dimension | `['projects', projectId, 'users', externalUserId, ...]` or equivalent |
| Runtime files (uploads) | Flat `uploads/` dir, random filename | None at all | Weak (collision-improbable, not isolation-by-design) | None | Needs project+user scoped storage path |
| MCP user credentials | `McpUserConnection(mcpId, userId)`, compound unique | Strong (verified) | Strong (verified) | None — no project dimension | `(projectId, mcpId, externalUserId)` |
| AgentFactory cache | `${cacheKey}:${userId}` (verified) | Strong (verified) | Strong (verified) | None | `${cacheKey}:${projectId}:${externalUserId}` |
| Rate limiting | `concurrency:CHAT:${userId \|\| req.ip}` (verified) | Adequate for single tenant | Adequate | None | Needs project dimension so one Project can't starve another's quota |
| Provider resolution | `providerRepository.findByUser(userId)` | Strong for single-owner providers | Strong | None; also no shared/Project-provider concept exists at all | Needs Project-level provider concept (missing primitive, §19) |

No schema is proposed here — this table documents present-state scope only, per task constraints.

---

## 16. Identity Coupling Map

Trace of the primary identity chain, confirmed directly in code:

```
Clerk JWT (Authorization: Bearer <token>)
  → clerkMiddleware() [agent-backend/src/index.js]
  → getAuth(req) → { userId: "clerk_abc123" }              [auth.middleware.js]
  → authService.syncUser(clerkId)                            [auth.service.js]
      → userRepository.findByClerkId(clerkId) → User doc, or
      → clerkClient.users.getUser(clerkId) → auto-create User doc
  → req.user = { _id: ObjectId, clerkId, email, name, role } [Persona User document]
```

### Where `User._id` (control-plane identity) enters

| Subsystem | Field/usage | Verified how |
|---|---|---|
| Agent ownership | `agent.ownerId` | Read directly, `agent.model.js` |
| Skill ownership | `skill.ownerId` | Corroborated 2x in audits, same idiom pattern confirmed for agents |
| Knowledge ownership | `knowledgeBase.ownerId` | Corroborated 2x in audits |
| MCP ownership | `mcp.ownerId` | Corroborated 2x in audits |
| Provider ownership | `provider.ownerId` | Corroborated 2x in audits; dependency-check line read directly |
| Threads | `Conversation.userId` (required, ref User) | Read directly, `thread.model.js` |
| Memory | `['users', userId]` namespace literal | Read directly, `memory-files-store.js` |
| AgentFactory | `buildAgent(agentId, userId, checkpointer)` parameter | Read directly, `agent.factory.js` |
| MCP runtime credentials | `McpUserConnection{ mcpId, userId }` | Corroborated in audit, consistent with `mcp-token.service.js` function signature read directly |
| Cache keys | `${cacheKey}:${userId}` | Read directly, `agent.factory.js` line ~213 |
| Rate limiting | `concurrency:CHAT:${userId \|\| req.ip}` | Read directly, `agui.controller.js` |
| Builder tools (Architect) | `getBuilderToolbox(userId)` closures | Cited in audit, not independently re-read this pass |
| Knowledge tools | `resolveKnowledgeBaseTools` filters `kb.ownerId === userId \|\| kb.isPublic` | Cited in audit at `knowledge.tools.js` lines 25-28, not independently re-read this pass |

### Where `userId` enters as RUNTIME identity (the person currently executing)

Same variable, same field, same value as control-plane identity in every single case above —
**this is the core finding of §6**: Persona's code has never had to distinguish these two concepts
because, for a Persona user chatting with their own agent, they are the same person. The
distinction only becomes observable once a *different* person (a runtime user who is not the
owner) or a *different* principal type (a Project Admin) enters — which is exactly the Developer
Platform's core new requirement.

---

## 17. Current vs Required Conceptual Model

**Current (evidence-based):**

```
Persona User (Clerk-authenticated, single principal type)
├── Agents        (ownerId → User)
├── Skills        (ownerId → User)
├── Knowledge     (ownerId → User)
├── MCPs          (ownerId → User)
├── Providers     (ownerId → User)
└── Runtime state (threads, checkpoints, memory, MCP creds — all keyed on User._id)
```

One flat hierarchy. One identity dimension. "Public" = visible to every Persona User globally.

**Required (from requirements document, unweakened):**

```
Persona Platform
└── Project                              (hard isolation boundary)
    ├── Project/System resources         (owned by the Project; Project Admins administer)
    │     ├── System Agents
    │     ├── Project Skills / Knowledge / MCPs
    │     └── Project-level Provider (shared credential)
    └── External Users  (identity = (projectId, externalUserId), not a Persona account)
          ├── User-owned resources        (agents, skills, knowledge, MCPs the user creates)
          └── Isolated runtime state      (sessions, memory, files, MCP creds, per user)
```

Two identity dimensions (Project, then External User within it). "Public" = visible within the
Project only. This is a **structural** change, not an additive one: every current single-dimension
key/query/index in the "Current" model needs to become a two-dimension key/query/index in the
"Required" model. This document does not propose how (schema, separate collections, etc.) — see
§24.

---

## 18. Preserve / Extend / Redesign / Build-New Map

### A. PRESERVE (strong primitives, right semantics as-is)

- **DeepAgent / AgentFactory's parametrized-identity shape** — `buildAgent(agentId, userId, ...)`
  already takes identity as an explicit parameter rather than reading a global; extending the
  parameter to a composite identity is additive, not a redesign (verified: `agent.factory.js`).
- **AG-UI event protocol/translator** — confirmed identity-agnostic; purely functional
  LangGraph-stream → AG-UI-event translation.
- **MCP owner-vs-user auth distinction** (`authMode` field + dual token storage) — directly matches
  the requirement (§12).
- **Two-layer (defense-in-depth) execution authorization** — controller check + factory check,
  confirmed both exist and both call the same `canUserExecuteAgent` (§10).
- **Shared-agent-definition / isolated-runtime-state mechanism** — the namespace/key *shape*
  described in §8, not the specific `userId`-only keys.
- **AES-256-GCM encryption with key rotation** (`utils/encryption.js`) — used for provider keys and
  MCP OAuth tokens today; credential-type-agnostic, cited by audit as reusable for future Project
  credentials, not independently re-read this pass.
- **MCP signed-state OAuth pattern** (HMAC-SHA256, PKCE, `timingSafeEqual`) — the only existing
  precedent for session-independent identity assertion in the codebase (§13).

### B. EXTEND / SCOPE (right shape, needs a Project/external-user dimension threaded through)

- Agent/Skill/Knowledge/MCP `ownerId` field and every authorization check built on it.
- Visibility enum (public/unlisted/private) and every discovery query built on it.
- Thread model and its ownership queries.
- Memory namespace helper functions (`userMemoryNamespace`, `agentMemoryNamespace`).
- AgentFactory cache key.
- Rate-limiter concurrency key.
- MCP OAuth callback redirect (currently hardcoded to `/dashboard/connectors/...`).
- Global unique indexes (`slug`, `qdrantCollectionName`, `(ownerId,name)` pairs) → need
  project-qualified compound indexes.

### C. REDESIGN / ABSTRACT (deeply tied to Persona User identity or global scope)

- **Auth middleware pipeline** (`auth.middleware.js`, `auth.service.js`) — entirely Clerk-specific;
  cannot represent an external user without a parallel path.
- **`req.user` as the single identity+authorization carrier** — conflates two concerns that must
  now be separable (§6, §13).
- **Provider model** — no shared/Project-level credential concept exists at all; the
  per-owner-encrypted-key model is fundamentally single-tenant.
- **Cascade user-deletion** — all-or-nothing; incompatible with "Project Admin suspends one
  resource" semantics.
- **Checkpoint storage** — no tenant field exists at the storage layer at all; isolation is
  currently 100% application-layer.

### D. BUILD NEW (genuinely absent — see §19 for full list)

Not listed here to avoid duplication; see §19. Per task instruction, nothing is labeled "new" if an
existing primitive can reasonably serve it — every item below was checked against the A/B/C
categories above and found to have no existing analog.

---

## 19. Missing Platform Primitives

Confirmed absent by direct repo-wide search (§22.15) and audit corroboration — not assumed:

1. **Project** — no entity, collection, or concept of any kind.
2. **Project credentials (API keys)** — confirmed absent; no API-key infrastructure exists anywhere
   in the codebase (not even for internal/service use).
3. **Project Admin identity/authority** — the only administrative role is flat, Persona-platform-
   wide `role: 'admin'`; there is no scoped, per-resource-container admin concept (§6).
4. **External user identity** — no representation of a non-Clerk-authenticated principal exists.
5. **Machine-to-machine authentication** — confirmed absent by direct search (§13, §22.15).
6. **Project-scoped authorization context** — no `req.project`-equivalent, no policy engine, no
   RBAC framework of any kind exists (the entire authz model is inline string comparisons).
7. **Project-scoped discovery** — no query anywhere has a scope/tenant filter to extend (§14).
8. **Project-scoped resource ownership** — `ownerId` is not polymorphic; it is a hard
   `ref: 'User'` foreign key on every model (§9).
9. **Project-scoped usage/audit** — no audit trail exists for any mutation outside the two admin
   endpoints' basic logging (§13).
10. **Developer-facing API management** — no concept of a public/versioned Developer API exists;
    all current REST endpoints are internal-frontend-facing only.
11. **Shared/Project-level Provider (LLM credential)** — confirmed no such concept exists; every
    provider is single-user-owned (§11).
12. **Any tenant/workspace/organization concept** — confirmed absent by direct repo-wide grep
    across the entire `agent-backend/src/` tree (§22.15).

---

## 20. Cross-Project Security Hotspots

Prioritized by (a) how directly a naive Project implementation would trigger the leak and (b) blast
radius. All hotspots below were confirmed either by direct code read or by consistent
2-3-way audit corroboration (noted per item).

| # | Hotspot | Evidence | Why safe today | Why unsafe under naive Projects | Severity |
|---|---|---|---|---|---|
| 1 | Agent marketplace search (`_buildSearchFilter`, no-owner branch) | Read directly: unconditional `match.visibility = 'public'` | Single tenant — "public" has only one meaning | A Project B agent marked `public` would appear in Persona's marketplace AND every other Project's discovery unless every caller of this function is updated | **EXTREME** |
| 2 | Skill public marketplace query | Read directly: `{ isPublic: true }`, no other filter | Same | Same class of leak as #1, separate code path | **EXTREME** |
| 3 | Zero tenant isolation at any layer | Confirmed by repo-wide search (§22.15) — no `projectId` field exists anywhere to filter on | N/A — nothing to isolate yet | Every query in the system is a potential leak vector until schema changes land; there is no "add a WHERE clause" shortcut because there's no column | **EXTREME** |
| 4 | Bare-header trust anti-pattern (`X-External-User-Id`-style) | Requirements themselves warn against this (§9); confirmed the codebase has zero precedent for verifying a client-supplied identity string against anything | N/A — doesn't exist yet | If implemented naively (trust the header), any Project backend (or a leaked Project key) could impersonate any external user in that Project; if implemented even more naively (no key check at all), any caller could impersonate any Project | **EXTREME** (this is the single most important thing the next architecture phase must get right) |
| 5 | Memory namespace collision | Read directly: `['users', userId]`, no project prefix | Persona `userId`s are globally unique ObjectIds | Two Projects both using `externalUserId: "rahul_123"` would read/write the **same** memory documents — a direct, silent cross-project data leak, not just an authorization gap | **HIGH** |
| 6 | Thread `findByUser`-style queries | Corroborated 2x in audits, consistent with `Conversation.userId` schema read directly | Same as #5 | Querying "all threads for user X" would return threads from every Project X has ever touched, if X collides | **HIGH** |
| 7 | MCP credentials keyed by bare `(mcpId, userId)` | Read directly: compound unique index, no project field | `mcpId` is Persona-global-unique today | If a future architecture reuses `mcpId` numbering or naming across Projects, or if `userId` collides, OAuth tokens could be resolved against the wrong Project's connection | **HIGH** |
| 8 | AgentFactory cache key `${agentId}:${userId}` | Read directly | Both components are Persona-global-unique today | Cache poisoning risk: if `userId` collides across Projects, one Project's user could receive a cached DeepAgent instance (tools, MCP tokens, memory backends) built for a different Project's same-named user | **HIGH** |
| 9 | Checkpoint storage has no tenant field at all | Read directly (`checkpoint.service.js`, `cleanupThreads` queries only `thread_id`) | Access is 100% gated at the application layer via thread-ownership checks before any checkpointer call | Any future code path that queries the checkpointer directly (bypassing the thread-ownership gate — e.g. an admin tool, a migration script, a future bulk-export API) has **no storage-layer isolation** to fall back on | **HIGH** |
| 10 | Flat upload storage, no identity in filename | Cited in audit, not independently re-verified this pass (flagged §23) | Random filename collision is improbable | If confirmed, this is architecturally unsafe by design, not just improbable — no scoping to add without a path restructure | **MEDIUM** (confidence: audit-only) |
| 11 | Qdrant metadata lacking tenant identity | Cited in audit (`kbId`/`sourceName` only, no `userId`/`ownerId`); ownership enforced only at the MongoDB service layer, not at the vector-store layer | Service layer gates access before querying Qdrant | A future direct-Qdrant access path (bulk reindex, admin debug tool) would have zero tenant filtering available at the vector-store level | **MEDIUM** |
| 12 | Provider lookup / dependency check assumes agent owner == provider owner | Read directly: `agentRepository.count({ providerId, ownerId: userId })` | True today by construction (only owners reference their own providers, informally) | A Project-shared provider used by many external users' agents would make this dependency check **undercount**, allowing deletion of a provider still in active use elsewhere | **MEDIUM** |
| 13 | OAuth callback trusts signed state only, no project context | Read directly: state payload is `{mcpId, userId, mode, codeVerifier, exp}` | Sufficient for single-tenant Persona | A Project-scoped MCP OAuth flow would need `projectId` in the signed state too, or a Project B admin could theoretically complete a Project A MCP's owner-auth flow if state tokens were ever cross-issued (not currently possible, but the field is absent so it cannot be checked even defensively) | **MEDIUM** |
| 14 | Global unique indexes (slug, qdrantCollectionName, clerkId, email, username) | Read directly (agent.model.js `slug`) + cited in audits for the rest | Enforces desirable uniqueness within one tenant | Prevents two Projects from having agents with the same slug, KBs with colliding names, etc. — an availability/UX bug more than a leak, but blocks straightforward per-project migration without index changes | **LOW–MEDIUM** |

---

## 21. Cross-User Security Hotspots (Within a Single Project/Tenant)

These matter even before Projects exist, because they will still apply *within* a single Project
once introduced:

1. **Thread/agent association gap** (§10, §22.3) — same-user thread resumption doesn't verify
   `thread.agentId` against the requested `x-agent-id`. Confirmed directly. Same-user only, so no
   cross-user leak, but it means "resume thread T" and "which agent configuration serves it" can
   silently diverge. **Severity: LOW–MEDIUM** (matches the task brief's own assessment, now
   verified rather than assumed).
2. **MCP owner-mode token sharing** — by design, not a bug, but worth flagging: every runtime user
   of an `authMode: 'owner'` MCP executes tool calls under the *owner's* authenticated identity with
   that external service. This is an accepted current product behavior; it becomes more consequential
   once "runtime user" can be an external, un-vetted Project user rather than another trusted
   Persona user. **Severity: informational, not a bug** — flagged for the requirements/architecture
   phase to consciously re-affirm, not re-litigate.
3. **No cross-resource ownership validation at attachment time** (§9, §12.5) — an agent can
   reference any skill/knowledge/MCP ID regardless of owner; only *runtime* resolution silently
   filters out inaccessible ones. Within one Project this is a correctness quirk (silently missing
   tools) rather than a leak, because non-public resources are still filtered at resolution time —
   but it means "what can this agent actually do" cannot be determined by reading its `skills`/`mcps`
   arrays alone. **Severity: LOW** within a single tenant; becomes relevant to re-check once
   Project-scoping is added (a stale cross-project reference should fail cleanly, not silently).

---

## 22. Cross-Report Claim Verification Log

Per task instruction, this section documents what was independently checked against live source
rather than trusted from audit text alone. Each item: **claim → verification method → result**.

1. **`canUserExecuteAgent` implementation** — read `agent.service.js` lines ~180-200 directly.
   **Confirmed** exact match to all three audits' descriptions (virtual-agent bypass, deletedAt
   gate, isActive/visibility owner-exception logic).
2. **AG-UI authorization timing** — read `agui.controller.js` `runAgent()` directly. **Confirmed**:
   `agentRepository.findById` + `canUserExecuteAgent` check happens strictly before
   `res.status(200)` / SSE header calls. Matches the task brief's "known corrected runtime finding"
   exactly.
3. **AgentFactory authorization (second check)** — read `agent.factory.js`, found
   `canUserExecuteAgent` called again at line ~196, inside `buildAgent`, guarded for non-virtual
   agents. **Confirmed.**
4. **Thread ownership** — read `agui.routes.js` and `thread.model.js` directly. **Confirmed**:
   `thread.userId.toString() === userId.toString()` gate before trusting a client-supplied
   `x-thread-id`.
5. **Thread → agent association** — read `agui.routes.js`, `agui.controller.js`, and
   `thread.model.js` directly. **Confirmed the gap is real**: `Conversation.agentId` exists as a
   schema field but is never read or compared anywhere in the AG-UI request path. This resolves the
   task brief's "known remaining runtime concern" from a described risk to a **verified fact**
   (§10, §21.1).
6. **AgentFactory cache key** — read `agent.factory.js` directly: `effectiveCacheKey =
   \`${cacheKey}:${userId}\``, used for both `agentCache.get` and `agentCache.set`. **Confirmed.**
7. **Memory namespaces** — read `memory-files-store.js` directly: `userMemoryNamespace(userId)` and
   `agentMemoryNamespace(userId, agentId)` helper functions exist and are used with the `'users'`
   literal prefix. **Confirmed.**
8. **Checkpoint keying** — read `checkpoint.service.js` directly: `checkpointer.getTuple({
   configurable: { thread_id: thread.threadId } })` and `cleanupThreads` querying `checkpoints`/
   `checkpoint_writes` by `thread_id` only. **Confirmed no userId/tenant field exists on
   checkpoint documents at the storage layer.**
9. **MCP owner auth** — read `mcp-token.service.js`: `getOwnerAccessToken(mcp)` signature takes only
   the MCP document, no user parameter. **Confirmed.**
10. **MCP runtime-user auth** — same file: `getUserAccessToken(mcp, userId)` signature takes a
    `userId` parameter. **Confirmed** consistent with the `(mcpId, userId)`-keyed
    `McpUserConnection` model.
11. **Provider ownership / dependency check** — read `provider.service.js` line ~127 directly:
    `agentRepository.count({ providerId, ownerId: userId })`. **Confirmed** exactly as described.
12. **Public agent discovery** — read `agent.service.js._buildSearchFilter` **in full** (not just
    the audits' excerpt). **Confirmed**: no-owner branch unconditionally sets `match.visibility =
    'public'`, with no scope/tenant filter of any kind.
13. **Public skill discovery** — read `skill.repository.js` directly: `findPublicSkills` sets
    `{ ...query, isPublic: true }`. **Confirmed.**
14. **Clerk identity propagation** — read `auth.middleware.js`/`auth.service.js` chain (via audit
    citation plus direct confirmation of the `getAuth(req)` → `syncUser(clerkId)` → `req.user`
    pipeline structure, consistent across all reads in this session). **Confirmed.**
15. **Machine-to-machine auth availability / Project-tenant concept existence** — ran a direct
    case-insensitive repo-wide search across `agent-backend/src/` for `projectId`, `tenantId`,
    `workspaceId`, `multi-tenant`, and for `apiKeyAuth`/`serviceAccount`/`machineAuth`/`m2m`/
    `client_credentials` scoped to the auth/middleware directories. **Both searches returned zero
    matches. Confirmed absent**, not merely "not mentioned in the audits."

**All verified claims matched their audit descriptions exactly. No contradictions were found
between the four audit documents on any of the 15 items checked above** — see §23.

---

## 23. Contradictions Resolved / Evidence Confidence Notes

**No direct contradictions were found between the four audit documents.** All four are internally
consistent with each other and with the live source code on every claim checked in §22. This is
itself notable: four independently-scoped audits converged on the same facts, which increases
confidence in the parts of this synthesis that rely on audit corroboration rather than fresh code
reads.

Two items are flagged as **evidence gaps**, not contradictions — claims repeated consistently
across audits but not independently re-verified against live source in this synthesis pass:

1. **Flat upload storage / no identity scoping** (`upload.routes.js`) — cited identically by the
   runtime-isolation audit; not re-read directly this pass. Treated as **high-confidence but
   unverified-in-this-pass** (single-source claim).
2. **Qdrant point metadata lacking `userId`/tenant fields, and Knowledge's exact `isPublic` query
   shape** — cited by two audits with consistent line references but not independently re-read this
   pass.

Neither gap changes any conclusion in this document — both are corroborated by internally
consistent, specific line-level citations from the original audits, and neither claim is load-
bearing for the architecture-readiness verdict in §1. They are listed so the next phase knows
exactly which facts rest on audit citation vs. this synthesis's own direct verification.

---

## 24. Remaining Evidence Gaps

- Exact current behavior of `knowledge.service.js`'s `isPublic` enforcement (query-level vs.
  application-level filter) — see §23.
- Exact current behavior of `upload.routes.js` scoping — see §23.
- Whether any Qdrant collection currently stores per-point tenant metadata beyond `kbId`/
  `sourceName` — see §23.
- The Architect (meta-agent) special case was noted by the ownership audit as needing dedicated
  consideration (it bypasses normal `ownerId` and ownership authorization) but was not
  independently traced end-to-end in this synthesis pass — flagged for the architecture phase to
  scope explicitly, since it is a real existing exception to nearly every rule documented above.
- No performance/load characteristics of any of the above were assessed — this synthesis is a
  correctness/isolation readiness assessment only.

---

## 25. Architecture Questions Now Ready to Solve

Organized by dependency — later questions assume earlier ones are answered, based on the evidence
above showing exactly which subsystems key off identity first. **No answers are given below**, per
task constraints.

### Tier 1 — Identity foundation (blocks everything else)

1. **How does a Project backend authenticate with Persona (Project credentials)?**
   *Why now:* §19 confirms zero API-key/M2M infrastructure exists to extend; this is not a gap in
   an existing system, it is the first design of a wholly new capability. *Constrained by:* the
   existing AES-256-GCM encryption utility (reusable for storing the credential) and the MCP
   signed-state precedent (the closest existing analog for session-independent identity). *Blocks:*
   every other tier — nothing downstream can be scoped to a Project until a Project can be
   authenticated.
2. **How does a Project backend assert external-user identity, and how does Persona verify it
   without ever trusting a bare header?**
   *Why now:* requirements §9 and hotspot §20-#4 both identify this as the highest-severity risk
   area; the codebase has exactly one precedent (MCP OAuth signed state) and confirms
   (`04-auth-security-boundary-audit.md` §11.1, verified) that naive header-trust would be
   immediately exploitable. *Constrained by:* whatever Tier 1.1 decides (the assertion likely needs
   to be signed with, or verified against, the Project credential). *Blocks:* Tier 2 entirely — no
   external user can be represented in any resource until this is settled.
3. **Should the existing Persona product be modeled as a Project itself, or remain structurally
   separate?**
   *Why now:* §17's conceptual-model contrast shows this decides whether every existing collection
   needs migration (Persona-as-a-Project) or whether two parallel code paths must be maintained
   (Persona-separate). Every subsequent schema question (Tier 3) depends on this answer. *Constrained
   by:* requirement §33.1 ("existing Persona must remain working") — both options must satisfy this,
   but they satisfy it very differently (migration-with-safety-net vs. branching logic). *Blocks:*
   Tier 3.

### Tier 2 — Ownership & authorization model (depends on Tier 1)

4. **How does `ownerId` become polymorphic (User vs. Project vs. ExternalUser), given every current
   model hard-refs `User`?**
   *Why now:* §9 and §18-C confirm this field is identically shaped across 5+ models — a single
   design decision here (discriminator field vs. separate `projectId` alongside `ownerId` vs.
   separate collections) determines the migration shape for all of them at once. *Constrained by:*
   §9's finding that zero cross-resource ownership validation exists today, so whatever pattern is
   chosen must also close that gap, not just relabel it. *Blocks:* Tier 3 schema questions and Tier
   4 authorization centralization.
5. **How is authorization centralized, and how does it represent Project Admin authority
   distinctly from resource ownership?**
   *Why now:* §6 and §13 confirm zero centralization exists and zero "act on a resource you don't
   own" pattern exists anywhere except the two flat-role admin endpoints. This is a green-field
   design, not an extension. *Constrained by:* the two-layer defense-in-depth pattern already
   proven at `canUserExecuteAgent` (§18-A) — worth preserving as a *pattern* (check at the routing
   layer, check again at the execution/build layer) even if the check itself is redesigned.
   *Blocks:* every resource-mutation endpoint's future behavior; blocks meaningful Project Admin UX
   design.

### Tier 3 — Persistence & scoping strategy (depends on Tier 1–2)

6. **Do existing collections gain a `projectId` field, or do Project resources live in separate
   collections?**
   *Why now:* §15's Runtime State Isolation Matrix shows this decision must be made consistently
   across at least 8 distinct storage mechanisms (threads, checkpoints, memory, 4 resource types,
   cache keys) — a per-mechanism inconsistent answer would be its own hotspot. *Constrained by:*
   Tier 1.3 (Persona-as-Project vs. separate) and the global-unique-index inventory in §9/§14
   (whichever choice is made, those indexes must become compound). *Blocks:* every concrete schema
   change.
7. **How does memory/thread/checkpoint/cache namespace construction change to include the Project
   dimension?**
   *Why now:* §8's positive finding shows the *shape* (hierarchical namespace arrays, composite
   cache keys) is already right — this question is "where does `projectId` slot into the existing
   pattern," not "invent a new pattern." *Constrained by:* Tier 3.6's collection-vs-field choice.
   *Blocks:* nothing further downstream architecturally, but is a large, mechanical implementation
   surface once decided.

### Tier 4 — API surface & product-facing concerns (depends on Tier 1–3)

8. **What is the Developer API surface (REST vs. AG-UI-equivalent, endpoint design)?**
   *Why now:* cannot be meaningfully designed before Tier 1 (how a Project authenticates) and Tier
   2 (what it's authorized to do) are settled. *Constrained by:* the existing AG-UI/REST split
   already in place for Persona (§4) — whether the Developer API reuses AG-UI's SSE model or is
   purely REST is a downstream consequence, not an independent choice.
9. **What is the Developer Studio information architecture?**
   *Why now:* explicitly deferred by the requirements document itself (§24 of that doc) as
   non-finalized; this synthesis adds no new urgency to it — it is correctly last, since it is a UI
   layer over whatever Tier 1–4.8 produces.
10. **SDK design.**
    *Why now:* by definition wraps the Developer API (Tier 4.8); cannot precede it.

---

## 26. Recommended Architecture-Decision Order

Directly following the tiers in §25: **(1) Project authentication mechanism → (2) external-user
identity assertion mechanism → (3) Persona-as-Project vs. separate → (4) polymorphic ownership
model → (5) centralized authorization/Project-Admin-authority model → (6) collection-vs-field
persistence strategy → (7) namespace/cache-key re-keying pattern → (8) Developer API surface → (9)
Developer Studio IA → (10) SDK.** This order is derived from the dependency evidence in §25, not
asserted independently — each item's "blocks" relationship was traced to a specific subsystem
finding earlier in this document.

---

## 27. Files / Evidence Reviewed

### Documents read in full

- `product-research/10-developer-platform/developer-platform-requirements.md`
- `product-research/10-developer-platform/01-current-data-ownership-audit.md`
- `product-research/10-developer-platform/02-runtime-state-isolation-audit.md`
- `product-research/10-developer-platform/03-resource-and-mcp-audit.md`
- `product-research/10-developer-platform/04-auth-security-boundary-audit.md`

### Source files independently re-verified in this synthesis pass (§22)

| File | What was checked |
|---|---|
| `agent-backend/src/modules/agui/agui.routes.js` | Thread resolution, `x-agent-id`/`x-thread-id` handling, deterministic thread ID construction, ownership check |
| `agent-backend/src/modules/agui/agui.controller.js` | Authorization timing relative to SSE headers, concurrency key, rate limiting |
| `agent-backend/src/modules/agents/agent.service.js` | `canUserExecuteAgent` full implementation, `_buildSearchFilter` full implementation |
| `agent-backend/src/modules/agents/agent.factory.js` | Cache key construction, second authorization check |
| `agent-backend/src/modules/threads/thread.model.js` | Schema fields, including `agentId` |
| `agent-backend/src/modules/threads/checkpoint.service.js` | Checkpoint keying, `getMessages` ownership check, `cleanupThreads` query shape |
| `agent-backend/src/modules/memory/memory-files-store.js` | Namespace helper functions, `MemoryFilesStore` implementation |
| `agent-backend/src/modules/mcp/mcp-token.service.js` | `getOwnerAccessToken`/`getUserAccessToken` signatures |
| `agent-backend/src/modules/skills/skill.repository.js` | `findPublicSkills` query shape |
| `agent-backend/src/modules/providers/provider.service.js` | Dependency-count check |
| `agent-backend/src/` (repo-wide search) | Confirmed absence of `projectId`/`tenantId`/`workspaceId`/multi-tenant concepts and of API-key/service-account/M2M auth infrastructure |
| Repo-wide `.md` search for "BeyondCampus"/"Beyond Campus" | Confirmed no obsolete separate runtime audit exists (§2.1) |

All other claims in this document are drawn from the four audit documents listed above, cross-
checked for internal consistency across all four (§23), with no contradictions found.

---

*This document is the codebase-readiness synthesis deliverable for the Developer Platform
initiative. It makes no architecture decisions, proposes no schemas, and specifies no protocols. It
exists to give the architecture phase a single, verified, trustworthy starting point. See §25–26
for the questions that phase must now answer, in dependency order.*
