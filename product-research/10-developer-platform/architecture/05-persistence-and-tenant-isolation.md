# Architecture Decision 05 — Persistence & Tenant Isolation

> **Status:** DECIDED (this document). Scope: how Domain isolation (AD-03) and the Owner/Subject
> model (AD-04) are actually represented and *enforced* at the persistence layer, so that
> forgetting tenant scope is difficult and, wherever practically achievable, fails closed. Starts
> strictly after AD-01–AD-04 — none is reopened.
> **Explicitly NOT decided here:** exact MongoDB field names/types, ObjectId vs. string
> representation, exact Project/ExternalUser/ProjectMembership schema, indexes, migration scripts,
> REST endpoints, Developer Studio screens, SDK APIs, RBAC permission matrix, Provider
> resolution/fallback/billing, cross-Domain sharing mechanisms.
> **Inputs:** requirements, synthesis, `architecture/01–04-*.md`.
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION: Option C — a hybrid tenancy model.** Shared MongoDB collections, a mandatory Domain
field, and a **repository-layer enforcement mechanism** (not the field alone) govern durable
resources (Agents, Skills, Knowledge Bases, MCP definitions, Providers, Threads, MCP user
connections). Memory extends its existing hierarchical namespace pattern with Domain as the **root**
component. Checkpoints — a third-party-owned schema with no tenant field available to add — are
isolated through **domain-aware key construction plus an application-layer gate**, not a stored
field. Qdrant **keeps its current collection-per-Knowledge-Base architecture** (already
domain-isolating by construction) rather than adopting MongoDB's field-based strategy, with
point-level Domain metadata added as a cheap defense-in-depth backstop. No per-Project physical
database or collection set is created — that is Option B, rejected as operationally
disproportionate to any evidenced need (§5, §28).

**The field is not the architecture.** The load-bearing mechanism is that domain-scoped
repositories **cannot be called without an explicit Domain context**, and that context is applied
through a **single, shared, mandatory query-scoping helper** every repository method must use — not
through developer discipline alone. A missing Domain context is treated as an **error**, never as
"search everywhere" (§10, §24).

---

## 2. Context

