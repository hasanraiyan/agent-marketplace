# Architecture Decision 03 — Project / Domain Model

> **Status:** DECIDED (this document). Scope: what a Project conceptually represents, whether it is
> the hard isolation boundary, and how Persona's existing product relates to it. Starts strictly
> after AD-01 (Project authentication) and AD-02 (external-user identity) — neither is reopened.
> **Explicitly NOT decided here:** Project MongoDB schema, `projectId` field placement,
> ExternalUser schema, polymorphic owner schema, Project Admin RBAC roles, collection-vs-field
> tenancy, exact visibility fields, Developer API endpoints, Developer Studio IA, SDK, billing,
> quotas, cross-Project sharing/import mechanisms. Where the selected model constrains these, the
> constraint is recorded (§21–24), not designed.
> **Inputs:** `product-research/10-developer-platform/developer-platform-requirements.md`
> (product truth), `product-research/10-developer-platform/05-codebase-readiness-synthesis.md`
> (codebase evidence), `architecture/01-project-authentication.md`, `architecture/02-external-user-identity.md`.
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION: Option C — a thin, internal isolation abstraction (illustrative name: "Domain") sits
below both Persona and Developer Projects. Every Project is a Domain instance. Persona is a single,
fixed, first-party Domain instance — but Persona is explicitly NOT a Project.** Persona keeps its
existing identity model (Clerk, first-party), product surfaces (`/dashboard`, `/studio`), and
marketplace semantics unchanged. It does not gain Project credentials (AD-01), is not addressed
through AD-02's external-user delegation mechanism, has no Project Admin RBAC, and is never exposed
through a future Developer API or Developer Studio.

