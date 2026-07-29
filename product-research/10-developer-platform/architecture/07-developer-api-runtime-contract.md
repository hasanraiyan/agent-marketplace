# Architecture Decision 07 — Developer API & Runtime Contract

> **Status:** DECIDED (this document). Scope: the API/runtime contract connecting an authenticated
> Project to the primitives AD-01–AD-06 already established — control-plane vs runtime-plane
> boundaries, request-context types, machine vs human authority, the externalUserId wire mechanism,
> and how execution reuses AG-UI. Starts strictly after AD-01–AD-06 — none is reopened.
> **Explicitly NOT decided here:** exact OpenAPI spec, every endpoint URL/JSON field, exact
> Project/ExternalUser Mongo schemas, RBAC permission matrix, billing implementation, quota
> algorithms, Developer Studio UI/IA, SDK method names, frontend/backend implementation,
> cross-Domain sharing, a browser-safe runtime-token mechanism.
> **Inputs:** requirements, synthesis, `architecture/01–06-*.md`, and **fresh source reads
> performed for this decision** (§4).
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION:** The Developer API mounts as a **structurally distinct middleware chain** on the same
Express application/process as Persona's existing API — reusing shared infrastructure (formatters,
error handler, rate-limiter service, DB connections) but **never** the Clerk-derived `req.user`
chain (§31). **Control plane and runtime plane are not separate top-level namespaces** — they are
**context-derived**: for resource types AD-04 allows both `Project` and `ExternalUser` to own
(Agents, Skills, Knowledge, MCP definitions), the same endpoint serves both planes, and ownership is
derived from **which authenticated context accompanies the call** (presence/absence of an asserted
`externalUserId`), never from a client-supplied field. For resource types with no
`ExternalUser`-ownable form (Project configuration, credentials, membership, Provider secret
management), the API is control-plane-only by direct, mechanical consequence of AD-04's ownership
taxonomy — not a URL-aesthetics choice (§9).

Three request-context types are established: **ProjectMachineContext** (AD-01 credential alone),
**ProjectRuntimeContext** (AD-01 credential + AD-02 externalUserId assertion), and
**ProjectAdminContext** (Clerk-authenticated human + verified Project membership, AD-04 §6). Machine
authority is **real but bounded**: a leaked Project credential may administer Project-owned
resources and act as any of the Project's own external users (by AD-02 design), but **may not**
delete/suspend the Project, manage human Project Admin membership, perform bulk operations spanning
many external users at once, or read an arbitrary external user's conversation content outside a
legitimate runtime-context request made *as* that user (§11).

`externalUserId` travels as a **single, dedicated request header**, used consistently across every
runtime-plane-capable REST and AG-UI call — not in the body, not in the path (§13). Agent execution
reuses AG-UI **exactly as-is** at the runtime layer, behind a **new, Project-authenticated route**
(§20) — never a generalized, dual-auth version of the existing Clerk route.

---

## 2. Context

AD-01–AD-06 established authentication, external-user identity, the Domain boundary, ownership,
persistence enforcement, and Provider resolution — each a primitive. None of them defined the
*contract* an external product actually calls. This decision is where those primitives become a
concrete (though not yet field-level-specified) API surface, sufficient for later decisions
(Developer Studio, SDK) to build on without reopening trust-boundary questions.

---

## 3. Inherited Architecture (Restated, Unweakened)

From AD-01: Project identity is cryptographically derived from the credential, never caller input.
From AD-02: `(projectId, externalUserId)` is the runtime identity; the Project is authoritative for
its own users; no additional signature is needed for the assertion itself. From AD-03: Project is
the hard Domain boundary; Persona is a Domain but never a Project. From AD-04: ownership is
`(Domain, OwnerType, OwnerIdentity)`; Creator ≠ Owner ≠ Authority ≠ Runtime Actor; runtime state uses
Subject semantics. From AD-05: every lookup is Domain-qualified; missing Domain is an error. From
AD-06: Provider secrets are never returned after submission; no cross-Domain or automatic
credential/model failover exists; Provider usage ≠ ownership.

---

## 4. Current Persona API Findings (Fresh Research, This Decision)

Traced directly from source, not merely cited.

**FACT:** one Express app (`src/index.js`), CORS applied with `cors()` — **no origin restriction
configured** — every route mounted at `/api/v1/*`. `clerkMiddleware()` is mounted globally, before
route registration, and parses (but does not require) a Clerk session on *every* subsequent request
— a real fact this decision must account for when mounting a new, non-Clerk middleware chain
alongside it (§31).

**FACT — four already-coexisting auth postures on one app** (re-confirmed, extending the finding
AD-01 §13 already relied on): `/api/v1/webhooks` mounted **before** `clerkMiddleware()`, raw body, no
auth at all; `authMiddleware`-required routes (Agents mutate, Threads, Providers); `optionalAuthMiddleware`
routes (Agent public GET/search); `adminMiddleware`-gated routes. **This is the direct precedent
for adding a fifth posture** (Project-credential-authenticated Developer routes) without disrupting
the other four.

**FACT — AG-UI's special mounting order:** `/api/v1/agui` is mounted **before** `express.json()`
specifically because it reads its own raw request body — any Developer-facing AG-UI route inherits
this exact ordering constraint (§20, §41).

**FACT — response/error envelope, reusable infrastructure, not Persona-specific:**
`{success, statusCode, message, data, timestamp}` (success), `{success:false, status:'error',
statusCode, message, code, timestamp}` (error, already carries a machine-readable `code` field — a
direct precedent for a Developer-specific error-code taxonomy, §28). `formatList` implements
**offset-based pagination** — `{items, pagination:{total, page, limit, pages}}` — with no maximum
page-size cap today.