AD-03 established Domain as the isolation primitive and deliberately left Persona's existing data
unmigrated. AD-04 established the conceptual ownership/subject shapes,
`(Domain, OwnerType, OwnerIdentity)` and `(Domain, Subject, [Agent])`. Neither decided how these
shapes are actually stored, queried, or protected against the specific failure mode the synthesis
identified as the platform's single highest-severity risk: **unconditionally global queries with no
scope predicate at all** (synthesis §14, §20 Hotspots #1–#3). This decision closes that gap at the
architecture level.

---

## 3. Requirements / Inherited Invariants

From AD-01–AD-04, reused without modification: Domain is the hard isolation boundary (AD-03); no
resource crosses Domains by default (AD-03); ownership/subject values are only meaningful paired
with Domain, never bare (AD-02, AD-04); `Domain` must never be accepted from caller-supplied input,
only from authenticated context (AD-01, AD-02); Project Admin/Platform Admin authority is distinct
from ownership (AD-04); Persona must not be forced through an immediate live-data migration
(AD-03).

---

## 4. Current Persistence Architecture

**FACT** (synthesis, re-confirmed across AD-01–AD-04's evidence): every Mongo collection uses a
flat `ownerId`/`userId` field with no second dimension; global unique indexes exist on `slug`,
`qdrantCollectionName`, `clerkId`/`email`/`username`; checkpoints (`checkpoints`,
`checkpoint_writes`, via `@langchain/langgraph-checkpoint-mongodb`'s `MongoDBSaver`) have **no**
tenant field at all — a third-party-owned schema; memory uses a hierarchical namespace array
(`['users', userId, ...]`) already extensible in shape; Qdrant already isolates by giving each
Knowledge Base its **own** collection (`kb_<mongoId>_<randomHex>`), with no point-level tenant
metadata; uploads are stored flat, unscoped, served statically. **FACT**: the codebase already
enforces "no direct Model access outside the Repository layer" (`AGENTS.md`, Module Boundaries) —
this decision extends, not invents, that discipline.

---

## 5. Tenancy Options

**Option A — shared collections + explicit required Domain field**, if adopted *naively* (field
exists, discipline assumed): rejected as insufficient on its own — this is exactly the "add
`projectId` everywhere" non-architecture the task brief warns against, because nothing stops
`Agent.find({visibility:'public'})` from continuing to compile and run without the field.

**Option B — separate collections/databases per Domain**: evaluated seriously, not dismissed by
default. Strong physical isolation (an unscoped query literally cannot reach another Domain's data)
and trivial per-Domain deletion (drop the collection/database). But: Persona's Developer Platform
is expected to scale by **Project count** (potentially many, per requirements' "Beyond Campus,
Coursify, OpenFounder, and future products" framing), not by a small number of very large tenants —
the profile where physical per-tenant database separation earns its operational cost (dedicated
infra, per-tenant schema/index management, connection-pool sprawl) is the opposite of this platform's
expected shape. **FACT**: current Persona has no production adoption data at all (synthesis §00), so
building for hypothetical massive per-tenant isolation now, ahead of any evidence it's needed, would
repeat the exact "infrastructure the requirements don't ask for" mistake AD-01 explicitly avoided
when rejecting OAuth Client Credentials. Rejected as the **primary** strategy (§28); its core
benefit — physical inseparability — is instead obtained more cheaply for the one storage type that
genuinely needs it (checkpoints, §15) through key-level isolation rather than collection
proliferation.

**Option C — Hybrid**: selected. Different storage technologies in this codebase have genuinely
different constraints (Persona controls the Mongo schema for resources; does not control LangGraph's
checkpoint schema; Qdrant has its own cost/scale profile). Forcing one uniform strategy across all
of them would be a mismatch, not a simplification — directly why the task brief warns against
assuming "one persistence strategy must fit MongoDB, Qdrant, checkpoints, memory, caches, and
files." §7 details the selection reasoning; §9–21 detail the per-storage-type shape.

**Option D**: no stronger evidence-backed alternative was found. The Hybrid model already
incorporates the genuinely useful idea from Option B (physical/key-level isolation) exactly where
evidence supports it (checkpoints) without adopting it wholesale.

---

## 6. Comparison Matrix

| Criterion | A (naive, field-only) | B (per-Domain collections/DBs) | C — Hybrid (selected) |
|---|---|---|---|
| Isolation strength | Weak — depends entirely on every query remembering the field | Strongest — structural, physical | Strong where it matters most — enforced via mandatory helper (Mongo), key+gate (checkpoints), pre-existing collection separation (Qdrant) |
| Fail-closed properties | Poor — omission silently succeeds unscoped | Good by construction, but routing-layer bugs (wrong collection) are an equally real, differently-shaped risk | Good — missing Domain context is a hard error, not silent success (§10) |
| Codebase migration cost | Low | Very high — dynamic per-Domain collection/database provisioning for every resource type | Low–Medium, staged (§25) |
| Persona compatibility | High (additive field) | Low — Persona's existing single collections would need restructuring into "its own" collection set, an artificial change with no benefit (echoes AD-03's rejection of Persona-as-Project) | High — Persona's domain is a defaulted constant, zero behavior change (§9, echoing AD-03 §13) |
| MongoDB operational complexity | Low | High — collection/database count scales with Project count, unbounded | Low — standard single-deployment operations |
| Qdrant compatibility | N/A (Mongo-specific framing) | Would force collection-per-Domain or worse; discards the already-working collection-per-KB isolation | Preserves and reinforces the existing, already-isolating architecture (§19) |
| Runtime-state compatibility | Poor fit for checkpoints (no field to add to a third-party schema) | Awkward fit — checkpoints still can't gain a field regardless of Mongo strategy | Purpose-fit — key-level isolation designed specifically for this constraint (§15) |
| Developer ergonomics | Deceptively simple, actually risky | Complex — every access requires domain-aware routing to the right collection/database | Simple for callers (one helper, one required parameter) |
| Query ergonomics | Same query shape as today, easy to forget the addition | Different collection/database per query, error-prone routing logic | One shared, uniform helper across all Mongo-backed types (§10) |
| Auditability | Weak — no enforced trail of what was scoped | Strong for physical boundaries, weak for cross-cutting review (must inspect N collection sets) | Strong — one code path to audit (§10), consolidated |
| Deletion/export | Requires a correct, always-remembered filter | Trivial (drop the set) | Tractable via the same domain-field query pattern already used for normal operation (§23) |
| Scaling | Fine at small scale, risk grows with query surface | Poor at high Project counts | Standard Mongo/Qdrant scaling, no proliferation |
| Testing | Must test every query site individually | Must test routing logic per Domain | Concentrated — test the shared helper once, integration-test the boundary (§26) |
| Risk of accidental unscoped access | **High** — the central problem this decision must solve | Low for storage-layer leaks, but routing bugs are a real, comparably dangerous failure mode | Low — structurally difficult by design (§10) |
| Long-term maintainability | Degrades as query sites multiply | Degrades as Project count grows | Best — one mechanism, consistently applied |

---

## 7. Selected Tenancy Model

**DECISION: Option C, Hybrid**, with the following concrete, storage-type-specific shape (detailed
in §9–21):

| Storage | Mechanism |
|---|---|
| Durable Mongo resources (Agents, Skills, Knowledge, MCP definitions, Providers) | Shared collections + mandatory Domain field + repository-layer enforcement (§10–13) |
| Threads / MCP user connections | Same pattern, with richer required-match tuples (§14, §17) |
| Memory | Existing namespace-array pattern, extended with Domain as the **root** component (§16) |
| Checkpoints | Domain-aware key construction + mandatory application-layer gate — no stored field, third-party schema respected (§15) |
| Qdrant | Existing collection-per-Knowledge-Base architecture preserved; point-level Domain metadata added as backstop (§19) |
| Files | Domain-qualified storage path/key + **mediated, authorization-checked access** — never path-obscurity-as-security (§20) |
| Caches / rate limits | Domain included in every identity-bearing key, consolidated matrix (§21) |

This is not "add `projectId` everywhere" — it is a decision, per storage type, about *where the
isolation guarantee actually lives* (a stored field with an enforced helper; a namespace root; a
key-construction discipline plus an existing application gate; an already-separate collection) and
an explicit statement that different technologies earn different mechanisms.

---

## 8. Target State vs. Migration State

**DECISION, explicitly separating the two per the task's instruction:** the target state is that
**every** domain-scoped resource and runtime-state record carries an explicit Domain value — Persona
resources included, not merely defaulted forever by omission. AD-03 §22 left open whether Persona's
Domain becomes a real stored field; **this decision resolves that open question: yes, target state
stores it explicitly**, because that is what makes the fail-closed helper mechanism (§10) uniform
and auditable across every record, including Persona's own. What AD-03 correctly avoided, and this
decision does not reopen, is requiring that field to be populated via an immediate, risky live-data
migration — the **migration path** (§25) reaches the target state through staged, low-risk,
mostly-additive steps, not a big-bang cutover. A better target state is not rejected merely because
reaching it safely takes time.

---

## 9. Domain Representation

**DECISION:** Domain is represented, for Mongo-backed durable resources and Threads, as an explicit,
required, non-nullable field on the document — not an implicit, code-only constant, at target
state. For Persona's existing records, this field is **defaulted** to the fixed Persona-Domain
constant during migration (§25), reproducing today's query results exactly (per AD-03 §13's
singleton-domain finding — a domain-scoped query with the Persona constant returns the identical
result set to today's unscoped query, because nothing else shares that Domain). For newly-created
Developer Project resources, the field is populated from the start, from the AD-01/AD-02
authenticated context — never from caller input (§24-#13, AD-04).

---

## 10. Scoped Repository / Query Model — Fail-Closed Query Design

**This is the load-bearing section of the entire decision.**

### 10.1 Can `Agent.find({ visibility: 'public' })` execute without Domain today? Yes. How is this
prevented going forward?

**DECISION, minimum robust architecture (not every technique the task lists, only what's needed):**

1. **Explicit, mandatory `DomainContext` parameter.** Every repository method touching a
   domain-scoped collection takes a `DomainContext` (illustrative name, not binding) as a required
   parameter — no default, no optional value that silently means "unscoped." This is a **runtime**
   discipline, not a compile-time guarantee — **FACT**: the codebase is plain ES Modules JavaScript
   with no evidence of TypeScript (`AGENTS.md`), so this decision does not overclaim a type-system
   guarantee that doesn't exist. The guarantee instead comes from mechanisms 2–4 below.
2. **A single, shared, mandatory query-scoping helper.** Every repository method must construct its
   Mongo filter by calling one shared helper (conceptually `scopedFilter(domainContext,
   extraFilter)`), never by hand-writing a raw filter object. `Agent.find({visibility:'public'})`
   becomes forbidden by convention in favor of
   `Agent.find(scopedFilter(domainContext, {visibility:'public'}))`. **This is where the "Domain
   predicate is always present" guarantee actually lives — in one place, auditable and testable in
   isolation (§26).**
3. **Extend, don't invent, the existing layering discipline.** `AGENTS.md` already forbids
   Controller/Service → Model access outside the Repository layer (**FACT**). This decision adds one
   rule on top: **within** the Repository layer, no domain-scoped Mongoose call may bypass the
   shared helper. This reuses proven, already-adopted codebase discipline rather than inventing a
   parallel one.
4. **Recommended, non-implemented guardrails:** a lint/static-analysis rule flagging any raw
   Mongoose `find`/`findOne`/`findById` call in a repository file that does not route through the
   helper; integration tests specifically asserting cross-domain denial (§26).

### 10.2 Is there a database-level backstop?

**FACT, stated honestly, not overclaimed:** MongoDB has no native row-level-security mechanism
comparable to, e.g., Postgres RLS policies. "Database-level enforcement" is not realistically
available as a backstop for MongoDB specifically — this is precisely why the repository-layer
discipline above carries the real weight, and this decision does not claim a database-enforced
guarantee that does not exist.

### 10.3 Recommended defense-in-depth backstop (secondary, not primary)

**DECISION (recommended, not mandated as the primary mechanism):** an optional, request-scoped
ambient context (e.g., Node's `AsyncLocalStorage`) paired with a Mongoose pre-hook that errors loudly
if a known domain-scoped model is queried with no ambient Domain context present, catching any query
that somehow bypassed the explicit-parameter discipline above. This is explicitly a **secondary,
last-resort backstop**, not the primary mechanism — ambient/implicit context trades explicitness for
convenience, and this decision prefers explicit parameters as the primary guarantee (§10.1) precisely
to avoid magic, hard-to-audit behavior. The two-layer shape (explicit-first, ambient-backstop-second)
mirrors the defense-in-depth pattern already praised and reused across AD-01–AD-04
(`canUserExecuteAgent` + AgentFactory's second check).

---

## 11. Resource Lookup Rules

**Core Question, answered directly: yes — `getAgent(agentId)` must become conceptually
`getAgent(domainContext, agentId)`, never resource identity alone.**

**DECISION:** an opaque, globally-unique ID (even a MongoDB ObjectId) does not itself prove which
Domain a caller is authorized to reach. A bare `findById(id)` is a textbook IDOR (Insecure Direct
Object Reference) vulnerability once multiple Domains exist: if Project A's authenticated backend
ever learns or guesses an Agent ID belonging to Project B, an unscoped lookup would return Project
B's data to Project A. **The rule: every domain-scoped resource lookup must combine Domain +
resource identity as a single, atomic, mandatory pair** — conceptually `{_id: id, domain:
domainContext.domain}` in one query, not `findById` followed by a separate check (which would leak
existence via timing/response-shape differences, the same reasoning `canUserExecuteAgent` already
applies by returning 404 rather than 403 for unauthorized agents, **FACT**, synthesis).

**Not decided here (explicitly out of scope):** whether the ID itself becomes self-describing
(domain-encoded in the string) versus remaining a plain opaque value always paired with an
externally-supplied Domain parameter. **Leaning/recommendation, not a hard decision:** keep IDs
opaque and simple; the Domain is already available from the authenticated AD-01/AD-02 context on
every request, so encoding it redundantly into the ID buys little. Final ID format is a later
schema decision (**OPEN**).

---

## 12. Unique Identifier / Uniqueness Semantics

**Uniqueness-scope matrix, derived systematically, not assumed:**

| Identifier | Today | Target scope | Reasoning |
|---|---|---|---|
| Agent `slug` | Global | **Domain-local** | Two independent Projects have no reason to share a global slug space; each has its own discovery surface (AD-03 §13). Persona's own slugs remain effectively global because the Persona Domain is a singleton (identical outcome, no behavior change) |
| Skill `(owner, name)` | Per-owner (global) | **Domain-local, per-owner** — `(domain, ownerType, ownerIdentity, name)` | Preserves today's granularity (two different owners can reuse a name); simply Domain-qualifies it. For `OwnerType = Project`, this naturally collapses to per-Domain uniqueness, since Project *is* the Domain (AD-04 §8.1) — a derived consequence, not a new rule |
| MCP `(owner, name)` | Per-owner (global) | **Domain-local, per-owner** | Same reasoning as Skill |
| `qdrantCollectionName` | Global, random-suffixed | **Remains global** | Internal system identifier, not user-facing; already collision-safe via randomization regardless of Domain — no change needed to its uniqueness posture (§19 covers Qdrant strategy more broadly) |
| User `clerkId` / `email` / `username` | Global | **Remains global** | Belongs exclusively to the Persona Domain (Persona Users don't exist in Project Domains at all, per AD-04's principal taxonomy) — global and Persona-domain-local are identical here |
| `externalUserId` | N/A (doesn't exist yet) | **Domain-local only** | Reaffirms AD-02 unmodified: `(BeyondCampus, rahul) ≠ (Coursify, rahul)` is the entire point |
| Agent "Main Agent" (`ownerId+isMainAgent+isActive`) | Per-PersonaUser, Persona-specific | **Unchanged, not extended to Projects** | AD-03 §13 already flagged this as a Persona-specific product feature not assumed to apply to Projects; this decision does not generalize a constraint that has no evidenced Project analog |
| Thread `threadId` (UUID) | Global | **Remains global, opaque** | Genuinely collision-free by construction; global uniqueness of the *identifier* is unrelated to *authorization* to access it (§14) — the two must not be conflated |

---

## 13. Durable Resource Persistence

For Agents, Skills, Knowledge Bases, MCP definitions, and Providers (Provider's deeper issues
covered separately, §18): **DECISION** — each requires (a) an explicit `Domain` field (§9), (b)
`OwnerType`/`OwnerIdentity` per AD-04's shape, (c) all reads/writes routed through the §10 scoped-
repository mechanism, (d) uniqueness constraints re-scoped per §12's matrix, and (e) attachment-time
cross-reference validation against Domain (§22). No resource type in this group requires a
fundamentally different mechanism from the others — they are the archetypal case the §10 mechanism
is built for.

---

## 14. Thread Isolation

**DECISION:** every Thread lookup/access operation (read, resume, list, delete) must verify **all
three** components of `(Domain, Subject, Agent)` from AD-04 §15.3 — not Subject alone, as today.

1. **Domain match** — the requesting authenticated context's Domain equals the Thread's stored
   Domain.
2. **Subject match** — the requesting actor's identity equals the Thread's stored Subject (this is
   today's existing check, `thread.userId === userId`, generalized).
3. **Agent match** — the Thread's stored `agentId` must equal the `agentId` being used for *this*
   operation. **This closes the previously-verified gap** (synthesis §10, §21.1; AD-02 §17, §21;
   AD-04 §27): today only Subject is checked; Domain didn't exist as a concept yet; Agent was never
   checked at all. **This decision states the requirement precisely: the same re-keying work that
   adds Domain-awareness to Thread lookups is the natural, correct point to add the Agent check
   too — not a separate future fix.** (Not implemented here, per task scope.)

**Thread IDs remain globally unique, opaque identifiers** (§12) — this is explicitly fine and does
not need to change, because **global uniqueness of the identifier and authorization to access it are
independent properties** (§11); the fix is in the *lookup/authorization rule*, not the ID format.

**DECISION:** the deterministic fallback thread-ID construction (today: `agui-${agentId}-${userId}`,
flagged by synthesis §11.1 as "weak — works only because Persona user IDs are unique") must extend to
include Domain — conceptually `agui-${domain}-${agentId}-${subject}` — directly closing the exact
weakness synthesis identified, since `subject`/`externalUserId` is not globally unique the way a
Persona `userId` is (AD-02).

---

## 15. Checkpoint Isolation

**The hardest case: no tenant field exists at the storage layer, and Persona does not control the
schema (`@langchain/langgraph-checkpoint-mongodb`'s `MongoDBSaver`, a third-party library) — FACT.**
Forking or reimplementing LangGraph's checkpoint persistence to add a field was considered and
**rejected** as disproportionate engineering investment relative to the risk, given the mitigation
below is already adequate and checkpoint access is already narrowly centralized (**FACT**: synthesis
confirms `checkpointService.getMessages` as the sole consumer).

**DECISION — two-layer isolation, neither of which requires a schema change to the third-party
collection:**

1. **Key-level:** the `thread_id` string passed into the checkpointer is derived from the Thread's
   own globally-unique `threadId` (§14) — already collision-free by construction for explicitly-
   resumed threads. For the *deterministic fallback* path (no thread yet), §14's Domain-extended
   construction (`agui-${domain}-${agentId}-${subject}`) directly prevents the cross-Domain
   collision synthesis flagged.
2. **Application-layer gate, extended:** checkpoint access must **always** be mediated through the
   checkpoint service, which must resolve and verify the owning Thread's full `(Domain, Subject,
   Agent)` (§14) **before** calling the raw checkpointer — extending today's existing, already-
   proven pattern (`thread.userId === userId` before `getTuple`, **FACT**) rather than inventing a
   new one. **DECISION:** no code path may call the raw checkpointer directly, bypassing this
   service — mirroring the "no direct Model access outside Repository" rule (§10.1) for this
   third-party-owned storage specifically.

**OPEN, flagged for reconsideration:** this two-layer mitigation is adequate *because* checkpoint
access is currently centralized through one narrow call site. If a future admin tool, bulk-export
API, or other capability needs broader direct checkpoint access, this calculus should be revisited —
not assumed to remain sufficient forever.

---

## 16. Memory Isolation

**DECISION:** Domain becomes the **root** (first) component of the existing hierarchical namespace
array — not appended at the end. Conceptually (illustrative, not binding):
`['domains', domainId, 'subjects', subjectId, ...]`, extending today's `['users', userId, ...]` by
adding **one** level above the existing root, not restructuring it.

**Why root, not leaf, precisely:**

1. **Collision-safety** — a read/write operation that has only `(domain, subject)` can construct
   the full correct namespace prefix immediately; Domain-as-root directly and completely prevents
   the exact collision scenario the task poses (`(Project A, rahul)` and `(Project B, rahul)`
   sharing `['users', 'rahul']`) by construction, since the full prefixes differ from the first
   element.
2. **Consistency with the existing pattern** — subject identity is *already* the namespace root
   today; this decision adds one level above it, the minimal possible extension, not a redesign.
3. **Enumeration for Domain lifecycle operations** — "list/delete all memory under Domain X" becomes
   a simple prefix match, directly serving §23's deletion/export/audit requirement.

**Project-level Subject is supported:** per AD-04 §15.2, `Subject` may be `Project` itself (for
Project-level System Agent calls with no external user) — memory namespace construction must
accommodate all three Subject types (`PersonaUser`, `ExternalUser`, `Project`) uniformly.

**User-global vs. user+agent memory is preserved unchanged in shape**, just gaining the Domain-root
prefix: `['domains', domainId, 'subjects', subjectId, ...]` (global) vs. `[..., 'agents', agentId,
...]` (per-agent) — a direct extension of today's `['users', userId]` vs. `['users', userId,
'agents', agentId]` split.

**Persona's existing memory migration** — see §25 (namespace *restructuring*, not merely an
additive field, is required here, unlike most other resources).

---

## 17. MCP Persistence

Reusing AD-04 §16's Owner/Subject split exactly, now given persistence shape:

- **MCP definition** (durable, owned resource): follows §13's general durable-resource pattern —
  `Domain`, `OwnerType ∈ {PersonaUser, Project, ExternalUser}`, scoped-repository access, Domain-
  local `(owner, name)` uniqueness (§12).
- **`authMode: 'user'` credentials** (Subject-scoped runtime state): **DECISION** — keyed
  conceptually by `(Domain, Subject, mcpId)`, extending today's `(mcpId, userId)` compound unique
  index with the Domain dimension. This directly prevents the task's own posed collision: a
  Project-owned MCP + Rahul's credential in Beyond Campus can never collide with the same
  `externalUserId` "Rahul" in Coursify, because Domain differs in the compound key.

**DECISION — the Project-Admin-cannot-read-credential-contents rule, given a concrete persistence
shape (extending AD-04 §24-#11):** the service method(s) that **decrypt** a user-mode MCP credential
into its usable form must be reachable **only** from the runtime execution path (AgentFactory/tool
resolution, acting on behalf of the credential's own Subject during that Subject's own agent
execution) — never from any Project-Admin-facing administrative code path. Administrative operations
(list connections, view status/metadata, revoke) may query the credential *record's* existence and
non-secret metadata without ever invoking the decrypt operation. This is a concrete, enforceable
service-boundary rule: two distinct call sites — one metadata-only (safe for admin use), one
decrypted-and-usable (restricted to the credential's own Subject's own runtime execution) — not a
single method with an access-level flag that could be misconfigured.

---

## 18. Provider Persistence Isolation

**Ownership-taxonomy-only, per AD-04 §17 and task scope — resolution/fallback/billing remain
deferred to Provider's own future decision.**

**DECISION:** Provider records gain the same `Domain` field and pass through the same scoped-
repository mechanism as every other durable resource (§13) — `OwnerType ∈ {PersonaUser, Project}`
(not `ExternalUser`, per AD-04 §17). **No special-case lookup path exists for Provider** —
`Provider.findById(id)` alone is exactly as forbidden here as for any other resource (§11); a
provider lookup must always be Domain-qualified. Secret storage mechanism (AES-256-GCM, **FACT**,
unchanged) is untouched by this decision — only the *record's* isolation, not the *encryption*, is
in scope here.

---

## 19. Qdrant / Vector Isolation

**Evaluated on its own terms, not assumed to inherit MongoDB's strategy — per the task's explicit
instruction.**

**FACT, re-confirmed:** each Knowledge Base already has its own, uniquely-named Qdrant collection
(`kb_<mongoId>_<randomHex>`) — Persona is *already* using a "collection per Knowledge Base" pattern,
not shared collections. Point-level metadata carries only `kbId`/`sourceName`, no tenant marker
(synthesis §20 Hotspot #11).

**DECISION: preserve collection-per-Knowledge-Base.** It already provides the property that matters
most — cross-Domain leakage is structurally impossible, since collections are never shared across
KBs, let alone across Domains, and access is always gated by first resolving the owning
KnowledgeBase Mongo document (which, per §13, will be Domain-scoped and routed through the §10
mechanism) before ever touching Qdrant. **No evidence supports changing this now**: Persona has no
production adoption data (§5), so optimizing for hypothetical massive collection counts ahead of any
measured operational pressure would repeat the premature-infrastructure mistake this whole decision
series has consistently avoided.

**Forward-looking, non-implemented recommendation:** *if and when* Qdrant collection-count
operational limits are actually approached (a measurable, evidence-triggerable condition, not
assumed now), the natural evolution is **collection-per-Domain** (all of a Project's KBs share one
collection, distinguished by `kbId` in point metadata) — **not** collection-per-owner or fully shared
collections with cross-Domain filtering, because collection-per-Domain preserves the property that
matters most (Qdrant collection boundaries = Domain boundaries), trading only a *within-Domain*
KB-mixup risk (lower severity) for *cross-Domain* leak risk (higher severity) if it were ever needed.

**DECISION, regardless of A vs. the future C:** add `Domain` (and continue using `kbId`) as
**point-level payload metadata**, even under the unchanged collection-per-KB architecture, as a
cheap defense-in-depth backstop — currently absent (synthesis Hotspot #11). This does not change the
collection architecture and provides a second line of defense if collection-routing logic ever has a
bug.

---

## 20. File / Object-Storage Isolation

**FACT:** current uploads are flat, unscoped, served statically with no identity in the filename —
a real, if narrow, gap (synthesis, flagged with lower re-verification confidence, still treated as
credible).

**DECISION:** durable files should use a Domain-qualified storage path/key — conceptually
`domain/ownerOrSubject/resource/...` (illustrative, not locked, per task instruction). **The more
important decision is the explicit warning the task raises, directly adopted:** the path/key must
**not** become an alternative, unauthenticated access route. Even with a Domain-prefixed path, access
must be gated by an actual authorization check verifying the requester's Domain/authenticated context
matches the file's owning Domain — never "the path is obscure enough to be safe." **DECISION:**
serving durable files should shift from today's permanently-public static URL toward **mediated
access** (e.g., a signed, time-limited URL issued only after an authorization check, or an
authenticated download endpoint) — the exact mechanism is an implementation-phase choice, not decided
here; the principle (never rely on unguessable-path-as-security once Domain isolation genuinely
matters) is decided.

---

## 21. Cache / Rate-Limit / Namespace Keys

Consolidating AD-02 §17, AD-03 §23, and AD-04 §27's already-established requirement into one
matrix — this section reaffirms rather than re-derives:

| Key | Conceptual shape | Basis |
|---|---|---|
| AgentFactory cache | `${cacheKey}:${domain}:${subject}` | AD-02 §17, AD-03 §23 |
| Rate limiting (concurrency) | `concurrency:CHAT:${domain}:${subject}` | AD-02 §17 |
| MCP user credentials | `(domain, subject, mcpId)` | §17 above |
| Memory namespace | `['domains', domainId, 'subjects', subjectId, ...]` | §16 above |
| Checkpoint key (deterministic fallback) | `agui-${domain}-${agentId}-${subject}` | §14 above |
| Ephemeral runtime files | `(domain, subject, threadId)` | AD-04 §15.3 |

**DECISION:** every identity-bearing key where cross-Domain collision is possible must include
Domain — no exceptions among the above.

---

## 22. Cross-Resource Referential Integrity

**FACT** (synthesis §9, §12.5): today, **no** cross-resource ownership validation exists at all —
an Agent's `skills`/`mcps`/`knowledgeBases` arrays can reference any resource ID regardless of owner;
enforcement, where it exists, happens silently at runtime resolution.

**DECISION:** this decision upgrades that known gap into an explicit, mandatory invariant with a
Domain dimension: **every resource a durable resource references must belong to the same Domain as
the referencing resource**, absent a future, explicitly-designed cross-Domain sharing mechanism (not
designed here, per AD-03/task scope). **Enforcement point:** primarily at **attachment time** (when
an Agent's `skills`/`mcps`/`knowledgeBases` array is updated) — reject the update if a referenced
resource's Domain doesn't match, giving the actor immediate, clear feedback, rather than relying
solely on silent runtime filtering. Today's silent-exclusion-at-resolution-time behavior may remain
as a **defense-in-depth backstop**, but the primary fix belongs at attachment time.

---

## 23. Domain Lifecycle Implications

**DECISION:** the selected Hybrid model makes "enumerate/delete/suspend/export/audit Domain X" safe
and tractable **using the same mechanism normal operation already requires** — no bespoke
enumeration capability is needed:

- **Mongo-backed resources/Threads:** `find({domain: X})` via the §10 scoped-repository helper —
  identical code path to ordinary queries.
- **Memory:** a prefix match on the Domain-rooted namespace (§16) — directly enabled by the root-
  placement decision.
- **Qdrant:** enumerate the Domain's Knowledge Bases via their (now Domain-scoped) Mongo records,
  then delete each KB's own collection (§19) — no change to the existing per-KB deletion shape.
- **Checkpoints:** resolve the Domain's Threads first (a domain-field query on the Mongo Thread
  collection), then reuse the **existing** `cleanupThreads(threadIds)` pattern (**FACT**, already
  takes a list of thread IDs, doesn't scan checkpoints directly) — no new checkpoint-layer capability
  is required, only a Domain-scoped way of producing the input list.

This is a direct, positive consequence of choosing a model where the same discipline that prevents
accidental cross-Domain *reads* also produces safe, complete cross-Domain *enumeration* — a
bespoke, error-prone "domain deletion" mechanism is unnecessary by construction.

Exact deletion/retention **mechanics** (staged transition, grace periods) remain **OPEN**, per AD-03
§16/§25 — this decision only establishes that the persistence architecture makes the eventual
mechanism tractable, not what that mechanism is.

---

## 24. Platform Admin Exceptional Access

**DECISION, directly following the task's explicit warning: Platform Admin cross-Domain access must
never be implemented as "call the normal scoped repository method with a null/omitted Domain
parameter."**

If "no Domain = search everywhere" were ever a valid interpretation of the *normal* API surface, any
bug that accidentally left the Domain parameter unset in ordinary code would silently become a
cross-Domain leak rather than a caught error. **DECISION:** the normal scoped-repository interface
treats a missing Domain as an **error** (§10), full stop, with no privileged-access meaning attached
to omission. Platform Admin's cross-Domain capability must instead be a **separate, distinctly-named
operation** (conceptually, e.g., a dedicated `findAcrossAllDomains`-shaped method, illustrative only)
that:

1. Is never reachable via the normal method signature or by omitting a parameter.
2. Is gated by an explicit, separate authorization check verifying genuine Platform Admin authority
   (AD-04 §19) *before* it can be invoked at all.
3. Produces an audit record on every use — giving AD-04 §19's "narrow, explicit, auditable"
   requirement a concrete persistence-layer shape.

---

## 25. Migration Strategy

**Target state vs. migration path, kept explicitly distinct (§8).** Classified per resource type,
refining AD-03 §17's earlier, more conservative estimates now that the concrete mechanism (mostly
additive fields, not restructuring) is known for most types:

| Resource | Risk | Why |
|---|---|---|
| Agents / Skills / Knowledge / MCP definitions / Providers | **LOW–MEDIUM** | Additive field with a defaulted, backfilled Persona constant — no restructuring, safely online |
| Threads | **MEDIUM** (revised down from AD-03's original EXTREME) | Also an additive, defaulted field, not a key/namespace restructuring — AD-03's original estimate predated knowing the mechanism would be this simple |
| Memory | **HIGH** | Genuine namespace **restructuring** (Domain must be the array's root element, §16), not merely an additive field — existing documents' `namespace` arrays must actually be rewritten |
| Checkpoints | **LOW** (revised down sharply from AD-03's original EXTREME) | No rewrite needed at all — existing checkpoints keep working under their existing bare-UUID keys (implicitly Persona-scoped, since no Project could have created them before this architecture existed); only *new* threads use the Domain-extended key construction (§14–15) |
| Qdrant | **LOW** | No change to collection architecture (§19); the recommended point-metadata addition is purely additive to future writes, non-breaking for existing vectors |

**Staged path (architecture level, no scripts):**

1. Add the Domain field/root-namespace support to schemas and code, defaulted/backfillable.
2. Deploy the §10 scoped-repository mechanism for **all** existing Persona traffic using the
   defaulted constant — zero observable behavior change (AD-03 §13).
3. Onboard real Developer Projects on the fully Domain-aware path from day one — they have no
   legacy data, so they carry no migration burden at all; only Persona's own existing data needs
   backfill.
4. For Memory specifically (the one genuine restructuring case): **DECISION** — use a temporary
   dual-format-read/new-format-write compatibility window (old `['users', ...]` namespaces remain
   readable; all new writes use the Domain-rooted format) rather than a big-bang rewrite, converging
   via a background backfill — directly matching the task's allowance for "dual-read/dual-write only
   if genuinely necessary," applied to the one case that actually needs it.
5. Verify backfill completeness (all records carry an explicit Domain; no reads still hitting the
   compatibility path).
6. Remove compatibility behavior (dual-format memory reads, any remaining implicit-default fallback
   logic) — cutover complete, target state reached.

---

## 26. Testing / Verification Strategy

Specified, not implemented, per task scope. Recommended primarily as **integration tests** (they
exercise repository + service + boundary behavior), with the §10 helper itself covered by a
**unit test** in isolation (verify it always includes the Domain predicate for every input; verify it
throws/errors rather than returning an unscoped filter when Domain is missing — arguably the single
most important test in the suite, warranting dedicated ownership in a security-focused test area,
not just inclusion among general integration tests):

- Project A cannot read/modify Project B's Agent/Skill/Knowledge/MCP/Provider by ID (IDOR-style,
  §11) — must return not-found, not a distinguishable authorization error (§11, mirroring
  `canUserExecuteAgent`'s existing 404-not-403 pattern).
- Project A's discovery never returns Project B's public resources; Persona's marketplace never
  returns any Project's resources; a Project's discovery never returns Persona's resources (§12,
  §19).
- Same `externalUserId` in two different Projects never collides across memory, threads, or MCP
  credentials (§14, §16, §17).
- Same slug in two different Domains both succeed; same slug within one Domain correctly conflicts
  (§12).
- Thread access denied for wrong Subject (existing behavior, retained) **and** for wrong Agent (new
  regression test directly validating the previously-known gap is closed, §14).
- Memory cross-Domain isolation (§16).
- MCP credential cross-Domain isolation, same Subject, different Domain (§17).
- Qdrant retrieval never crosses Domain boundaries, even under adversarial/crafted IDs (§19).
- Platform Admin exceptional path: reachable only with genuine Platform Admin authority; the
  **normal** scoped path with a missing/null Domain parameter fails closed (errors) rather than
  silently becoming unscoped — this specific test is the direct validation of §10/§24's central
  design claim and should be treated as a dedicated security-suite entry, not folded into general
  integration coverage.

---

## 27. Security Analysis

Threat-modeled against every item the task specified, each tied to the specific mitigating decision
above:

1. **Missing Domain filter** — §10: fail-closed by design (missing = error, never "search
   everywhere").
2. **`findById` without Domain** — §11: explicitly forbidden pattern; every lookup is
   Domain-qualified.
3. **Global public query** — §10, directly closing synthesis's highest-severity finding.
4. **IDOR using another Domain's resource ID** — §11, the textbook mitigation (Domain+ID pair
   required, never ID alone).
5. **Cross-Domain references** — §22, attachment-time validation.
6. **Cache collisions** — §21.
7. **Memory collisions** — §16.
8. **Checkpoint collisions** — §15, defense-in-depth given the honestly-acknowledged storage-layer
   limitation.
9. **Qdrant filter omission** — §19: collection-per-KB isolates by construction; metadata is a
   backstop, honestly framed as secondary, not the primary guarantee.
10. **File-key guessing** — §20: mediated access, not path obscurity.
11. **MCP credential collision** — §17: Domain-qualified compound key.
12. **Provider secret lookup without Domain** — §18: no special-case exemption from the universal
    lookup rule.
13. **Project deletion with incomplete Domain predicate** — §23: enumeration reuses the same,
    already-audited query pattern as normal operation, not a bespoke mechanism.
14. **Migration record with missing Domain** — §25: under the fail-closed rule (§10), a record
    temporarily missing its Domain field during migration becomes **inaccessible**, not
    **cross-Domain-visible** — the correct failure direction, stated explicitly as a deliberate,
    favorable property of this design, not an accident.
15. **Platform Admin path accidentally becoming a generic bypass** — §24: a separate, distinctly-
    named, separately-authorized, audited path — never an omitted-parameter fallthrough.

**Fail-open vs. fail-closed, stated explicitly and honestly:** the central discipline of this
decision is that domain-scoped operations fail closed when Domain context is missing or mismatched.
This is **strongest** where a stored field plus the mandatory shared helper governs access (Mongo
resources, §10) and **honestly weaker, mitigated by defense-in-depth rather than a storage-layer
guarantee**, where third-party or different-technology constraints apply (checkpoints, §15; Qdrant,
§19) — this document does not claim uniform strength where the evidence doesn't support it,
consistent with this decision series' established practice of not overclaiming guarantees.

---

## 28. Rejected Alternatives

### 28.1 Option A, naive (field-only, no enforcement mechanism)

Rejected as insufficient — explicitly the "add `projectId` everywhere" non-architecture the task
brief warns against; provides no answer to how `Agent.find({visibility:'public'})` is prevented.

### 28.2 Option B — separate collections/databases per Domain, as the primary strategy

Rejected as disproportionate to evidenced need and platform shape (§5) — the operational cost of
per-tenant physical separation scales badly against an expected many-Projects profile, and its one
genuinely valuable property (physical inseparability) is obtained more cheaply, exactly where it's
actually needed, through §15's key-level checkpoint isolation instead.

### 28.3 Uniform strategy across all storage technologies

Rejected — Qdrant keeping its already-working, already-isolating collection-per-KB architecture
while MongoDB adopts a field-based strategy is not an inconsistency to resolve; it is the correct
recognition that different technologies warrant different mechanisms (§5, §19), per the task's own
explicit instruction not to assume one strategy fits all of them.

### 28.4 Forking/wrapping LangGraph's checkpoint schema to add a tenant field

Considered for checkpoints specifically (§15) and rejected as disproportionate engineering
investment given the two-layer key+gate mitigation is adequate for the currently-centralized access
pattern — flagged **OPEN** for reconsideration if that centralization ever changes.

---

## 29. Consequences for Runtime Architecture

AgentFactory, AG-UI, and the memory/checkpoint/MCP-tool-resolution machinery must consume `Domain`
as an explicit construction parameter alongside `Subject`/`OwnerType` (extending AD-02 §17, AD-03
§23, AD-04 §27's already-established requirement with the concrete key/namespace shapes decided in
§14–17 and §21 here). The Thread `agentId`-vs-requested-agent gap (§14) must be closed in the same
implementation effort that adds Domain-awareness to Thread lookups — not treated as a separate,
lower-priority fix.

## 30. Consequences for Developer API / Studio

Every future Developer API endpoint that creates or looks up a resource must derive `Domain` from
the AD-01/AD-02 authenticated context, never accept it as a request field (§9, reaffirming AD-04
§24-#13). Developer Studio's Domain-lifecycle actions (view Project resources, request
suspend/delete) must be built against the §23 enumeration pattern, not a bespoke query mechanism.
Any future Platform Admin support/moderation tooling must be built exclusively against the §24
exceptional-access path, never the normal scoped repository interface.

---

## 31. Open Questions

1. Exact ID format — opaque with an external Domain parameter (leaning) vs. self-describing
   (Domain-encoded) — §11, not decided.
2. Exact hashing/format details for the shared query-scoping helper's implementation, and the
   specific lint rule design — §10.4, implementation-phase.
3. Whether/when Qdrant's collection-per-Domain evolution (§19) becomes warranted — evidence-
   triggered, not scheduled.
4. Whether checkpoint access centralization remains sufficient to justify the two-layer mitigation
   over a schema-level fix, long-term (§15, §28.4).
5. Exact durable-file access mechanism (signed URLs vs. authenticated streaming endpoint) — §20,
   implementation-phase.
6. Exact Domain-deletion/retention mechanics — remains AD-03's open question, not resolved by this
   decision's enumeration-tractability finding (§23).

---

## 32. Implementation Constraints

Collected from §10–24 for visibility, non-binding on exact implementation:

- Every domain-scoped repository method must require an explicit Domain-context parameter and
  construct its Mongo filter exclusively through the shared scoped-query helper (§10.1–10.2).
- No code path may perform a raw, unscoped Mongoose query against a domain-scoped model outside the
  repository layer, nor bypass the helper within it (§10.1, extending existing `AGENTS.md` layering
  rules).
- No domain-scoped resource lookup may use bare resource identity alone; Domain must always
  accompany it in the same query (§11).
- Memory namespace construction must place Domain as the array's root element, not appended (§16).
- Checkpoint access must always route through the checkpoint service's `(Domain, Subject, Agent)`
  gate; no direct raw-checkpointer calls elsewhere (§15).
- MCP credential decryption must be reachable only from the runtime execution path acting as the
  credential's own Subject — never from administrative code paths (§17).
- Platform Admin cross-Domain access must be a distinctly-named, separately-authorized, audited
  operation — never an omitted-parameter variant of the normal path (§24).
- Attachment-time validation should reject cross-Domain resource references on Agents/Skills/
  Knowledge/MCP arrays (§22).

---

## 33. Evidence / References

| Claim | Source |
|---|---|
| AD-01–AD-04 invariants reused (Domain never from caller input; ownership/subject shapes; no forced Persona migration) | `architecture/01–04-*.md`, cited throughout |
| Unconditionally global public queries are the platform's highest-severity finding | Synthesis §14, §20 Hotspots #1–#3 |
| No cross-resource ownership validation exists today | Synthesis §9, §12.5 |
| Checkpoints have no tenant field at the storage layer; `MongoDBSaver` is third-party | Synthesis §6 (Runtime/AG-UI Findings); re-confirmed AD-02 §17 |
| Qdrant already uses collection-per-Knowledge-Base; no point-level tenant metadata | Synthesis §7, §20 Hotspot #11 |
| Memory namespace is already hierarchical/extensible; user identity already the root element | Synthesis §7 |
| `AGENTS.md` already forbids direct Model access outside Repository layer | `AGENTS.md`, Module Boundaries |
| `canUserExecuteAgent` returns 404 not 403 (existence-hiding pattern reused for lookup design) | Synthesis §6; re-verified directly in prior research phase |
| `checkpointService.cleanupThreads(threadIds)` already takes an ID list, doesn't scan checkpoints directly | Synthesis §6; `checkpoint.service.js` |
| Persona has no production adoption data (basis for rejecting premature per-tenant infrastructure) | Synthesis, `product-research/00-product-overview/current-product-state.md` |
| Deterministic thread ID `agui-${agentId}-${userId}` flagged weak once user IDs aren't globally unique | Synthesis §11.1 |
| Requirements: Domain/Project is the hard isolation boundary; resources never cross by default | `developer-platform-requirements.md` §6, §8 |

---

*This document decides persistence and tenant-isolation architecture only. It establishes a hybrid
model — shared, helper-enforced Mongo collections for durable resources; a Domain-rooted namespace
for memory; key-construction-plus-gate isolation for checkpoints; a preserved, reinforced
collection-per-Knowledge-Base architecture for Qdrant — and makes the central discipline explicit:
missing Domain context is an error, not an omission that silently succeeds. It explicitly defers
exact schema, indexes, migration scripts, RBAC granularity, the Developer API surface, Developer
Studio UX, SDK design, and Provider's full resolution architecture to later, separately-scoped
decisions (§29–30 record the constraints each inherits).*