What the Domain abstraction actually buys — precisely, not by assertion — is answered in §10 and
is the crux of this decision: it lets every future query, authorization check, and piece of runtime
infrastructure be written **once**, parametrized by a domain value, instead of forking into a
permanent `if (Persona) ... else if (Project) ...` duplication (Option B's failure mode) or forcing
Persona's live data and product semantics through an EXTREME migration to literally become "just
another Project" (Option A's failure mode).

Project remains, unchanged from AD-01/AD-02, the **hard security/isolation boundary** for the
Developer Platform (§6).

---

## 2. Context

AD-01 established how Persona verifies which Project is calling (`AuthenticatedProjectContext`).
AD-02 established how that Project asserts which of its own external users a request is for
(`AuthenticatedRuntimeContext`, `(projectId, externalUserId)`). Both decisions assumed a `Project`
identity exists and is resolvable, without defining what a Project *is* as a domain concept, or how
it relates to Persona's own, already-existing, single-tenant product. Every subsequent architecture
decision (ownership, visibility, Project Admin authority, persistence/tenancy, runtime scoping) is
downstream of that definition — this decision supplies it.

**FACT** (synthesis §5, §17, re-confirmed across AD-01/AD-02): today, Persona is architecturally a
single, undifferentiated domain — there is exactly one identity space, one marketplace, one set of
global unique indexes, and zero concept of a second isolation boundary anywhere in the codebase.

---

## 3. Requirements (Restated From Task Brief and Requirements Document, Unweakened)

Project must be the hard isolation boundary (requirements §8). Project scope and visibility are
different concepts (requirements §6). Persona's existing product — Marketplace, Agent Studio,
Persona users, Persona agents — must continue working (requirements §33.1). Persona Marketplace ≠
Beyond Campus Marketplace ≠ Coursify Marketplace, even on shared infrastructure (requirements §16).
This decision must determine what Project represents, whether it's the isolation boundary, how
Persona relates to it, whether an internal common abstraction is warranted, default cross-domain
resource isolation, and whether control-plane and runtime-plane principals remain distinct — without
deciding schemas, RBAC, APIs, Studio UX, SDK, billing, or quotas.

---

## 4. Existing Persona Domain

**FACT**, drawn from the synthesis and re-confirmed across AD-01/AD-02's evidence sections:

- One identity space: Clerk JWT → Persona User (`User._id`), first-party — Persona itself is the
  identity authority (unlike a Developer Project, which is trusted to assert its *own* users'
  identity to Persona, per AD-02 §4).
- One global marketplace: `visibility: 'public'` means discoverable by every Persona user, with no
  scope qualifier anywhere in the query layer (synthesis §14, §20 Hotspots #1–#2).
- User-owned Agents, Skills, Knowledge, MCPs, Providers — every resource owned directly by a
  Persona User via `ownerId` (synthesis §9).
- Agent Studio (`/studio`) — the creator surface Persona users already use; explicitly not
  Developer Studio and not reinterpreted by this decision (requirements, repeated throughout).
- Global unique indexes assuming single-tenancy: agent `slug`, `qdrantCollectionName`, user
  `clerkId`/`email`/`username` (synthesis §9, §14).

---

## 5. Developer Project Domain

Per requirements (§7–8) and AD-01/AD-02: a Project is an isolated external product (Beyond Campus,
Coursify, OpenFounder) that authenticates to Persona via a Project credential (AD-01), asserts its
own external users' identity via a delegated, unsigned-beyond-TLS assertion (AD-02), and is expected
to hold Project-owned resources (System Agents, Project Skills/Knowledge/MCPs, a Project-level
Provider) as well as host resources owned by its own external users (requirements §17–19). No
Project has been implemented; this description is entirely forward-looking, drawn from the
requirements document and the two prior decisions.

---

## 6. What a Project Represents

**Core Question 1, answered directly.** A Project is a **combination**, but the properties are not
peers — one is load-bearing and the others follow from it:

- **Primarily: a hard security/isolation boundary.** Every other property below depends on this one
  holding; none of them make sense if resources or identities can leak across it.
- **Secondarily: an application/tenant** — the external product built on Persona's infrastructure
  (this is the *product* framing developers and Beyond Campus's own team would use).
- **Secondarily: a control-plane container** — it holds credentials (AD-01), Project Admins, and
  Project-owned resources.
- **Not decided as, and not assumed to be, a billing or deployment boundary.** Nothing in the
  requirements or this decision requires a Project to correspond to a single billing account or a
  single deployment environment — those may layer on top later (**OPEN**, §25) but are not implied
  by the domain model itself.

**Core Question 2, answered directly: yes, Project is the hard isolation boundary**, exactly as the
requirements state and exactly as AD-01/AD-02 already architecturally assumed. Concretely, this
means: every Project-owned resource and every resource owned by a Project's external user belongs to
**exactly one** Project, and no query, cache key, namespace, or authorization check may treat two
different Projects' data as interchangeable or jointly queryable by default (§14). This decision's
entire purpose is to make that boundary a first-class domain concept rather than an implicit
assumption scattered across AD-01/AD-02's evidence.

---

## 7. Control Plane vs Runtime Plane

Reaffirms and extends the synthesis's control-plane/runtime-plane distinction (synthesis §6), now
answering the two questions this decision specifically raises:

**Core Question 4: can a Project contain multiple Project Admins/developers? DECISION: the domain
model must permit this.** Nothing about a Project as an isolation boundary requires exactly one
administrator — a real company operating Beyond Campus plausibly has more than one engineer who
needs control-plane access. RBAC mechanics (roles, invite flows) are explicitly not designed here
(deferred per task scope), but the domain model must not hard-bake a single-owner assumption the way
today's Persona Provider model does (synthesis §11, rated a real gap).

**Core Question 5: is a Project's developer/admin identity separate from its external-user
population? DECISION: yes, and this is well-supported by the requirements, not merely assumed.**
Requirements §13 explicitly distinguishes Project Admin authority from Agent ownership from Runtime
User; requirements §9 establishes External Users as never having Persona accounts, resolved
exclusively through AD-02's delegated assertion. These are categorically different principal types,
not degrees of the same one:

| | Control Plane (Project Admin / developer) | Runtime Plane (External User) |
|---|---|---|
| How they reach Persona | Plausibly by logging into a future Developer Studio — a Persona-facing web surface | Never directly — only via their own Project's backend, through AD-02's delegated assertion |
| Authentication mechanism | Not decided here, but structurally closer to Persona's existing first-party model (a human authenticating to a Persona-operated UI) than to AD-02's delegation model | AD-02: the Project vouches for them; Persona never authenticates them directly |
| Has a Persona/Clerk account? | Plausible — **ASSUMPTION, not decided here**: a Project Admin logging into Developer Studio is functionally similar to a Persona user logging into Agent Studio today, suggesting Project Admin could be modeled as a **role/membership relationship layered onto an existing Persona User**, rather than inventing a wholly separate authentication system for developers | Never (requirements §9, explicit) |

This asymmetry is a genuinely useful, non-obvious finding: **Project Admins are structurally closer
to Persona Users than to External Users.** It is not decided here (that belongs to a future Developer
Studio / Project Admin RBAC decision, §24) but is recorded as a strong architectural hint that
decision should weigh, because it suggests Persona's *existing* first-party identity model does not
need to be forked to support Project administration — only extended with a membership/role concept.
External Users, by contrast, must never be modeled this way — they are not degraded or restricted
Persona Users, they are a wholly distinct principal type by design (AD-02 §4).

---

## 8. Options Considered

### Option A — Persona itself is a Project

```
Platform
└── Project: Persona
    ├── Persona Users
    ├── Agents / Skills / Knowledge / ...
    └── Runtime state
└── Project: Beyond Campus
    └── ...
```

Every existing Persona resource gains a `projectId`; Persona becomes a first-party instance of the
same Project abstraction Developer Projects use.

### Option B — Persona remains a fully separate, unrelated domain

```
Platform
├── Persona Domain (existing, untouched)
└── Projects (Beyond Campus, Coursify, OpenFounder — a wholly separate system)
```

No shared abstraction of any kind. Persona and the Developer Platform are two independent systems
that happen to run on the same backend codebase.

### Option C — Unified internal isolation abstraction, Persona is a Domain but not a Project

```
Platform
└── Domain (internal, narrow scoping primitive — illustrative name, not binding)
    ├── Persona Domain (fixed, singleton, first-party — NOT a Project)
    ├── Beyond Campus (a Project, and also a Domain instance)
    ├── Coursify (a Project, and also a Domain instance)
    └── OpenFounder (a Project, and also a Domain instance)
```

Every Project is a Domain. Persona's Domain is not a Project. The abstraction is deliberately
narrower than "Project": it only carries the properties needed for resource-ownership scoping,
visibility-boundary evaluation, and runtime-state namespacing — it does **not** carry Project's
product-facing properties (credentials, Project Admin RBAC, Developer API exposure, Developer
Studio presence). Persona's Domain never acquires those properties merely by being a Domain.

---

## 9. Comparison Matrix

| Criterion | A. Persona-as-Project | B. Fully separate | C. Shared Domain, Persona ≠ Project |
|---|---|---|---|
| Conceptual clarity | Superficially highest ("everything is a Project") but misleading — Persona needs so many exceptions the uniformity is illusory (§10) | High for each half individually, but two unrelated mental models to hold simultaneously forever | High — one scoping concept, with an explicit, well-justified asymmetry (Persona is a Domain, not a Project) that is easy to state and remember |
| Security isolation | Strong once migrated, but the migration window itself is a high-risk period; also a live threat (§19-#9) that a bug could make Project-deletion logic target "Project: Persona" | Strong by total separation — but only for as long as the two implementations don't drift or get partially unified ad hoc under time pressure | Strong — uniform domain-scoped predicate is present by default; failure mode requires the shared query mechanism itself to be bypassed (§19, §22) |
| Migration risk | **EXTREME** (§17) — live-data backfill across every collection, including threads/memory, the highest-risk kind of migration | **LOW** for existing Persona code, but risk shifts into unbounded future duplication (see "two parallel worlds" row) | **LOW–MEDIUM** — Persona's domain can be an implicit code-level constant; no live-data backfill required (§17) |
| Backward compatibility | At risk during migration — any bug in the Persona-to-Project backfill directly regresses the live consumer product | Perfect — nothing about Persona changes | Perfect from the user's perspective — the Domain constant reproduces today's query results exactly (§13) while changing the code path underneath |
| Query complexity | Claims one path, actually needs Persona-special-cases scattered throughout — arguably worse than an honest branch (§18) | Permanent explicit branching (`if Persona ... else if Project ...`) in every service touching a shared resource type | One shared, domain-parametrized path; the only branch is at the authentication boundary (AD-01/AD-02), already decided | 
| Authorization complexity | Same special-casing problem as query complexity | Two independent authorization models to keep in sync forever | One authorization shape, two ways of resolving the domain value (Clerk-derived constant vs. AD-01/AD-02-derived) |
| Runtime reuse (AgentFactory, AG-UI, etc.) | Achievable, but only after the full migration lands | Achievable in principle, but nothing structurally prevents the two paths' runtime-parametrization shapes from diverging over time | Achievable immediately — shared infra already takes an identity parameter (synthesis §8); Domain supplies the missing second dimension uniformly (§15) |
| Marketplace semantics | Forces an uncomfortable reinterpretation: is Persona's marketplace "Project: Persona's local marketplace"? Doesn't match the product's actual first-party role (§11) | Untouched — but marketplace *code* can't be reused for a future Project-scoped marketplace without duplication | Untouched user-facing behavior; the query mechanism becomes reusable for a future Project-scoped marketplace without semantic confusion (§13) |
| Visibility semantics | Same tension as marketplace — PUBLIC must be redefined as Project-local even for Persona, changing meaning of an existing, live product concept | No tension, but no shared visibility-evaluation mechanism either | No tension — PUBLIC always means "within this resource's Domain"; Persona's Domain being a singleton reproduces today's behavior exactly (§13) |
| Future sharing possibilities | No clearer than the alternatives — cross-Project sharing is explicitly undecided regardless of this choice | No worse, but a future sharing mechanism would need to bridge two structurally different systems | Slightly better-positioned: a future sharing mechanism has one boundary shape (Domain) to reason about instead of two |
| Developer Studio compatibility | Confusing — would Developer Studio ever show "Project: Persona"? Almost certainly not, which itself proves the unification is artificial | Clean — Developer Studio only ever deals with real Projects | Clean — identical to B here; Developer Studio never sees Persona's Domain (§11) |
| Operational complexity | High during migration, unclear long-term benefit given the special-casing | Low now, compounding over years as duplicated logic accumulates | Low — one shared code path/helper to operate and monitor |
| Risk of two parallel architecture worlds | Averted only nominally — the special-casing recreates it in a hidden form | **This is exactly the risk Option B accepts and does not mitigate** | Averted directly — this is the specific problem the Domain abstraction is chosen to solve (§10) |
| Long-term maintainability | Questionable — a large one-time migration cost followed by an architecture that still needs Persona-specific exceptions | Degrades over time as duplicated implementations diverge | Best — one mechanism, two well-understood ways of supplying its parameter |

---

## 10. Selected Domain Model

**DECISION: Option C.** Restating precisely what the Domain abstraction buys, per the task's
explicit demand not to accept it if it "merely renames Project":

1. **Uniform query-scoping discipline.** Every discovery/visibility query can be written with one
   shape — "match resources where domain = the request's resolved domain" — instead of a
   conditional that's only sometimes present. This directly targets the synthesis's single
   highest-severity finding: unconditionally-global public queries with zero scope filter
   (synthesis §14, §20 Hotspots #1–#3, both EXTREME-rated). A predicate that is *always* present is
   structurally harder to accidentally omit than one that exists only on one of two code paths.
2. **Runtime infrastructure reuse without bifurcation.** AgentFactory, memory namespaces, checkpoint
   scoping, cache keys, and rate-limit keys can all be parametrized by one shape —
   `(domain, actingIdentity)` — instead of two incompatible shapes. This is the concrete mechanism
   that makes the requirements' "shared infrastructure, isolated products" Core Principle
   (requirements §6) literally true in code, not just aspirational (§15).
3. **A single place to reason about the isolation invariant**, for security review, audit, and
   onboarding — one concept ("every resource and every runtime state belongs to exactly one domain")
   instead of two parallel invariants that must independently stay correct forever.
4. **No forced migration of Persona's existing data, identity model, or product semantics.** Because
   Persona's domain value can be a single, fixed, well-known constant baked into Persona's own code
   paths — not a stored field requiring a live-data backfill on day one — Option C avoids Option A's
   EXTREME migration burden entirely (§17). This is the decisive practical difference from Option A:
   A demands Persona's data, identity, *and* product semantics all bend to fit Project's shape
   immediately; C demands only that a shared *structural* concept exist, which Persona satisfies
   today by treating "the Persona domain" as an implicit constant.
5. **Avoids Option B's specific, named failure mode** — permanent duplicated implementations of
   ownership, visibility, and runtime-scoping logic across two unrelated systems, diverging further
   with every future decision.

**Why this is not "merely renaming Project," concretely:** Project remains a product/business
concept — it has credentials (AD-01), Project Admins, a future Developer API, a future Developer
Studio entry. Domain is deliberately narrower and lower-level — a pure isolation/scoping primitive.
Every Project is a Domain instance, but Persona's Domain instance explicitly does **not** acquire
Project's product-facing properties: no Project credentials for Persona, no AD-02 delegation for
Persona users, no Project Admin RBAC for Persona's existing platform-admin role, no Developer Studio
entry for Persona. If Option C meant "Persona-the-Domain has all the same properties as a Project,
just under a different label," it would fail the task's test and should be rejected as Option A in
disguise. It does not, because the properties genuinely differ (§11).

---

## 11. Persona Relationship to Projects

**This is the most important section, per the task brief, and the answer is: (C) Persona maps
internally to the common Domain abstraction while retaining fully distinct product semantics. It is
neither (A) a first-party Project nor (B) entirely outside any shared model.**

Explicitly, Persona:

- **Does** share the underlying isolation/scoping *mechanism* (Domain) with Developer Projects —
  its resources conceptually belong to "the Persona Domain," and future query/authorization code can
  be written generically against "the current domain" rather than special-cased per product.
- **Does not** share Project's *identity* mechanism — Persona users are authenticated first-party via
  Clerk; Persona is its own identity authority, categorically different from AD-02's delegated-
  assertion model for external users (§7, §12).
- **Does not** share Project's *administrative* mechanism — Persona's platform-admin role
  (`role: 'admin'`, synthesis §13) is not, and does not become, "Project Admin of Project: Persona."
  It remains Persona's own, separate, platform-wide concept, untouched by this decision.
- **Does not** appear in, or become manageable through, a future Developer Studio or Developer API.
  Persona is managed exclusively through its existing first-party surfaces (Agent Studio and whatever
  platform-admin tooling exists today), consistent with the requirements' explicit instruction that
  Developer Studio is not a reinterpretation of Agent Studio.
- **Does not** require immediate schema changes to any existing collection (§17) — the Domain value
  for existing Persona resources can be an implicit, code-level constant rather than a stored field
  requiring migration, at least for this decision's purposes (the persistence layer's final choice on
  whether to *also* store this constant explicitly is deferred, §22).

**Why changing Persona's semantics to literally become a Project would not be worth the cost (the
Option A rejection, restated concretely for this section):** Persona's marketplace exists to be
*the* first-party discovery surface for the platform's own consumer product — it is categorically
different from "a Project's local marketplace," which exists to power one specific external
product's own users. Forcing Persona's PUBLIC visibility to mean "public within Project: Persona"
would be technically consistent but semantically hollow, since there is nothing else in "Project:
Persona" to be distinguished from — the reinterpretation buys nothing while risking the live
product's core discovery behavior during migration (§17, §19-#9).

**Why NOT sharing any structural concept at all (pure Option B) would eventually force building two
parallel versions of every service:** every future resource type, every future authorization rule,
and every future runtime-scoping decision would need to be designed and implemented **twice** —
once for Persona's bare-`userId` shape, once for Projects' `(projectId, externalUserId)` shape — with
no shared contract keeping them consistent. The Domain abstraction is precisely what prevents this:
Persona's `userId` and a Project's `(projectId, externalUserId)` both resolve to the same conceptual
shape, `(domain, actingIdentity)`, allowing shared code to consume either without knowing or caring
which one it received (§12, §15).

---

## 12. Identity Interaction

**Core Question 3: can one external user belong to multiple Projects?** No cross-Project account
linking is invented or implied by this decision, reaffirming AD-02 without modification:
`(BeyondCampus, rahul)` and `(Coursify, rahul)` remain intentionally, structurally unrelated
identities. The Domain model does not require, and must not introduce, any structure connecting a
real person across Projects — if cross-Project account linking is ever wanted, it is an explicit,
separately-designed future feature (**OPEN**), not an implication of this decision.

**Identity model shape, per the task's explicit question:**

```
PERSONA:                              DEVELOPER PROJECT:
Clerk identity                        Project Credential (AD-01)
  ↓                                     +
Persona User                          externalUserId (AD-02)
  ↓                                     ↓
"acting identity within               Project-qualified external user
 the Persona Domain"                    ↓
                                       "acting identity within
                                        the {Project}'s Domain"
```

**DECISION: this does not require one universal User concept, and does not unify authentication
mechanisms.** It requires:

1. **Multiple, genuinely distinct principal types** — Persona User (first-party, Clerk-authenticated),
   Project Admin/developer (plausibly Persona-User-shaped via a future role/membership relationship,
   §7 — not decided here), and External User (never a Persona account, wholly delegated per AD-02).
2. **A thin abstraction above them, narrowly scoped to one purpose only**: resolving, for any given
   authenticated request, "which Domain does this belong to, and what is the stable handle used to
   scope resources/runtime-state for the acting identity within it." This abstraction does **not**
   unify how each principal type authenticates, what data it carries, or how it's administered — it
   only supplies the two values (`domain`, `actingIdentity`) that downstream resource-scoping and
   runtime-infrastructure code needs, regardless of source (§15).

This directly answers the task's question: **multiple principal types, plus a thin scoping
abstraction above them — not a universal User type.**

---

## 13. Visibility Semantics

**DECISION (domain-level only, per task scope — the full future visibility model is not designed
here):** PUBLIC, UNLISTED, and PRIVATE always mean "discoverable/accessible within the resource's
own Domain," never globally. This single definition covers both Persona and every Project without
modification.

The apparent tension the task brief raises — Persona's PUBLIC (today: platform-global) vs. a
Project's PUBLIC (requirements: Project-local) — is fully resolved, not merely reconciled, by one
observation: **Persona's Domain is a singleton.** There is exactly one Persona Domain, so "public
within Persona's Domain" and "public across the whole platform" produce **identical result sets** in
practice, even though the underlying query mechanism becomes domain-scoped rather than unscoped.
This is why Option C requires **zero observable behavior change** for existing Persona users
(§17) while still closing the exact security hotspot the synthesis identified (an unconditionally
global query becomes a domain-scoped query that happens to return the same rows, because nothing
else shares Persona's domain).

This does not itself resolve future, richer visibility questions (e.g., whether a Project might one
day want finer-grained visibility tiers than Persona's three) — those remain for a dedicated
visibility-model decision, not this one.

---

## 14. Resource Isolation Defaults

**DECISION, directly answering the task's explicit ask — default boundaries only, no
sharing/import mechanism designed:**

| Direction | Default | Basis |
|---|---|---|
| Persona → Project | A Persona public Agent is **not** automatically usable inside Beyond Campus | Requirements §16: Persona Marketplace ≠ Beyond Campus Marketplace, even on shared infrastructure |
| Project → Persona | A Beyond Campus public Agent does **not** automatically appear in Persona Explore | Same; requirements §10 invariant: "Existing Persona resources must not automatically leak into Developer Projects" and its mirror, "Developer Project resources must not automatically leak into Persona" |
| Project A → Project B | A Coursify Agent is **not** referenceable by Beyond Campus | Requirements §29 invariant 3: "Project A must not access Project B's resources without a future explicitly designed sharing mechanism" |

**Why the Domain model guarantees this by default, not merely by policy:** because every resource
belongs to exactly one Domain and every query is domain-scoped by construction (§10), cross-domain
access would require an *additional*, deliberate mechanism to bypass the default predicate — one
that does not exist and is not designed here. This is the practical meaning of "Project is the hard
isolation boundary" (§6) translated into query behavior: isolation is the default state achieved by
doing nothing extra, not a feature that must be separately built and could be forgotten.

---

## 15. Shared Infrastructure vs Shared Scope

**SHARED INFRASTRUCTURE does not mean SHARED DATA SCOPE — this is the organizing principle of this
entire decision, stated explicitly per the task's emphasis.**

Per the synthesis's evidence (§7 Capability Readiness Matrix, §8 Shared Agent/Isolated Runtime
finding, §18-A Preserve list), every piece of Persona's runtime machinery is already
identity-agnostic in *code* and identity-*parametrized* in *invocation*:

| Component | Synthesis rating | Domain-model consequence |
|---|---|---|
| DeepAgent | GREEN | Fully reusable — receives pre-scoped backends/namespaces at construction, has no domain concept baked in |
| AgentFactory | YELLOW (shape already right) | `buildAgent(agentId, actingIdentity, ...)` — the `userId` parameter generalizes to a `(domain, actingIdentity)`-qualified value; no restructuring, only re-keying (AD-02 §17, extended here) |
| AG-UI | YELLOW | Event translation is purely functional; only the routing layer that resolves identity needs to supply the domain-qualified value |
| LangGraph / checkpoint infra | RED at the storage layer (no tenant field today), but the *execution engine itself* is domain-agnostic | The engine is reused unchanged; only the checkpoint *key* needs the domain dimension (AD-02 §17) |
| Memory abstraction (StoreBackend/namespace pattern) | YELLOW | The namespace-array shape (`['users', userId, ...]`) is already hierarchical and extensible — becomes `['domains', domainId, 'users', actingId, ...]` (illustrative), not redesigned |
| MCP execution (`authMode: owner/user`) | GREEN | Directly reusable; the `(mcpId, userId)` compound key becomes `(domain, mcpId, actingId)` (AD-02 §16) |
| Skills / Knowledge retrieval | YELLOW | Same re-keying pattern; retrieval logic itself untouched |
| Provider/runtime machinery | RED (deepest coupling, per synthesis §11) | Genuinely needs new work (a shared/Project-level provider concept does not exist today) — this is a real exception, not resolved by the Domain model alone, and is flagged as its own consequence (§21) |

**The mechanism that makes this concrete:** the same `AgentFactory.buildAgent()` call, the same
AG-UI SSE handler, the same LangGraph executor serve a Persona request and a Beyond Campus request
identically — what differs is only the `(domain, actingIdentity)` value threaded through
construction, which determines which memory documents, which checkpoint, which MCP credentials, and
which cache entry that specific invocation touches. The **code path is shared**; the **data each
invocation can reach is not** — this is the literal meaning of "shared infrastructure, isolated
products" (requirements §6), and it is only achievable cleanly because Option C supplies one
consistent second dimension (`domain`) for all of this machinery to key on, rather than two
incompatible ones.

---

## 16. Project Lifecycle Semantics

Conceptual only — no fields or schema (per task scope).

**Core Question 6: can a Project exist without external users? DECISION: yes.** This directly reuses
AD-02 §13's finding that `externalUserId` is optional at the protocol level — some calls are
Project-level/control-plane operations (e.g., a Project running its own System/Project Agents
directly via its credential, with no runtime end user behind the call at all). A Project must be a
valid, operable entity in this state.

**Core Question 7: can a Project exist without Project-owned resources? DECISION: yes.** A newly
created, empty Project (credentialed but with no agents/skills/etc. yet) is a valid state, not an
error state. Project creation and "Project has resources" are independent facts.

**Core Question 8: lifecycle stages, conceptual meaning only:**

- **Create** — a Project entity comes into existence. Per §7's finding, plausibly created by a
  Persona-authenticated human (a developer) who becomes its first control-plane member. At creation,
  a Project has no credentials, no resources, and no external users yet — all are independently
  optional (§16 above).
- **Active** — the Project can hold valid credentials (AD-01), authenticate requests, resolve
  external users (AD-02), and its resources are usable per its own visibility rules (§13).
- **Disabled/Suspended — DECISION (conceptual):** suspension is a **Project-level kill switch**,
  layered *above* individual credential revocation (AD-01 revokes one credential; suspension gates
  *all* of a Project's credentials and runtime execution at once, regardless of individual
  credential status). This mirrors the defense-in-depth, two-layer authorization pattern the
  synthesis and AD-01/AD-02 already identified as worth preserving (synthesis §18-A;
  `canUserExecuteAgent` + AgentFactory's second check). Suspension must be **reversible** and must
  **not** delete data — it stops new authentication and new execution, nothing more. This is
  distinct from deletion.
- **Deleted — DECISION (conceptual, lifecycle-level only, no mechanics designed):** given (a) the
  synthesis's explicit warning that Persona's existing all-or-nothing `userService.deleteUser()`
  cascade is already flagged as an anti-pattern (synthesis §13, reaffirmed in AD-02 §11.4/§21), and
  (b) data-retention/compliance policy is explicitly undecided, Project deletion is a **distinct,
  likely staged** lifecycle transition (e.g., disable → grace period → hard delete) — the exact
  mechanics are **OPEN**, deferred to a future data-retention/Project-lifecycle decision (§25). What
  **is** decided here, as a hard invariant: whatever the eventual mechanics, deleting or disabling a
  Project must be **structurally incapable of touching Persona's own first-party data**, because
  Persona is not a Project and no Project-lifecycle code path can ever resolve to Persona's Domain
  (§19-#9 makes this concrete as a security property, not just a lifecycle note).

---

## 17. Migration Impact

Classified per resource type, per option. **LOW / MEDIUM / HIGH / EXTREME.**

| Resource | A. Persona-as-Project | B. Fully separate | C. Shared Domain (Persona = constant) |
|---|---|---|---|
| Agents | **EXTREME** — live backfill of every doc, slug uniqueness must become compound, global-vs-Project visibility must be reconciled on the platform's most complex, most-coupled module (synthesis: rated "C — deep coupling") | LOW (nothing changes) | **LOW–MEDIUM** — existing queries re-routed through a shared, domain-parametrized helper called with a constant; no data backfill |
| Skills | HIGH — backfill + `isPublic` scope reconciliation | LOW | LOW–MEDIUM |
| Knowledge | HIGH — backfill + Qdrant collection-naming reconciliation | LOW | LOW–MEDIUM |
| MCPs | HIGH — ownership backfill + OAuth callback redirect reconciliation (hardcoded `/dashboard/...` today, synthesis §12) | LOW | LOW–MEDIUM |
| Providers | HIGH — deepest existing coupling (synthesis §11); forcing this through the new model on day one risks scope creep beyond this decision | LOW | LOW–MEDIUM (re-routing only; the underlying provider-sharing gap is a separate, real problem either way, §15) |
| Threads | **EXTREME** — backfilling `projectId` onto live conversation records is a correctness-critical, high-blast-radius migration | LOW | **LOW** — a constant domain value requires no change to existing thread documents |
| Memory | **EXTREME** — namespace restructuring on live documents is one of the highest-risk migrations possible (a bug silently strands users' memory) | LOW | **LOW** — same reasoning as Threads |
| Ratings/reviews | LOW (synthesis: already a known, largely-unimplemented product gap) | LOW | LOW |
| Agent Studio | MEDIUM — every creator-surface call implicitly gains a constant `projectId=persona`, a systemic if mechanical change | LOW | LOW–MEDIUM — same mechanical re-routing, but zero data migration |
| Marketplace discovery | **EXTREME** — the platform's core consumer-facing behavior is put at direct regression risk during migration | LOW (but see duplication note below) | **LOW–MEDIUM** — critically, a domain-scoped query with the Persona constant reproduces today's result set *exactly* (§13), so this can close the EXTREME security hotspot with **zero observable behavior change** |

**Reading this table honestly:** Option B's uniformly LOW migration scores are real but
misleading — they measure only the cost of *not building the Developer Platform's shared version* of
each capability. The true, ongoing cost of Option B is **permanent duplication**: every one of these
rows would eventually need a second, Project-facing implementation built and maintained
independently forever (§10, §18). Option C is the only option that is both low-migration-risk *and*
avoids that duplication, because the shared code path already exists — only the parameter supplied
to it differs.

---

## 18. Query / Authorization Consequences

**Option A** claims one unified query/authorization path but does not actually deliver it: Persona's
marketplace, Clerk-based auth, and platform-admin role are different enough from real Project
semantics that a literal unification would need pervasive special-casing —
`if (projectId === PERSONA_DOMAIN_ID) { /* skip Project Admin RBAC, use Clerk instead, ... */ }` —
scattered wherever Project-specific logic exists. This is arguably **worse** than an honest branch,
because the special-casing is hidden inside code that claims to be uniform.

**Option B** produces the literal `if Persona: ownerId === personaUserId; else if Project: projectId
+ externalUser...` branching the task brief warns about, in every service that touches a resource
type both products need — permanently, and growing with every future decision.

**Option C** confines branching to exactly one place: the authentication boundary, which AD-01 and
AD-02 already built (Clerk vs. Project-credential middleware, populating structurally distinct
context objects — AD-01 §13). **Downstream of that point, all query and authorization logic is
domain-parametrized and uniform** — service/repository code needs to know only "what domain value
and what acting-identity value am I scoping this operation to," not "am I serving Persona or a
Project." This is a genuine, mechanism-backed reduction in branching, not merely a preference.

---

## 19. Security Analysis

Threat-modeled against every item the task brief specified, evaluated for Option C (the selected
model) with explicit comparison to A/B where the choice changes the outcome:

1. **Project resource leaking into Persona marketplace** — Prevented by construction: the shared,
   domain-scoped query mechanism (§10, §14) has no code path that queries "all public resources"
   without a domain predicate, because the predicate is part of the shared helper, not optional
   per-caller logic.
2. **Project A accessing Project B data** — Same mechanism; the domain predicate is always present
   and is resolved exclusively from AD-01's trusted `projectId`, never from caller input.
3. **Persona user accidentally resolving Project resources** — A Clerk-authenticated request always
   resolves to the fixed Persona-domain constant, never to a dynamically-resolved Project domain, so
   it cannot structurally reach into a Project's domain space.
4. **Global PUBLIC query accidentally returning Project resources** — This is synthesis Hotspots
   #1–#2 directly. Option C's uniform-predicate discipline is the architectural mitigation, but
   **honestly stated**: this decision establishes the *invariant*; a later persistence/query-layer
   decision must actually *enforce* that no query can be constructed without it (§22) — the domain
   model alone makes this easy to achieve and easy to audit, it does not by itself guarantee it in
   code that hasn't been written yet.
5. **Cross-domain cache collisions** — AgentFactory cache key generalizes to
   `${cacheKey}:${domain}:${actingId}` (illustrative), extending AD-02 §17's finding uniformly rather
   than introducing a new, narrower `(projectId, externalUserId)`-only shape.
6. **Cross-domain memory collisions** — Same reasoning, extends AD-02 §17.
7. **Cross-domain thread collisions** — Same reasoning, extends AD-02 §17.
8. **Administrator/runtime-user confusion** — Addressed by keeping control-plane and runtime-plane
   principals explicitly distinct within a Domain (§7), reaffirming rather than redesigning the
   synthesis's §6 finding.
9. **Project deletion accidentally deleting Persona data** — **This is a concrete, decisive point in
   favor of rejecting Option A.** Under Option C/B, this is structurally impossible: no Project
   entity record represents Persona, so no Project-deletion code path (built for real Developer
   Projects) could ever be pointed at Persona, even by a bug or an operator mistake. Under Option A,
   this would be a **live, real risk**: if Persona literally is a row in a `projects` collection,
   generic Project-deletion logic has a legitimate-looking target that must be specifically,
   permanently excluded — a standing landmine for every future engineer touching that code path.
10. **Migration bugs causing resources to lose their domain** — Under Option C, this risk barely
    exists for Persona's *existing* data (nothing is migrated — §17); it applies only to *new*
    Project data, which is created with a domain from day one. Under Option A, this is a real,
    significant risk across every existing collection simultaneously.
11. **"Missing domain scope" queries (fail-open behavior)** — The task's central emphasis, answered
    honestly: **the domain-model choice alone cannot guarantee fail-closed behavior.** It makes
    fail-closed behavior *achievable and enforceable* (one shared helper to audit/lint, versus N
    scattered conditionals), but actually guaranteeing "no query is constructible without specifying
    a domain" is a property of the *persistence/query-layer* decision that must follow this one
    (§22) — e.g., a query-builder that structurally requires the parameter, or physical storage
    separation that makes an unscoped read return nothing rather than everything. This decision's
    contribution is making that later guarantee *tractable*; it does not itself implement it, and
    this document does not overclaim that it does.

---

## 20. Rejected Alternatives

### 20.1 Option A — Persona itself is a Project

Rejected. Requires an EXTREME migration touching every collection, including the two highest-risk,
correctness-critical ones (Threads, Memory) with live user data (§17). Forces a reinterpretation of
Persona's marketplace and visibility semantics that is technically consistent but semantically
hollow, since Persona's Domain would have nothing else to be "local" relative to (§11, §13). Does
not actually deliver the uniform-code benefit it promises, because Persona's real differences from a
Developer Project (first-party Clerk identity, platform-admin role, no Developer API exposure)
would force pervasive special-casing anyway (§18). Introduces a standing, structural security risk
(Project-deletion logic having a live target named "Persona," §19-#9) that Options B and C avoid
entirely by construction.

### 20.2 Option B — Persona remains fully separate, no shared abstraction at all

Rejected in its *pure* form — not because keeping Persona's product semantics distinct is wrong
(that part is correct and preserved in Option C, §11), but because building the Developer Platform
with **zero** shared structural concept commits the codebase to permanently duplicating ownership,
visibility, and runtime-scoping logic across two unrelated systems (§10, §17's duplication note,
§18). This is exactly the "two parallel architecture worlds" risk the comparison matrix (§9) was
asked to weigh, and it is the one risk Option B does not mitigate at all.

### 20.3 Other models considered and not adopted

- **A variant of Option A where Persona is "the first Project" with elevated/default permissions** —
  rejected for the same reasons as Option A; renaming the exception doesn't remove it.
- **A peer-to-peer "federation" model** where Domains have explicit, mutual trust relationships for
  resource sharing — rejected as solving a problem (cross-domain sharing) that is explicitly
  undecided and out of scope for this phase (requirements list this as an open architecture question,
  not a requirement); adding it now would be inventing abstraction ahead of a stated need, which the
  task explicitly warns against.

---

## 21. Consequences for Ownership Architecture

A future polymorphic-ownership decision must express ownership as `(domain, ownerPrincipal)`, not a
bare owner reference. Persona's existing `ownerId: ObjectId → User` pattern can be treated as
implicitly `(persona-domain-constant, ownerId)` without requiring immediate schema change (§17),
giving that future decision room to choose its own representation (a discriminator field, a compound
key, separate collections) without being forced by this decision. The Provider model's deeper
coupling (synthesis §11, §15 above) is **not** resolved by the Domain model alone — a shared/Project-
level provider concept remains a genuinely open design problem for that later decision.

## 22. Consequences for Persistence/Tenancy Architecture

**OPEN, explicitly deferred, with a recorded leaning:** whether "domain" becomes an actual, always-
present, stored field on every collection (even for Persona resources, defaulted to the Persona
constant) versus a purely application-layer routing concept for Persona while being a real field only
for Project resources. This decision leans toward recommending the former — storing a real,
always-present domain-scope value even for Persona resources — specifically because it is what makes
the shared query-builder/helper approach enforceable and gives the "fail closed if the predicate is
missing" property (§19-#11) a concrete implementation path (e.g., a required, non-nullable field that
a query-builder cannot omit). This is a recommendation for that decision to weigh, not a decision made
here — collection-vs-field tenancy remains explicitly out of scope (per task instructions).

## 23. Consequences for Runtime Isolation

Extends AD-02 §17's re-keying requirement uniformly: threads, checkpoints, memory, MCP user
credentials, AgentFactory cache, and rate limits must all be scoped by `(domain, actingIdentity)` —
Persona's `actingIdentity` = Persona `userId` with `domain` = the Persona constant; a Project's
`actingIdentity` = `externalUserId` (or the Project itself, for Project-level operations, §16) with
`domain` = `projectId`. The previously-verified `thread.agentId`-vs-`x-agent-id` gap (synthesis §10,
§21.1; carried forward in AD-02 §17/§21) must still be closed in the same future re-keying effort —
this decision does not change that requirement, only reaffirms it under the more general Domain
framing.

## 24. Consequences for Developer API / Studio

A future Developer Studio manages **Project**-domain entities exclusively — it never manages, lists,
or exposes Persona's Domain, since Persona has no Project credentials, no AD-02 external users, and
no Project Admin RBAC (§11). The §7 finding — that Project Admin/developer identity is plausibly a
role/membership relationship layered onto an existing Persona User rather than a wholly separate
authentication system — is recorded as a strong hint for that decision, not resolved here.

---

## 25. Open Questions

1. Whether Project ever becomes a billing or deployment boundary in addition to an isolation
   boundary (§6) — not implied by this decision either way.
2. Exact mechanics of Project deletion (staged transition, grace period, retention policy) — §16,
   deferred to a future data-retention/Project-lifecycle decision.
3. Whether domain is a stored field or an application-layer constant for Persona specifically — §22,
   leaning stored-field but not decided.
4. Whether/how Project Admin identity formally reuses the Persona User concept via a
   role/membership relationship (§7, §24) — a strong hint, not a decision.
5. Whether cross-Project resource sharing or cross-Project account linking is ever built, and if so,
   how it interacts with the Domain boundary established here (§12, §14, §20.3) — explicitly
   undecided, consistent with the requirements document's own open-questions list.
6. Whether the Provider model's deeper Persona-coupling (§15, §21) needs its own dedicated
   architecture decision before or alongside ownership polymorphism.

---

## 26. Implementation Constraints

Collected from §10–19 and §21–24 for visibility, non-binding on exact implementation:

- Every future query/authorization code path must be written against a shared,
  domain-parametrized mechanism, not a per-product conditional (§10, §18) — this is the central
  discipline the rest of the architecture must uphold for the security properties in §19 to hold in
  practice.
- Persona's domain value must be treated as fixed and singleton wherever it's supplied, never as one
  of many dynamically-resolved values on Persona's own code paths (§11, §13).
- No Project-lifecycle operation (suspend, delete) may ever be constructible in a way that could
  target Persona's Domain (§16, §19-#9) — this must remain true regardless of how Project lifecycle
  is eventually implemented.
- Runtime infrastructure re-keying (AgentFactory cache, memory namespaces, checkpoints, MCP user
  credentials, rate limits) should generalize to `(domain, actingIdentity)`, not a
  Project-only-shaped `(projectId, externalUserId)`, so Persona's constant-domain case is served by
  the identical code path (§15, §23).
- The thread `agentId`-vs-`x-agent-id` gap must be closed in the same future effort that performs
  this re-keying, not deferred further (§23, carried from AD-02).
- The Provider model requires dedicated attention beyond generic domain-scoping — a shared/Project-
  level provider concept does not exist today and is not created by this decision (§15, §21).

---

## 27. Evidence / References

| Claim | Source |
|---|---|
| AD-01 established `AuthenticatedProjectContext`, trusted `projectIdentity`, "never trust caller-supplied projectId" invariant | `architecture/01-project-authentication.md` §1, §10, §14 |
| AD-02 established `(projectId, externalUserId)`, delegated trust model, optional externalUserId, re-keying requirement for threads/memory/checkpoints/MCP-credentials/cache/rate-limits | `architecture/02-external-user-identity.md` §1, §4, §13, §15, §17 |
| Persona is single-tenant today; zero scope-filtered queries anywhere; global unique indexes | Synthesis §9, §14, §20 (Hotspots #1–#3) |
| Shared-agent/isolated-runtime finding; AgentFactory/AG-UI/DeepAgent already identity-parametrized in shape | Synthesis §7, §8, §18-A |
| Provider model is the deepest existing Persona coupling | Synthesis §11 |
| `userService.deleteUser()` all-or-nothing cascade flagged as an anti-pattern | Synthesis §13; reaffirmed AD-02 §11.4/§21 |
| `thread.agentId` never compared against requested `x-agent-id` | Synthesis §10, §21.1, §22.5 — independently re-verified against live source |
| Requirements: Project is the hard isolation boundary; scope ≠ visibility; Persona Marketplace ≠ Project Marketplaces; existing Persona must keep working | `product-research/10-developer-platform/developer-platform-requirements.md` §6, §8, §16, §33.1 |
| Requirements: Project Admin authority distinct from ownership; Platform Authority above Project Admin | Requirements §13–14 |

---

*This document decides the Project/Domain model only. It establishes that Project is the hard
isolation boundary, that a narrow internal Domain abstraction unifies scoping mechanics without
unifying identity or product semantics, and that Persona is a Domain but never a Project. It
explicitly defers ownership schema, persistence/tenancy representation, Project Admin RBAC, the
Developer API surface, Developer Studio UX, SDK design, billing, and quotas to later, separately-
scoped decisions (§21–24 record the constraints each inherits).*