**FACT — MCP OAuth callbacks already deliberately skip authentication**: `mcp.routes.js`'s own
comment states owner/user callbacks "deliberately do NOT use authMiddleware... identity is recovered
from signed state" — this is **exactly** the pattern AD-02 §16 anticipated extending with a Domain
dimension, not something this decision invents (§25).

**FACT — Thread routes**: explicit `POST /threads` (requires `agentId`) coexists with AG-UI's own
lazy, deterministic-fallback thread creation (AD-05 §14) — both models are already live today, not
hypothetical (§21).

**FACT — no idempotency-key concept exists anywhere** in the codebase (confirmed by direct search) —
genuinely greenfield territory for this decision (§27).

**FACT — rate limiter** (`rateLimiter.middleware.js`) keys by `req.user._id` or IP, returns standard
`X-RateLimit-*`/`Retry-After` headers — a directly reusable shape, extended per AD-05 §21's
already-decided Domain-qualified key matrix (§33).

---

## 5. API Boundary Options

**Option A — separate top-level namespaces by plane** (e.g. a `/control/...` prefix and a
`/runtime/...` prefix). Evaluated and found to force an artificial split: resource types like Agents
genuinely span both planes (AD-04), so splitting by plane would either duplicate the Agent-CRUD
contract across two namespaces or leave one namespace only partially handling a resource type.

**Option B — same namespace, plane derived from authenticated context.** Matches AD-02 §13's
already-decided finding that `externalUserId` is optional at the protocol level — its
presence/absence is precisely what should determine plane, for resource types that have both forms.

**Option C — resource-driven hybrid (selected).** Not a third independent structural choice so much
as the recognition that **Option B applies exactly where AD-04's ownership taxonomy allows both
`Project` and `ExternalUser` ownership**, and resource types with **no** `ExternalUser`-ownable form
(Project config, credentials, membership, Provider secret operations) are control-plane-only as a
**direct, mechanical consequence of AD-04**, not an independent URL decision. This is what the task
brief asks for explicitly: authority and trust boundaries, not URL aesthetics.

---

## 6. Comparison Matrix

| Criterion | A. Plane-namespaced | B. Context-derived, uniform namespace | C. Resource-driven hybrid (selected) |
|---|---|---|---|
| Security isolation | Equal — enforcement is at the auth-context layer either way | Equal | Equal |
| Clarity of authority | Misleading — suggests URL alone determines authority, when context does | Clear once understood, but doesn't explain *why* some resources have only one namespace | Clearest — directly traceable to AD-04's ownership taxonomy per resource type |
| Persona compatibility | N/A (Developer-only) | N/A | N/A |
| Project backend ergonomics | Worse — duplicate contracts for dual-ownership resources | Best — one contract per resource type | Best — same as B, with control-plane-only resources correctly *not* pretending to have a runtime form |
| Implementation complexity | Higher — two contracts to keep in sync per dual-ownership resource | Lower | Lower, same as B |
| Confused-deputy risk | Higher — URL might be (wrongly) treated as an authority signal | Lower — authority always comes from context, never URL | Lower, same as B |
| Long-term maintainability | Degrades as more dual-ownership resource types are added | Stable | Stable, and self-documenting via the ownership taxonomy |

---

## 7. Selected API Boundary

**DECISION: Option C.** §1 restates the concrete rule.

---

## 8. Principal / Request Context Model

Field names illustrative only, per this series' established convention.

| Context | Established by | Trusted | Derived | Untrusted (never accepted as input) |
|---|---|---|---|---|
| **ProjectMachineContext** | AD-01 credential alone | `domain`/`projectId`, `credentialId` | — | any caller-supplied `projectId`, `ownerType`, `ownerId` |
| **ProjectRuntimeContext** | AD-01 credential + AD-02 header assertion | `domain`, `credentialId`, `externalUserId` (**trusted-as-asserted-by-the-Project**, AD-02 §14's exact label, reused verbatim) | the compound `(domain, externalUserId)` pair | same as above, plus any profile metadata (display name/email) |
| **ProjectAdminContext** | Clerk session (first-party) + verified Project membership | Persona User identity (Clerk) | **which Project(s)** this human administers — a membership *lookup* keyed off the Clerk identity, not a bearer credential the way `domain` is in the other two contexts | any caller-asserted Project ID not backed by an actual membership record |

**DECISION: ProjectAdminContext never asserts an externalUserId.** A human Project Admin's Clerk
session is a categorically different trust chain than AD-02's delegated Project-backend assertion —
letting a human "act as" a specific external user would be a new, undecided trust mechanism outside
AD-02's scope. ProjectAdminContext acts only as the Project's own administrative authority or
inspects/administers specific named resources by ID — never impersonates a runtime Subject.

**DECISION: downstream code must always know which context type it received**, not merely whether
*some* identity object is present — directly reusing AD-01 §13's and AD-04 §6.5's established
discipline against conflating structurally different identity carriers, now applied at this
boundary specifically.

A fourth, narrow context — **PlatformAdminContext** — exists per AD-04 §19/AD-05 §24, but is
explicitly **not part of the Developer API's public surface** — it belongs to Persona's own internal
support/moderation tooling, never something a Project presents (§38-#18).

---

## 9. Control Plane

Defined precisely by AD-04's ownership taxonomy, not by URL: capabilities with **no**
`ExternalUser`-ownable form are control-plane-only, regardless of which context calls them (subject
to the machine-vs-admin authority split, §11):

Project configuration, Project credentials (AD-01), Project membership/admin roles (AD-04 §6, §18),
Project-owned resource management when acting **without** an asserted external user
(System Agents, Project Skills/Knowledge/MCP definitions, Provider records, Project default
Provider/model), moderation actions over external-user-owned resources under Project Admin
authority.

---

## 10. Runtime Plane

Capabilities that operate on behalf of, or as, a specific `(Domain, externalUserId)`: creating/
managing an external user's own Agents/Skills/Knowledge/MCP (where requirements permit,
requirements §18), Agent execution, thread creation/resume/read, file upload/retrieval tied to that
Subject, MCP user-mode OAuth initiation/status/disconnect, external-user-scoped discovery ("my
Agents"). **DECISION:** every runtime-plane endpoint requires ProjectRuntimeContext specifically —
ProjectMachineContext alone is insufficient (there is no Subject to scope the operation to).

---

## 11. Machine Authority

**The critical question, answered against the task's explicit checklist — Option B: the Project
credential carries a defined machine authority, narrower than full human Project Admin authority in
specific, high-blast-radius areas.**

| Action | Machine credential alone (ProjectMachineContext) sufficient? | Reasoning |
|---|---|---|
| Manage Project-owned resources (Agents/Skills/Knowledge/MCP/Provider CRUD, rotate Provider secret) | **Yes** | Routine, reversible, server-to-server automation is exactly what Project credentials exist for |
| Act as / assert any of the Project's own external users | **Yes** | Already the accepted, by-design delegation from AD-02 §15 — not a new grant, a reaffirmation |
| Per-resource moderation of a specific, identified user-owned resource | **Yes** | Legitimate automation (e.g. an abuse-detection pipeline disabling one flagged Agent), consistent with AD-04 §18's general Project Admin authority scope |
| **Delete/suspend the Project itself** | **No — requires ProjectAdminContext** | Catastrophic, hard-to-reverse; a bare leaked secret should not be able to end the Project's existence |
| **Manage human Project Admin membership** (add/remove admins) | **No — requires ProjectAdminContext** | A leaked machine credential must not be usable to grant an attacker *persistent, human-level* control that survives the credential's eventual rotation |
| **Bulk operations spanning many external users' resources at once** | **No — requires ProjectAdminContext** | Blast radius of a leaked credential should not scale to "delete every user's Agents in one call"; a single flagged resource is fine (above), a sweep is not |
| **Reading an arbitrary external user's conversation content outside a legitimate runtime-context request as that user** | **No, by default** — flagged **OPEN** for a future, narrow, explicitly-justified capability, not a routine one | Directly extends AD-04 §24-#11's reasoning (administrative authority over an MCP definition doesn't extend to reading individual credential contents) to conversation content — a Project reading *its own user's own conversation, asserted as that user* is legitimate (e.g., displaying history in its own UI); a Project's bare machine credential reading arbitrary users' content without asserting them is not |

**Option C (full scoped-credential system)** remains explicitly deferred, consistent with AD-01's
original deferral — this decision establishes only the **minimum** authority split needed for v1
safety, not a granular permission/scope engine.

---

## 12. Human Project Admin Authority

Everything Machine authority permits, **plus** the carve-outs in §11 (Project deletion/suspension,
membership management, bulk operations). Authenticated via Clerk (ProjectAdminContext, §8) —
structurally the same first-party mechanism Persona's own product already uses, reused per AD-04
§6.4's already-established finding, not rebuilt.

---

## 13. External User Assertion Wire Contract

**DECISION: Option A — a single, dedicated request header**, used identically across every
runtime-plane-capable REST and AG-UI call. Evaluated against the task's criteria:

- **Consistency** — one mechanism for every call shape, not resource-by-resource (Option C
  rejected: unjustified inconsistency for no evidenced benefit).
- **Works uniformly across HTTP methods** — the decisive, concrete reason a header beats a body
  field (Option B rejected as the sole mechanism): GET/list runtime-plane endpoints ("list Sabik's
  own Agents") need the assertion too, and REST GET conventionally carries no body. A header is the
  only mechanism available on every method equally.
- **Matches existing precedent** — AG-UI already uses `x-agent-id`/`x-thread-id` headers (**FACT**,
  §4) for exactly this kind of per-request metadata; extending the same convention is consistent,
  not novel.
- **SDK ergonomics** — a client library sets one header consistently, regardless of endpoint —
  simpler than tracking which endpoints expect body vs. path placement.
- **Option D (short-lived runtime token)** — this is AD-02's already-rejected Option D (AD-02 §10,
  §20.2); not reopened, not reintroduced here under a different name.

**DECISION:** each endpoint's contract explicitly states whether the header is **required**
(pure runtime-plane), **forbidden** (pure control-plane-only, e.g. Project membership management),
or **optional-and-ownership-determining** (the shared, dual-ownership resource endpoints, §1). The
header's *value* is always interpreted **inside** the already-authenticated Project (AD-02) — a
caller can never pair it with a different, self-asserted `projectId`, because `projectId` is never
read from the request at all (AD-01, reaffirmed).

---

## 14. Ownership Derivation

**DECISION, the single most important rule in this document, directly enforcing the quality bar's
repeated demand:** the request body **never** contains `ownerType`, `ownerId`, or `domainId` fields.
Ownership of a newly-created resource is derived **exclusively** from which authenticated context
made the call:

- `ProjectMachineContext` (no externalUserId header) creating a dual-ownership resource →
  `Owner = Project` (the Project itself, per AD-04 §8.1 — no further identity beneath it).
- `ProjectRuntimeContext` (externalUserId header present) creating the same resource type →
  `Owner = (Domain, ExternalUser, <the asserted externalUserId — always the caller's own asserted
  value, never a different one>)`.
- `Domain` is never client-supplied at any point — always the trusted value from the authenticating
  context (AD-01/AD-05).

A single endpoint per resource type serves both outcomes — **not** because minimizing endpoint count
is a goal in itself (task's explicit warning), but because splitting into separate
`/system-agents`/`/user-agents`-style endpoints would still need this exact same context-derivation
logic underneath, so splitting buys no additional safety, only duplicated surface area to keep in
sync.

---

## 15. API Capability Matrix

| Capability | Plane | Allowed principal | Required context | Ownership/subject semantics | Protocol | Notes |
|---|---|---|---|---|---|---|
| Project configuration | Control | Machine or Admin | ProjectMachineContext / ProjectAdminContext | `Owner = Project` implicitly (the Project itself) | REST | — |
| Project credentials (create/rotate/revoke) | Control | Machine or Admin | Either (§11: routine) | N/A (AD-01 credential, not a Domain resource) | REST | Never returns the secret after creation (AD-01 §9.2) |
| Project deletion/suspension | Control | **Admin only** | ProjectAdminContext | N/A | REST | §11 carve-out |
| Project Admin/member management | Control | **Admin only** | ProjectAdminContext | N/A | REST | §11 carve-out |
| Project-owned Agent CRUD | Control | Machine or Admin | ProjectMachineContext (no header) | `Owner = Project` | REST | §14 |
| ExternalUser-owned Agent CRUD | Runtime | Machine, asserting a Subject | ProjectRuntimeContext | `Owner = (Domain, ExternalUser, subject)` | REST | §14 |
| Project discovery (list Project's own Agents) | Control | Machine or Admin | ProjectMachineContext | Domain-scoped, AD-03 §13 | REST | Never queries Persona's marketplace function (§38-#8) |
| External-user discovery ("my Agents", Project-public browse) | Runtime | Machine, asserting a Subject | ProjectRuntimeContext | Domain-scoped + Subject-scoped for "mine" | REST | Same isolation guarantee |
| Skill CRUD | Both | Per resource's actual owner | ProjectMachineContext or ProjectRuntimeContext | Same pattern as Agents | REST | Requirements §18 permits user-owned Skills |
| Knowledge CRUD | Both | Per resource's actual owner | Same | Same pattern | REST | Same |
| MCP definition CRUD | Both | Per resource's actual owner | Same | Same pattern | REST | AD-06's definition-ownership model |
| MCP user OAuth initiation | Runtime | Machine, asserting a Subject | ProjectRuntimeContext | `Subject`-scoped, AD-02 §16 | REST (redirect) | §25 |
| MCP user OAuth callback | Runtime | **Nobody — identity from signed state** | None (deliberately unauthenticated) | Recovered from state, not the request | REST (redirect target) | §25, reuses existing pattern |
| MCP user connection status/revoke | Both | Runtime (self) or Admin (administrative action only) | ProjectRuntimeContext (self) or ProjectAdminContext/ProjectMachineContext (revoke-as-action) | Status/metadata only for Admin; never credential contents (AD-04 §24-#11) | REST | §16 |
| Provider management (CRUD, metadata) | Control | Machine or Admin | Either (§11: routine) | `Owner = Project` | REST | AD-06 |
| Provider secret rotation | Control | Machine or Admin | Either (§11: reversible, routine) | Same | REST | Never returns plaintext (AD-06 §16) |
| Agent execution | Runtime | Machine, asserting a Subject (or Project-level for System Agent calls, AD-02 §13) | ProjectRuntimeContext (or ProjectMachineContext for pure control-plane execution) | Subject-scoped runtime state | **AG-UI/SSE** | §20 |
| Thread list/get | Runtime | Machine, asserting a Subject | ProjectRuntimeContext | Domain+Subject scoped | REST | §21 |
| Thread create | Runtime | Machine, asserting a Subject | ProjectRuntimeContext | Same | REST or lazy via AG-UI | §21 |
| Thread resume | Runtime | Machine, asserting a Subject | ProjectRuntimeContext | Domain+Subject+**Agent** all verified (§21) | AG-UI | Closes AD-05 §14's gap at the contract level |
| File upload/access | Runtime | Machine, asserting a Subject | ProjectRuntimeContext | Domain+Subject scoped, mediated access | REST | §22 |
| Ratings/reviews | — | — | — | — | — | **NOT EXPOSED IN V1** — synthesis confirms this is a largely-unimplemented product gap even in current Persona; no evidence justifies building it for the Developer Platform first |

---

## 16. Project/System Agent Management

Reaffirms §14 directly: `POST .../agents` with `ProjectMachineContext` (no externalUserId header)
→ `Owner = Project`; the caller (machine or admin) is recorded as `Creator` per AD-04 §20, never as
`Owner`. Update/delete/visibility-change follow the same Project Admin authority rules as any other
Project-owned resource (AD-04 §12).

---

## 17. ExternalUser Agent Management

`POST .../agents` with `ProjectMachineContext` + externalUserId header (the Project backend acting
on Sabik's behalf, having already authenticated Sabik itself) → `Owner = (Domain, ExternalUser,
sabik)`. **DECISION:** this is the expected, common path for user-created Agents — the Developer
Platform does not require an external user to somehow call the API "directly" (they never hold
Project credentials, AD-02 §4); the **Project's own backend** always makes the call, asserting the
Subject, exactly matching the trust model AD-02 established.

---

## 18. Resource APIs

Skills, Knowledge, and MCP definitions follow the identical shape as Agents (§14, §16–17) — same
context-derived ownership rule, same dual-plane endpoint pattern where AD-04 permits both ownership
forms. Providers do not (§11, §15): control-plane-only, per AD-04's `OwnerType ∈ {PersonaUser,
Project}` (no `ExternalUser` form exists to serve on the runtime plane).

---

## 19. Discovery Contract

**DECISION, directly enforcing the task's explicit hard requirement:** Developer API discovery
services (Project-wide Agent listing, external-user's-own-Agents listing, Project-public browse)
must be **entirely separate code paths/query functions from Persona's marketplace search** — even
where they share a lower-level, Domain-scoped query-building helper (AD-05 §10), the *discovery
service layer itself* must not be the same function Persona's `/api/v1/agents/search` calls. This is
an explicit implementation constraint (§41), not merely an aspiration: sharing the actual service
function would create a single point where a future change could accidentally reintroduce
cross-Domain leakage in both surfaces at once. Unlisted-Agent direct access (by ID, with the
requester already knowing the ID) and private-Agent access follow AD-04 §21's visibility rules
unchanged, evaluated within the caller's Domain only.

---

## 20. Agent Execution / AG-UI Contract

**DECISION: a new, Project-authenticated AG-UI route, sharing the existing runtime layer
underneath — not a generalized dual-auth version of the existing Clerk route, and not a new
protocol.**

Reasoning: AD-01 §13 already established that Project authentication must be a **structurally
separate middleware chain**, never blended into the Clerk chain — trying to make one AG-UI endpoint
conditionally accept *either* Clerk *or* Project auth would directly recreate the confused-deputy
risk AD-01 §13 and AD-04 §6.5 both explicitly warned against. The clean resolution: a **new route**
(illustrative path, not locked) using the Developer middleware chain, which — once it has produced a
`ProjectRuntimeContext` — calls the **exact same** `runAgentAsAguiEvents` / `AgentFactory.buildAgent`
/ AG-UI event-translation machinery the existing Persona route already uses, parametrized by
`(Domain, Subject)` per AD-05/AD-06's already-decided shapes. **The route is new; the runtime is
shared** — directly satisfying "do not create separate runtime implementations."

```
Developer Backend
  |  Project credential + externalUserId header + x-agent-id + x-thread-id (existing convention, §4)
  v
Developer AG-UI Route (NEW — Project-authenticated middleware, same raw-body-before-json
  |                       mounting-order constraint as today's /api/v1/agui, FACT §4)
  |
  |  produces ProjectRuntimeContext
  v
Shared runtime boundary (REUSED, unmodified in kind)
  |  resolve Domain, resolve Subject (AD-02/03)
  |  authorize Agent (AD-04 ownership + visibility)
  |  resolve Thread (AD-05 §14 — Domain+Subject+Agent, §21 below)
  |  resolve Provider (AD-06's algorithm, Domain-qualified)
  v
AgentFactory / DeepAgent / AG-UI event stream (UNCHANGED protocol)
```

No new streaming protocol is invented — AG-UI's existing SSE event shape is preserved exactly.

---

## 21. Thread Contract

**DECISION, directly closing the API-contract-level gap the task requires:** callers must supply
**both** `agentId` and, when resuming, `threadId` — but **`threadId` alone must never be trusted as
authorization.** The server independently verifies the resumed thread's stored `(Domain, Subject,
Agent)` against the current request's authenticated `(Domain, Subject)` **and** the requested
`agentId`, per AD-05 §14's already-decided invariant. This decision does not implement that
verification (explicitly out of scope) — it establishes the **API contract requirement** that makes
the eventual fix meaningful: the caller-supplied `agentId` on every resume call is not optional
metadata, it is a required input the server is expected to check.

**Thread creation:** both existing models are preserved for the Developer API (**FACT**, §4 — both
already coexist in current Persona): explicit `POST .../threads` (caller manages a stable handle
before the first message) and lazy creation via the first AG-UI execution call (no `threadId`
supplied; the server generates one, using the Domain-extended deterministic construction from AD-05
§14). **The server always generates the actual thread identifier** — a caller never supplies its own
value for a new thread.

**Host-application correlation ID:** **DECISION** — an **optional**, opaque, host-supplied metadata
string may be accepted and echoed back for the host's own correlation purposes (e.g. Beyond Campus's
own internal conversation-object ID) — **never** used for lookup, authorization, or identity, exactly
mirroring AD-02 §12's Identity-vs-Profile-Metadata distinction applied to threads. Exact field
mechanics are **OPEN** (§40) — per the task's explicit instruction not to over-engineer
synchronization with host-app conversation models, no two-way sync, webhook, or reconciliation
mechanism is designed.

---

## 22. File Contract

**DECISION:** file operations require **ProjectRuntimeContext at minimum** — every file is
attributable to some `(Domain, Subject)` pair (AD-04 §15.3, AD-05 §20). Agent/Thread association is
**contextually optional**: a durable, Domain-owned asset (e.g. a Knowledge source) doesn't need a
Thread; an in-conversation attachment naturally does. Retrieval/download **must be mediated** —
every file GET passes through an authorization check verifying the requester's `(Domain, Subject)`
against the file's owning `(Domain, Subject)`, or genuine Project Admin authority over it — **never**
a bare static URL, directly reaffirming AD-05 §20's binding requirement, not merely restating it as
optional advice.

---

## 23. MCP Definition Contract

Follows §18's dual-plane resource pattern exactly: MCP definitions may be Project-owned (control
plane, machine/admin-managed) or ExternalUser-owned (runtime plane, per requirements §18) —
`authMode`/`ownerToken` mechanics themselves are AD-06's, unmodified.

---

## 24. MCP Runtime User OAuth Contract

**DECISION, reusing AD-02 §16/AD-06 §16 exactly, given API shape:**

- **Initiate:** `ProjectRuntimeContext` required (a Subject must be asserted — "connect Rahul's
  Google Calendar" needs to know it's Rahul).
- **Status:** `ProjectRuntimeContext` (self) returns full status for that Subject; `ProjectAdminContext`
  / `ProjectMachineContext` (administrative) returns **metadata/status only**, never credential
  contents, per AD-04 §24-#11/AD-06 §16.3 unchanged.
- **Disconnect/revoke:** either the asserting Subject themselves, or Admin/Machine as an
  **administrative action** — explicitly permitted (it's an action, not a contents-read) per AD-04's
  already-decided rule, reused here without modification.
- **Execution resolution:** entirely internal to the AG-UI/AgentFactory runtime layer (§20) — not a
  separate Developer API surface; consumes AD-06's resolution algorithm with the `(Domain, Subject,
  mcpId)` key AD-05 §17 already established.

---

## 25. OAuth Callback Contract

**DECISION, extending — not inventing — the existing signed-state mechanism (FACT, §4):** the
callback route remains deliberately unauthenticated (a browser redirect from an external OAuth
provider carries no Project-credential session, exactly like today). The signed state, created
**before** the redirect, must conceptually carry: Domain/Project, ExternalUser Subject, MCP
definition ID, return destination (if needed), and a nonce/expiry (**FACT**: `exp` already present
today). **DECISION, the hard rule the task requires:** any `projectId`/`externalUserId` that might
appear as a query parameter or header on the *callback request itself* must **never** be trusted
independently — **all** identity for the callback is recovered exclusively from the verified,
HMAC-signed state payload, never from the live request's own fields. This is a direct, evidence-
grounded extension of AD-02 §16 (which already anticipated exactly this extension), not a new
mechanism — no new signing scheme, payload format, or schema is decided here.

---

## 26. Provider Contract

Carries AD-06 forward exactly, with authority now assigned per §11: create/rotate/disable/set-
default/test-connection are machine-or-admin (routine, reversible); delete follows AD-06 §22's
Domain-scoped dependency guard. **No API ever returns plaintext, to any principal, under any
circumstance** (AD-06 §16, unmodified). External Users never directly manage Provider records
(AD-06 §17); external-user-owned Agents reference Project Providers per AD-06 §12's
Domain-boundary-is-sufficient-policy finding, unmodified.

---

## 27. Idempotency

**DECISION (sensible v1 contract, not "idempotency everywhere," per task instruction):** an
optional, caller-supplied idempotency key (illustratively an `Idempotency-Key`-style header — a
well-established server-to-server API convention, not invented here) is supported for
**resource-create operations** (Agent/Skill/Knowledge/MCP-definition/Provider creation — the classic
retry-creates-a-duplicate risk) and **MCP OAuth-initiation** (a retried initiation could create a
confusing duplicate flow). **Not required** for reads/lists/updates (no duplicate-creation risk),
**not required** for credential rotation (submitting the same new secret twice is harmless — the
second write simply wins), and **file upload is explicitly left OPEN** — upload retry/resumability
is more naturally handled by upload-protocol-level mechanisms than a generic idempotency key, and is
not designed here.

---

## 28. Pagination / Filtering

**DECISION:** preserve the existing offset-based convention (**FACT**, §4:
`{items, pagination:{total,page,limit,pages}}`) — consistency and infra reuse, no evidence demands
cursor-based pagination for this API. **New for the Developer API specifically:** an explicit,
architecturally-mandatory **maximum page size** (today's convention has no cap) — a minimal,
appropriate safeguard for a surface consumed by external, less-trusted callers than Persona's own
frontend. **Domain scope is always implicit**, never a widenable filter parameter (AD-05). Owner/
Subject filters operate only within the caller's own authorized scope (§8's context types). Stable
sorting requires a tiebreaker (e.g. creation timestamp + ID) to keep pagination stable across pages —
a standard requirement for any paginated API, stated here as a v1 requirement.

---

## 29. Error Model

**DECISION:** reuse the existing envelope shape (**FACT**, §4:
`{success:false, status:'error', statusCode, message, code, timestamp}`), extended with a
Developer-specific `code` taxonomy. Categories, explicitly split into **collapsed-for-security** and
**distinct-and-informative** groups, per the task's own worked example:

**Collapsed to an identical, not-found-shaped response** (directly reusing the already-proven
`canUserExecuteAgent` 404-not-403 pattern, **FACT**, reused throughout this decision series):
resource truly doesn't exist; resource exists but in a different Domain; thread exists but wrong
Subject; thread exists but wrong Agent. **DECISION:** internally, the system may log/audit these as
distinct cases — the HTTP response returned to the caller must be indistinguishable, preventing
existence-leakage across Domains or Subjects.

**Kept distinct** (no existence-leak risk, and distinguishing them helps legitimate integrators
build correct retry logic): authentication failure, invalid request (validation, existing Zod
convention), invalid external user (malformed/empty header where required — distinct from
authentication failure, since the *Project* is validly authenticated), rate limited (**FACT**
existing `RateLimitError`/`Retry-After` convention, reused), conflict (e.g. idempotency-key reuse
with a different payload), Provider unavailable / Agent unavailable (AD-06's explicit-failure
requirement, §11 of that decision), upstream model failure (distinguishing "your request was
invalid" from "the vendor had a problem" — useful for the caller's own retry logic).

---

## 30. Versioning

**DECISION: explicit, path-based versioning from day one**, matching the existing, proven Persona
convention (**FACT**, `/api/v1/...`) rather than introducing header/media-type versioning with zero
codebase precedent and no evidenced client benefit. This API is consumed by **independent products**
with a materially higher stability bar than Persona's own frontend (which the same team controls and
can evolve in lockstep) — the versioning **pattern** is decided; no v2 is designed. Once external
products depend on it, the `v1` label represents a real, honored contract-stability commitment, not
merely a convention — a process discipline worth stating explicitly, not a new technical mechanism.

---

## 31. REST vs. AG-UI

**DECISION:** management (CRUD on every resource type in §15) is REST/JSON, matching existing
convention exactly. Execution is **AG-UI/SSE exclusively** (§20) — never forced into conventional
REST (streaming is already solved) and never used for CRUD (AG-UI is not repurposed as a general
transport). This split falls directly out of the evidence already gathered (§4) and the prior ADs —
not an independent aesthetic choice.

---

## 32. API Namespace / Middleware Boundary

**DECISION:** the Developer API mounts under a **distinct top-level path prefix** (illustratively
`/api/developer/v1/...` — explicitly not locked, per task instruction, since the architectural point
is the middleware boundary, not the string). The prefix corresponds to a **structurally separate
middleware chain**: Project-credential authentication (AD-01) producing ProjectMachineContext/
ProjectRuntimeContext, or Clerk authentication plus membership verification producing
ProjectAdminContext (§8) — **never** `clerkMiddleware()`'s bare `req.user` reused or extended.
Directly precedented: `/api/v1/webhooks` already runs with **zero** Clerk middleware on the same app
today (**FACT**, §4) — a fifth posture is additive to an already-proven pattern (§4's four-postures
finding), not a novel architectural risk.

---

## 33. Browser / CORS Security

**FACT:** today's `cors()` is wide open — Persona's own posture, acceptable there because the actual
security boundary is the Clerk bearer token, not CORS itself. **DECISION for the Developer API:**
`ProjectMachineContext`/`ProjectRuntimeContext`-authenticated routes are **server-to-server only** —
Project credentials are server secrets (AD-01 §11, unmodified) and must never be presented from a
browser. Since non-browser HTTP clients aren't CORS-constrained in the first place, CORS itself isn't
the primary control here — but this decision explicitly recommends the Developer API surface **not
inherit or advertise** Persona's permissive CORS posture, as a defense-in-depth signal that these
routes are not browser-safe, an implementation-phase configuration choice, not new architecture.
`ProjectAdminContext` routes (Developer Studio, human-facing) are legitimately browser-facing and
reuse Persona's existing, working Clerk-session browser infrastructure unchanged.

**Explicit v1 determination:** no browser-safe runtime-token mechanism is built (AD-01 §11's
deferral, reaffirmed, not reopened). If a future client-side embeddable-widget need emerges, it
requires its own, separately-designed mechanism — **OPEN**, unchanged from AD-01.

---

## 34. Rate-Limit / Usage Attribution Inputs

**DECISION:** identity dimensions required — Domain (Project), `credentialId` (useful for
per-credential, not just per-Project, limits), ExternalUser Subject (runtime-plane per-user limits),
Agent, Provider/model (AD-06 §25's billing-attribution finding) — directly extending AD-05 §21's
already-decided key matrix, reusing the existing `rateLimiterService.buildKey(endpoint, identifier)`
shape (**FACT**, §4) with richer identifiers, not a new limiter. **DECISION:** control-plane and
runtime-plane rate limits should be **separable** (a Project shouldn't be able to starve its own
execution quota by hammering CRUD, or vice versa) — a low-cost architectural allowance (distinct
key namespaces), not a designed quota algorithm.

---

## 35. Audit Context

**DECISION:** every management action is attributable to exactly one of the three context types
(§8), and the resulting audit record must distinguish them precisely per the task's own examples:
"Project backend created System Agent" (ProjectMachineContext, no human), "Project Admin Raiyan
changed Provider" (ProjectAdminContext, specific human), "Project backend acting for Sabik created
user-owned Agent" (ProjectRuntimeContext, credential + asserted Subject), "Platform Admin disabled
Project resource" (PlatformAdminContext, AD-05 §24's separate, audited path). No new mechanism is
required beyond "always record which context type initiated the action, with its trusted fields" —
the context model (§8) already supplies everything needed; no audit schema is designed here.

---

## 36. Developer Studio Constraints

**DECISION, directly per task instruction:** Developer Studio must consume the **same** control-
plane semantics/API this decision establishes wherever practical — it authenticates as
`ProjectAdminContext` (§8, §12) exactly like any other Developer API caller with that authority, and
gains **no secret internal bypass**. Any capability Developer Studio's UI needs must be expressible
through this same contract; if a needed capability doesn't exist yet, that is a gap in the API, not a
justification for a hidden path.

---

## 37. SDK Constraints

**DECISION:** the SDK (not designed here) must be a pure convenience layer over this contract — every
capability an SDK exposes must be independently reachable through the raw Developer API/AG-UI
contract described here. No "SDK-only magic" (e.g. a capability that only works because the SDK does
something the raw API cannot express) is architected into this decision.

---

## 38. Persona Backward Compatibility

**DECISION:** existing Persona routes (`/api/v1/*`) remain exactly as they are — untouched,
unversioned-relative-to-this-decision, still Clerk-only. The model is:

```
Persona API (/api/v1/*, Clerk-only)   ───────┐
                                              ├── shared, Domain-aware services/runtime
                                              │   (AgentFactory, AG-UI translator, memory,
Developer API (/api/developer/v1/*, new)  ───┘    checkpoint service, MCP resolution, Provider
                                                   resolution — all per AD-01–AD-06)
```

Separate product/auth surfaces, shared safe infrastructure — directly the model the task diagram
describes, now confirmed consistent with every prior decision rather than newly invented.

---

## 39. Security Analysis

Threat-modeled against every item the task specified:

1. **Caller supplying another `projectId`** — impossible; never read from request input (AD-01,
   reaffirmed at every layer, §14).
2. **Caller supplying another `externalUserId`** — *within* the Project, this is the accepted,
   by-design delegation (AD-02 §15) — not prevented, correctly so; *across* Projects it's
   structurally impossible, since the Domain half of the compound key is never caller-supplied.
3. **Project credential used as human Admin credential** — prevented by §8's genuinely separate
   context types and §11's explicit carve-outs requiring ProjectAdminContext specifically.
4. **Machine credential with excessive authority** — mitigated by §11's authority table.
5. **External-user operation accidentally creating a Project-owned resource** — prevented by §14's
   clean, binary, header-presence-derived ownership rule.
6. **Project-admin operation accidentally taking ownership of a user resource** — prevented by
   AD-04's Creator≠Owner rule, reaffirmed: moderation actions never touch the `Owner` field.
7. **Cross-Domain resource IDOR** — AD-05's universal Domain-qualified lookup, reused unmodified.
8. **Global discovery leakage** — §19's explicit code-path-separation requirement (Developer
   discovery services are never the same function as Persona's marketplace search).
9. **Thread replay with wrong Agent / wrong Subject** — §21's contract requirement (both must be
   supplied and verified; `threadId` alone is never sufficient).
10. **MCP OAuth callback identity tampering** — §25, unchanged signed-state mechanism.
11. **Provider secret exposure** — §26, AD-06 unmodified: never returned, to anyone.
12. **Project secret used from browser** — §33: never legitimate; no browser-safe alternative built.
13. **Confused-deputy between Clerk auth and Project auth** — §8, §32: structurally separate
    context types and middleware chains, the discipline reused from AD-01/AD-04 and applied here.
14. **Unversioned API contract breaking external products** — §30: explicit path-based versioning
    from day one.
15. **Duplicate create requests** — §27: optional idempotency key for create operations.
16. **Error messages leaking resource existence** — §29: explicit collapsing of cross-Domain/
    cross-Subject/cross-Agent failures into an identical not-found response.
17. **Platform Admin bypass becoming generic unscoped access** — reaffirms AD-05 §24 exactly:
    PlatformAdminContext is **not part of the Developer API's public surface at all** (§8) — a
    Project can never present it, structurally, because it isn't a credential type the Developer
    API's authentication chain recognizes.

**Fail-closed posture, stated explicitly:** every ambiguous or missing piece of context (no Domain,
no Subject where required, mismatched Thread ownership) resolves to an explicit rejection —
consistent with every prior decision in this series, not a new posture introduced here.

---

## 40. Rejected Alternatives

**Option A boundary (plane-namespaced top-level split, §5)** — rejected: forces artificial
duplication for dual-ownership resource types.

**A single, fully polymorphic endpoint accepting client-chosen `ownerType`** — rejected outright;
directly violates the quality bar and every prior decision's "never trust caller-supplied ownership"
invariant (§14).

**Generalizing the existing Clerk AG-UI route to accept either auth type (§20)** — rejected;
recreates the exact confused-deputy risk AD-01/AD-04 already warned against.

**Full scoped-credential/permission system for machine authority (§11, Option C)** — rejected for
v1; no evidence justifies the complexity beyond the specific, named carve-outs decided here.

**Header/media-type API versioning (§30)** — rejected; no codebase precedent, no evidenced client
benefit over the already-proven path-based convention.

---

## 41. Open Questions

1. Exact path prefix for the Developer API (§32) — illustrative only here.
2. Exact host-application thread-correlation-ID field mechanics (§21) — deferred, kept minimal.
3. Whether/when the "Admin reads arbitrary user conversation content" capability (§11) is ever
   built, and under what explicit, audited justification.
4. Exact CORS configuration details for the Developer API surface (§33) — a configuration choice,
   not new architecture.
5. Exact idempotency-key semantics (TTL, conflict-detection payload comparison) — §27, deferred.
6. Whether control-plane/runtime-plane rate limits are separated at launch or added later (§34).

---

## 42. Implementation Constraints

Collected from §14, §19–22, §25, §29, §32 for visibility, non-binding on exact implementation:

- Ownership must be derived exclusively from authenticated context at resource-creation time; no
  `ownerType`/`ownerId`/`domainId` field may ever be read from a request body (§14).
- Developer discovery services must be implemented as code paths genuinely separate from Persona's
  marketplace search function, even where a lower-level query helper is shared (§19).
- Every Thread-resume operation must require and verify `agentId` in addition to `threadId`, never
  trusting `threadId` alone (§21).
- File retrieval must always pass through an authorization check; storage paths/keys are never
  treated as sufficient access control on their own (§22).
- OAuth callback handlers must recover all identity from verified signed state only, never from any
  field on the live callback request itself (§25).
- Cross-Domain/cross-Subject/cross-Agent failures must produce responses indistinguishable from a
  genuine not-found (§29).
- The Developer API's authentication middleware chain must be structurally distinct from
  `clerkMiddleware()`'s chain, mounted separately, never sharing a `req.user`-shaped context (§32).

---

## 43. Evidence / References

| Claim | Source |
|---|---|
| Single Express app, wide-open CORS, four already-coexisting auth postures | `agent-backend/src/index.js` — read in full this session |
| AG-UI raw-body mounting order before `express.json()` | `src/index.js` — read this session |
| Response/error envelope shape, offset-based pagination, no max page size | `src/utils/formatters/*.js` — read in full this session |
| MCP OAuth callbacks deliberately skip auth, identity recovered from signed state | `src/modules/mcp/mcp.routes.js` — read this session |
| Thread routes: explicit create + list/get/delete, `agentId` required at creation | `src/modules/threads/thread.routes.js` — read in full this session |
| No idempotency-key concept exists anywhere | Direct repo-wide search this session |
| Rate limiter keys by `req.user._id`/IP, standard headers | `src/modules/rateLimiter/rateLimiter.middleware.js` — read this session |
| Global error handler shape | `src/middlewares/errorHandler.js` — read in full this session |
| AD-01–AD-06 invariants reused throughout | `architecture/01–06-*.md`, cited inline per section |

---

*This document decides the Developer API boundary and runtime contract only. It establishes
context-derived control/runtime planes, three request-context types, bounded machine authority, a
single header for external-user assertion, and AG-UI reuse behind a new, Project-authenticated
route. It explicitly defers the exact API specification, Project/RBAC schema, Developer Studio UI,
and SDK design to later, separately-scoped decisions (§36–37, §41 record the constraints each
inherits).*
