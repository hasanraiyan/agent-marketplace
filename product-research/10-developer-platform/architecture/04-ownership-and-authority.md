# Architecture Decision 04 — Ownership & Authority

> **Status:** DECIDED (this document). Scope: conceptual resource ownership, the principal
> taxonomy, and Project administrative authority. Starts strictly after AD-01 (Project
> authentication), AD-02 (external-user identity), and AD-03 (Project/Domain model) — none of the
> three is reopened.
> **Explicitly NOT decided here:** MongoDB field names, ObjectId vs. string representation, exact
> Project/ExternalUser/ProjectMembership schema, RBAC permission matrix, collection-vs-field
> tenancy, indexes, migrations, REST endpoints, Developer Studio screens, SDK APIs, billing,
> quotas, Provider resolution/fallback algorithm, cross-Domain sharing. Where the selected model
> constrains these, the constraint is recorded (§26–28), not designed.
> **Inputs:** `product-research/10-developer-platform/developer-platform-requirements.md`,
> `product-research/10-developer-platform/05-codebase-readiness-synthesis.md`,
> `architecture/01-project-authentication.md`, `architecture/02-external-user-identity.md`,
> `architecture/03-project-domain-model.md`.
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION:** Ownership of durable resources (Agents, Skills, Knowledge Bases, MCP definitions,
Provider configuration) is expressed conceptually as **`(Domain, OwnerType, OwnerIdentity)`**,
where `OwnerType ∈ {PersonaUser, Project, ExternalUser}` — exactly three types, no more. `Domain`
is always carried explicitly, even where technically derivable from `OwnerType` (§8.1), so every
ownership check has one uniform shape regardless of which type it's checking. **Project itself is a
valid owner** — when `OwnerType = Project`, the owner *is* the domain (no further identity is
needed beneath it, §8.1). **Project Admin is never an owner type** — no evidence in the
requirements supports developer-personal resource ownership inside a Project (§12.3), so none is
invented.

**Creator is a distinct, always-recorded attribute, separate from Owner**, required specifically
because Project-owned resources are routinely created by a human (a Project Admin) who is not the
resource's owner (§20).

**Runtime state (Threads, Memory, checkpoints, MCP runtime-user credentials, ephemeral files) is
explicitly NOT modeled through the Owner taxonomy.** It uses a parallel, narrower **Subject**
model — `(Domain, Subject, [Agent])` — because it lacks ownership semantics entirely (no publish,
no visibility tier, no transfer). `Subject` draws from the same three principal types as `OwnerType`
(PersonaUser, Project, ExternalUser), but this is a structural coincidence, not a reason to merge
the two concepts into one universal abstraction (§15).

**Project Admin/developer identity is a Persona User with Project membership and role — not a
separate `DeveloperAccount` principal type** (§6). **Platform Admin is an authority level on a
Persona User, not a distinct principal type or an owner type** (§19).

---

## 2. Context

AD-01–AD-03 established how a Project authenticates, how it asserts an external user, and that
Project is the hard isolation boundary shared through a narrow Domain abstraction that Persona
participates in without becoming a Project. None of the three decided **who can own what** inside
that boundary, or **how Project-level administrative authority relates to ownership** — this
decision supplies both, at the conceptual level only.

---

## 3. Requirements (Restated, Unweakened)

Two resource-ownership forms must coexist inside a Project: Project/System-owned (requirements
§11) and external-user-owned (requirements §12). Project Admin authority must not be represented as
user impersonation and is explicitly distinct from ownership (requirements §13, §29 invariant 7).
Platform Authority sits above Project Admin (requirements §14). MCP's owner-vs-user auth
distinction must be preserved (requirements §23). Provider credential ownership/billing is
explicitly listed as undecided (requirements, "What Is Not Decided Yet"). Auditable actions
("Agent owner: sabik_123 / Action: suspended / Actor: project_admin") are explicitly anticipated
(requirements §13) without a schema being mandated.

---

## 4. Existing Persona Ownership Model

**FACT** (synthesis §9, re-confirmed): every current Persona resource type (Agent, Skill,
KnowledgeBase, MCP, Provider) uses the identical shape — `ownerId: ObjectId → User`, one owner,
always a Persona User, checked via `ownerId.toString() !== userId.toString()`. There is no creator/
owner distinction today (they are always the same value) and no concept of a resource owned by
anything other than an individual Persona User. AD-03 already established that Persona's ownership
model is preserved, not migrated (AD-03 §11, §17) — this decision must extend the taxonomy without
disturbing that.

---

## 5. Principal Taxonomy

Per the task's explicit list, evaluated against evidence — three fundamental, domain-scoped,
ownership/subject-capable principal types, plus two **authority overlays** that are not additional
types:

| Principal | Own resources? | Create resources? | Administer? | Execute agents? | Authenticated how | Domain-scoped? | Authority scope |
|---|---|---|---|---|---|---|---|
| **PersonaUser** | Yes (Persona resources) | Yes | Only own (+ Platform Admin overlay, below) | Yes (own + Persona-public) | Directly by Persona (Clerk) — first-party | Yes — always the Persona Domain | Resource-local |
| **Project** | Yes (Project/System resources — the domain *is* the owner, §8.1) | No (a human creator acts; Project becomes owner, §20) | N/A (Project isn't an actor) | Narrowly — Project-level/control-plane calls with no externalUserId (AD-02 §13) act as the Project itself | Directly by Persona (AD-01 credential) — the terminus of that trust chain, not delegated from anyone | Trivially — a Project effectively *is* a Domain (AD-03) | Domain-wide (its own domain only) |
| **ExternalUser** | Yes (user-owned resources, requirements §18) | Yes | Only own | Yes — primary mode | Never directly — delegated per AD-02 | Yes — meaningless without its paired Project (AD-02) | Resource-local |
| *(overlay)* **Project Admin authority** | No (§12.3) | Yes, as creator of Project-owned resources | Yes — the defining capability (§18) | Plausibly, for testing (exact mechanics deferred to Developer API/Studio, §28) | Same as the PersonaUser it's layered on (§6) | Scoped to the Project(s) they're a member of | Domain-wide, per membership |
| *(overlay)* **Platform Admin authority** | Never (§19, explicit task rule) | N/A | Yes — platform-wide, cross-domain, exceptional | N/A | Same as the PersonaUser it's layered on | **No** — the one deliberately-scoped exception to AD-03's domain-crossing default-deny | Platform-wide |

**Service/Machine principal:** considered and **not adopted** — AD-01's Project credential already
*is* Persona's machine-authenticated principal (the Project itself, authenticated via a secret,
acting server-to-server). No evidence supports a fourth, separate machine-principal type. Consistent
with "do not invent principal types unnecessarily."

---

## 6. Project Admin Identity Model

**DECISION: Option A — Project Admin/developer is a Persona User with Project membership and
role, not a separate `DeveloperAccount` principal.**

### 6.1 Options evaluated

- **Option A — Persona User + Project membership/role**, mirroring the well-precedented
  account/organization-membership/role shape used by mature developer platforms (GitHub
  organizations, Vercel teams, Stripe's team members) — one first-party account, a many-to-many
  membership relationship to one-or-more Projects, a role on each membership.
- **Option B — a separate `DeveloperAccount` principal**, with its own authentication, session, and
  lifecycle, structurally unrelated to Persona's consumer User model.
- **Option C — other models**: considered a Clerk-authenticated-but-not-User-wrapped record;
  rejected as a distinction without a difference — effectively a worse-organized version of B.

### 6.2 Reasoning

Option A wins on every axis the task asks to evaluate:

- **Authentication reuse** — Clerk-based session management, credential recovery, and lifecycle
  sync (`webhookService`, synthesis §13) already work and are already trusted; Option B would
  duplicate all of it for no evidenced security or product benefit — the same "do not build
  infrastructure the requirements don't ask for" discipline AD-01 applied when rejecting OAuth
  Client Credentials without evidence of need (AD-01 §8).
- **Multi-Project membership** — natural under Option A: one Persona User, many membership rows,
  each with its own role — directly matches "can a Project contain multiple Project Admins" (§7,
  answered yes) and "can one human administer several Projects" (yes, trivially).
- **Invitations / leaving a Project** — map cleanly to creating/removing a membership row, never
  touching the underlying identity. A removed Project Admin's account is untouched; only their
  authority over that one Project ends (§23 case 4).
- **Ownership transfer** — moot for Project Admins specifically, because they were never owners in
  the first place (§1, §12.3) — leaving a Project has zero effect on Project-owned resources they
  created (§23 case 1).
- **Future Developer Studio compatibility** — a human logging into Developer Studio is functionally
  the same kind of event as a Persona user logging into Agent Studio: a first-party, Clerk-
  authenticated session. Option A means Developer Studio needs no separate login system.
- **Auditability** — a stable, first-party identity (the Persona User) backs every Project Admin
  action, giving the requirements' anticipated `Actor: project_admin` audit field (requirements
  §13) a real, durable identity to point to (§20).
- **Security** — no new authentication surface is introduced; the existing, already-hardened Clerk
  pipeline is reused unchanged.
- **Coexistence of Persona consumer use and Developer Platform administration on one identity** —
  explicitly desirable (task's own framing) and delivered directly: the same human can browse
  Persona's marketplace as a consumer and administer Beyond Campus as a developer from one login,
  the same way a single GitHub/Stripe/Vercel account is simultaneously an individual user and an
  organization admin.

### 6.3 The critical distinction this does NOT threaten

**"External Users MUST remain separate" is fully preserved.** Project Admin ≠ External User,
categorically (§5, §7). Developers who *operate* Beyond Campus reasonably hold Persona accounts
(they are already interacting with a Persona-hosted surface, Developer Studio) — exactly like
Stripe, Vercel, and AWS all require the *administrator* of an integration to hold a platform
account while the integration's *end users* (Beyond Campus's students) never do. Option A does not
walk back requirements §9's explicit rule that external users never need Persona accounts — it
only concerns the wholly separate population of humans who administer a Project.

### 6.4 A necessary authentication distinction

**DECISION:** Project Admin authentication (a human logging into Developer Studio, via Clerk) and
Project credential authentication (a Project's *backend* calling the Developer API, via AD-01) are
**structurally distinct events**, even though related — a Project Admin's Clerk session is
presumably how they view/create/rotate their Project's AD-01 credentials through Developer Studio,
but the credential itself is a machine secret, never something typed into a browser session or
substitutable for a human login. Conflating these would reintroduce exactly the kind of confused-
identity risk AD-01/AD-02 were built to avoid.

### 6.5 Isolation from Persona-domain authority

**DECISION:** A Persona User's Project Admin membership/role **never** grants them any special
status within Persona's own consumer product, and Persona-domain authority (e.g., Persona's
existing platform-admin `role: 'admin'`) never automatically grants Project Admin authority over
any Project. Membership-derived authority is strictly scoped to the specific Project(s) held, never
bleeding into the Persona Domain or into other Projects — directly reinforcing AD-03's Domain
isolation and heading off a confused-deputy failure mode before it can be designed into anything
(§24).

---

## 7. Domain vs Owner vs Creator vs Actor

Five genuinely independent concepts, using the task's own worked example plus a second one that
shows them diverging further:

| Concept | Beyond Campus example (task's own) | Career Launchpad example |
|---|---|---|
| **Domain** | Beyond Campus | Beyond Campus |
| **Owner** | External User Sabik | **Project** (Beyond Campus itself) |
| **Creator** | External User Sabik (same as owner here) | Project Admin Raiyan (**different** from owner) |
| **Administrator** (authority, not ownership) | Project Admin Raiyan | Project Admin Raiyan (or any other admin) |
| **Runtime Actor** | Rahul (currently chatting with Sabik's public agent) | Any Beyond Campus external user with execute access |

None of these are interchangeable, and no two are guaranteed to coincide. The Career Launchpad
example is the one that matters most architecturally: **Creator ≠ Owner** whenever a human acts
under Project-level authority to create a Project-owned resource (§12, §20).

---

## 8. Ownership Models Considered

### 8.1 Selected — Three-type polymorphic Owner, separate Subject model, separate Creator

`(Domain, OwnerType, OwnerIdentity)` for durable resources; `OwnerType ∈ {PersonaUser, Project,
ExternalUser}`. When `OwnerType = Project`, the owner *is* the domain — there is no further
identity beneath it, since a Project is already an Domain instance (AD-03). Runtime state uses a
separate `(Domain, Subject, [Agent])` shape, never the Owner taxonomy (§15). Creator is a distinct,
always-present attribute alongside Owner (§20).

### 8.2 A single universal "Owner" abstraction for everything (resources AND runtime state, no
separate Creator)

Everything — Agents, Skills, Threads, Memory, MCP credentials — expressed through one polymorphic
Owner field, with Creator folded into Owner (assume they're always the same).

### 8.3 Only two owner types (Project, ExternalUser) — treat Persona as an implicit special case
rather than a real type

Collapses PersonaUser into an ambient default rather than an explicit taxonomy member.

### 8.4 Owner always equals Creator (today's model, unchanged, extended only by adding Project as a
possible owner)

No independent Creator concept anywhere — whoever creates a resource is permanently its owner,
including for Project-owned resources (meaning the creating Project Admin, not the Project, would
own it).

---

## 9. Comparison Matrix

| Criterion | 8.1 Selected | 8.2 Universal Owner (no Subject/Creator split) | 8.4 Owner always = Creator |
|---|---|---|---|
| Conceptual clarity | High — each concept answers exactly one question | Superficially simple, actually confusing — a Thread would carry meaningless "visibility"/"publish" semantics it doesn't have | Simple, but silently wrong for the Project-owned case |
| Support for Project-owned resources | Full — the defining case this decision must solve | Full, but conflates it with runtime-state semantics it doesn't share | **Fails** — cannot express "Raiyan creates, Project owns" at all |
| Support for external-user-owned resources | Full | Full | Full (this is the only case it handles correctly) |
| Persona backward compatibility | Full — PersonaUser is an explicit type, existing behavior preserved unchanged | Full, but drags Persona resources through the same runtime-state-shaped abstraction unnecessarily | Full for existing Persona resources specifically |
| Project Admin semantics | Clean — authority is explicitly separate from ownership (§18) | Risk of conflation — a single Owner field invites exactly the "creator became de facto owner" bug (§24-#6) | **Actively wrong** — Project Admin *becomes* the owner by construction, violating requirements §29 invariant 7 directly |
| Multi-admin Projects | Supported (§6, §7) — orthogonal to ownership entirely | Same | Same, but every admin's created resources are personally owned, not survivable past their membership |
| Auditability | Strong — Creator is a first-class, separate field specifically for this (§20) | Weak — no separate Creator concept to audit against | Weak — "who created it" and "who owns it" are conflated, so audit and access-control questions can't be asked independently |
| Runtime-state compatibility | Strong — Subject model fits Threads/Memory/credentials correctly, without borrowing ownership semantics they don't have (§15) | Poor — forces visibility/publish semantics onto state that has none, real leak risk (§24-#10) | N/A — doesn't address runtime state |
| MCP compatibility | Strong — definition ownership and per-user credential subject are cleanly separated (§16) | Confusing — same conflation risk as general runtime state | N/A |
| Provider compatibility | Adequate for what's decided (§17); explicitly flags the deeper problem for its own decision | Same conflation issue, no added clarity | Insufficient — no Project-level provider concept possible |
| Migration burden | Low — extends, doesn't replace, today's `ownerId` pattern (§26) | Low to implement, but the wrong semantics create rework risk later | None (unchanged), but foundationally wrong for Project-owned resources |
| Authorization complexity | Moderate, but concentrated — one shape for Owner questions, one for Subject questions (§22) | Deceptively low up front, high in practice — every check must special-case "is this actually ownership or actually a subject" | Low complexity, but incapable of expressing the required product behavior |
| Security / confused-deputy risk | Lowest — explicit separations directly prevent the specific confused-deputy patterns identified in §24 | Highest — a single overloaded field is the textbook precondition for exactly this class of bug | High for the Project-owned case specifically (§24-#6, #9) |
| Long-term extensibility | High — new owner types or subject types can be added without disturbing the other concept | Poor — any future distinction discovered later requires retrofitting a split that should have existed from the start | Poor — fundamentally cannot express Project-level authority-without-ownership, ever |

---

## 10. Selected Ownership Model

**DECISION: §8.1**, for the reasons made concrete in §9's matrix, and because it is the only
option that satisfies the task's explicit quality bar: it does not create a universal "Owner"
abstraction merely because it looks elegant (§8.2 rejected, §20), it does not conflate resource
ownership with runtime-state subject (§15), it does not conflate Project Admin authority with
ownership (§18, §24), and it does not assume creator and owner are always the same (§20) — while
still allowing them to coincide in the common case (external-user-owned resources, §13) without any
special-casing.

---

## 11. Persona-Owned Resources

**DECISION:** unchanged from today, expressed in the new taxonomy as `(Persona Domain, PersonaUser,
<userId>)`. AD-03 already established that Persona's domain value is a fixed constant, not
requiring migration (AD-03 §11, §17); this decision adds nothing new here beyond confirming
`PersonaUser` is a first-class `OwnerType`, not an ambient default (§8.3 rejected) — existing
`ownerId: ObjectId → User` semantics map onto this shape without reinterpretation.

---

## 12. Project-Owned Resources

**DECISION:** `OwnerType = Project` means the owner *is* the domain itself — a Project-owned System
Agent, Skill, Knowledge Base, MCP definition, or Provider belongs to Beyond Campus as an entity, not
to any individual human, including whichever Project Admin happened to create it.

### 12.1 Worked answer to the task's own question

If Raiyan creates a System Agent for Beyond Campus and later leaves the Project, **the agent
remains**, unaffected — not as a policy carve-out, but as a direct, structural consequence of the
ownership model: the agent's owner was never Raiyan, it was always `(Beyond Campus, Project, —)`.
Raiyan's departure removes his *membership/authority*, which never had anything to do with the
agent's *ownership* (§7, §23 case 1).

### 12.2 Lifecycle (conceptual only)

- **Create:** performed by a Project Admin (acting under Project Admin authority, §18); resulting
  Owner is always `Project`, never the creating admin — this must be structurally enforced, not
  merely conventional (§24-#13).
- **Modify:** performed by any current Project Admin of that Project — authority derives from
  *current* membership, not from having been the creator (§24-#6).
- **Delete/suspend:** same — Project Admin authority, independent of creator.
- **Publish/change visibility:** same authority basis; visibility change never affects ownership
  (§21).

### 12.3 Developer-personal ownership inside a Project — investigated, not found

The task explicitly asks whether a genuine requirement exists for Project-Admin-personal resources
inside a Project (as opposed to Project-owned ones). **Checked against the requirements
document directly: none is stated.** Requirements §17–19 enumerate exactly two categories —
Project-owned and external-user-owned — and never describe a developer's own, personally-held
resource living inside their Project. **DECISION: no such ownership type is introduced.** If a real
need for it emerges later (e.g., a Project Admin wants a private scratch agent for their own
testing, distinct from both Project-owned and any external user's), that would be a new,
evidence-backed decision — not assumed here (**OPEN**, §29).

---

## 13. External-User-Owned Resources

**DECISION:** `OwnerType = ExternalUser` requires `OwnerIdentity` to always be paired with its
`Domain` — reusing AD-02's core invariant directly: **`owner = "sabik"` alone is never a valid
value; only `(Beyond Campus, ExternalUser, sabik)` is.** This is not a new rule, it is AD-02 §15's
non-collision guarantee applied to the ownership layer specifically (§24-#3, #4).

### 13.1 Lifecycle (conceptual only)

- **Create:** the external user, acting through their Project's own UI/backend (AD-02), creates a
  resource; `Creator = Owner = (Domain, ExternalUser, sabik)` — the common case where the two
  coincide (§20).
- **Modify/Delete:** only the owning external user, or a Project Admin acting under Project-level
  moderation authority (requirements §13) — never conflated; a Project Admin's ability to suspend
  Sabik's agent does not make the Project Admin its owner (§18, §24-#6).
- **Publish (visibility change):** the owner may change their own resource's visibility within the
  Project (§21); a Project Admin may also do so under moderation authority, again without any
  ownership transfer.
- **Transfer:** not designed (explicitly deferred, §23 case 10) — the model's shape supports it
  conceptually (any valid `(Domain, OwnerType, OwnerIdentity)` is a legitimate value), but the
  operation itself (who may initiate it, what it does to runtime state) is future work.
- **External user deletion/deactivation:** per AD-02 §11.4, no automated cascade exists; ownership
  records are not automatically reassigned or deleted — the resource becomes orphaned/dormant, same
  deferred-to-later-retention-policy treatment AD-02 already established, now reaffirmed for
  ownership specifically, not just runtime state (§23 case 3).

---

## 14. Resource-Type Ownership Matrix

| Resource | Valid `OwnerType`(s) | Creator ≠ Owner possible? | Notes |
|---|---|---|---|
| Agents | PersonaUser, Project, ExternalUser | Yes (Project-owned case) | The richest resource type — all three owner types apply directly, matching requirements' explicit System-Agent vs. User-Agent split |
| Skills | PersonaUser, Project, ExternalUser | Yes | Same pattern as Agents (requirements §17–18) |
| Knowledge Bases | PersonaUser, Project, ExternalUser | Yes | Same pattern |
| MCP definitions | PersonaUser, Project, ExternalUser | Yes | Definition ownership only — see §16 for the credential-subject split |
| Provider configuration | PersonaUser, Project | **Not decided** whether ExternalUser applies | See §17 — dedicated, narrower treatment |
| Threads | N/A — **Subject model, not Owner** | N/A | §15 |
| Memory | N/A — **Subject model, not Owner** | N/A | §15 |
| Uploaded files (durable — e.g. Knowledge sources, avatars) | PersonaUser, Project, ExternalUser | Yes | Fits the Owner taxonomy — these are durable, attached assets |
| Uploaded/runtime files (ephemeral — agent workspace) | N/A — **Subject model** | N/A | Synthesis already treats these as architecturally distinct from durable knowledge documents (synthesis §8, §22) |
| MCP runtime-user credentials | N/A — **Subject, not Owner** | N/A | §16 — "subject," not "owner," deliberately, since the credential authenticates *as* someone rather than being possessed by them in the ownership sense |
| Checkpoints | N/A — inherits scoping from its Thread | N/A | No independent subject attribution needed beyond what the Thread already establishes (synthesis §6, checkpoints keyed by `thread_id` only) |
| Ratings/reviews | PersonaUser (today), plausibly ExternalUser in a Project context | Typically no (author = owner is the natural case) | Synthesis notes this is a largely-unimplemented product gap even in current Persona; treated lightly, not a priority for this decision |

---

## 15. Runtime-State Subject Model

**DECISION: runtime state is explicitly NOT forced through the Owner taxonomy.** It uses a
narrower, parallel shape: **`(Domain, Subject, [Agent])`**, where `Subject` draws from the same
three principal types (`PersonaUser`, `Project`, `ExternalUser`) as `OwnerType` — a structural
coincidence worth naming, not a reason to merge the two concepts (§15.2).

### 15.1 Why forcing runtime state through the Owner model would make the model worse

Ownership (for Agents/Skills/Knowledge/MCP-definitions/Providers) implies durable, creator-
controlled rights that have no meaning for runtime state: **modify, delete, change visibility,
publish, transfer.** Nobody "publishes" a thread. There is no "visibility tier" for a checkpoint.
Runtime state answers a different, narrower question entirely: *"which `(domain, actingIdentity)`
is this piece of execution state scoped and isolated to, and optionally, which agent does it
relate to."* Using the Owner shape for this would be actively misleading (implying non-existent
visibility/transfer semantics) and, per §24-#10, a genuine leak risk if a Thread's access check
were ever accidentally implemented by reusing Agent-style visibility logic.

### 15.2 Why Subject and OwnerType share a taxonomy without being the same concept

`Subject` can be `PersonaUser` (a Persona user's own conversation), `ExternalUser` (a Beyond Campus
user's conversation), or — per AD-02 §13's finding that `externalUserId` is optional at the
protocol level — **`Project`** itself, for Project-level System Agent calls with no runtime end
user behind them at all. The same three types answer both "who durably owns this asset" and "whose
execution is this state scoped to," but they are mechanically and semantically distinct questions,
kept as two separate shapes rather than one universal field (§8.2's rejected alternative).

### 15.3 Per resource type

- **Threads:** `(Domain, Subject, Agent)` — extends AD-02 §17's `(projectId, externalUserId)`
  finding uniformly to include Persona's own `(Persona Domain, PersonaUser)` case and the Project-
  level `(Domain, Project)` case.
- **Memory:** `(Domain, Subject, [Agent])` — the agent-scoping is optional, matching today's
  user-level vs. user+agent-level namespace split (synthesis §7).
- **MCP runtime-user credentials:** `(Domain, Subject, MCP)` — see §16.
- **Checkpoints:** inherit `(Domain, Subject)` from their owning Thread; no independent attribution
  (§14).
- **Ephemeral runtime files:** `(Domain, Subject, Thread)` — scoped to the thread/checkpoint they
  belong to, consistent with today's ephemeral StateBackend behavior (synthesis §8).

---

## 16. MCP Ownership & Credential Subjects

**Preserving, not redesigning, the existing owner-vs-user `authMode` distinction (per task
instruction), now expressed in this decision's taxonomy:**

- **MCP definition ownership** — a durable resource, fits the Owner model directly:
  `(Domain, OwnerType, OwnerIdentity)`, where `OwnerType` may be `PersonaUser` (existing),
  `Project` (new — e.g., Beyond Campus owns its Google Calendar MCP definition), or `ExternalUser`
  (new — a user-owned MCP, requirements §18).
- **`authMode: 'owner'` credentials** — belong to whoever owns the MCP *definition* itself; no
  separate Subject is needed, the credential is an attribute of the owned definition.
- **`authMode: 'user'` credentials** — modeled as **Subject**, entirely independent of who owns the
  MCP definition: `(Domain, Subject, MCP)`. Beyond Campus (`Project`) owns the Google Calendar MCP
  *definition*; Rahul (`ExternalUser` subject) and Aman (`ExternalUser` subject) each hold their own
  runtime-subject-scoped credential referencing that same Project-owned definition — cleanly
  separating "who owns the MCP definition" (Owner question) from "whose credential is this" (Subject
  question), exactly matching the task's own worked example. No redesign of OAuth flow, PKCE, or
  token storage/refresh mechanics is implied — only the conceptual key shape gains the `Domain`
  dimension already required by AD-02 §16.

---

## 17. Provider Ownership

**DECISION (ownership taxonomy only — resolution, fallback, secret storage, billing, and quotas
are explicitly out of scope, per task instruction):**

- `OwnerType = PersonaUser` — preserved unchanged (existing behavior).
- `OwnerType = Project` — **newly supported**, evidence-based: Project/System Agents need *some*
  provider to run on, and per AD-02 §13 can execute with no external user present at all (a
  Project-level call), meaning their provider cannot be tied to any `ExternalUser`. A Project-level,
  shared Provider is the only ownership shape that covers this case, and the general pattern of
  Project-owned resources (requirements §17) directly supports it.
- `OwnerType = ExternalUser` — **not decided; not adopted.** The requirements document explicitly
  lists "provider credential ownership/billing" under **What Is Not Decided Yet**, and requirements
  §18 (User-Owned Resources) enumerates Agents/Skills/Knowledge/MCPs but does not mention Providers.
  No evidence supports external users bringing their own provider credentials; none is invented.

**DECISION: Provider warrants its own, dedicated future architecture decision.** This aligns with
AD-03 §15/§21, which already flagged Provider as the deepest existing Persona coupling and
explicitly *not* resolved by the Domain model alone. This decision's contribution is narrow and
final for its scope: the ownership taxonomy (`PersonaUser`, `Project` — not `ExternalUser`) is
settled; resolution order, fallback behavior, secret storage strategy, and any billing/quota
implications are left entirely to that future decision.

---

## 18. Project Administrative Authority

**DECISION: the domain model must support one-or-more Project Admins per Project**, each holding
(conceptually) full Project-level administrative authority — **not a giant permission matrix.**

### 18.1 What Project Admin authority conceptually covers (no RBAC granularity designed)

- Managing the Project's AD-01 credentials (create/revoke) — this decision closes the "who creates
  credentials" gap AD-01 left open, conceptually: credential lifecycle actions are performed under
  Project Admin authority.
- Managing Project membership (inviting/removing other admins, §6).
- Creating and managing Project-owned resources (§12).
- Moderating **any** resource within the Project — Project-owned *or* external-user-owned — per
  requirements §13: inspect, disable, suspend, change visibility, and (where policy permits)
  delete.
- **Never**, by virtue of any of the above, becoming the *owner* of a resource it merely
  administers (§1, §12.3, §24-#6).
- Strictly domain-scoped: authority never extends beyond the Project(s) held via membership (§6.5).

### 18.2 Is a lesser "Project Member/Developer" tier required now?

**DECISION: not required by current evidence; deferred, not precluded.** Requirements repeatedly
and specifically use "Project Admin" with real semantic weight (moderation, credential-adjacent
authority) and never describe a lesser, non-admin membership tier. This decision commits only to:
a Project can have one-or-more Project Admins (§6, §7); it does **not** mandate a separate
view-only/limited-create "member" role, leaving that as a plausible, evidence-backed future
addition for the RBAC decision explicitly deferred by this task (**OPEN**, §29).

---

## 19. Platform Authority

**DECISION:** Platform Admin is **not** a distinct principal type or an owner type — it is an
authority level on a Persona User, matching today's `role: 'admin'` **FACT** (synthesis §13),
extended conceptually (not schematically) to mean **platform-wide exceptional authority across all
Domains**, never ownership (per the task's explicit instruction: "Never make Platform Admin the
owner of resources merely because it can administer them").

**Hierarchy, per requirements §14, reaffirmed:** Persona Platform (Platform Admin authority) sits
above Project Admin authority, which sits above ordinary Project/runtime users.

**The one deliberate exception to AD-03's domain-crossing default-deny:** AD-03 §14 established
that resources never cross Domains by default. Platform Admin authority is the single,
consciously-designed exception — Platform Admin must be capable of inspecting/moderating Project
resources for support, abuse-response, and enforcement purposes (requirements §14: "If an entire
Project abuses Persona infrastructure, Persona should eventually have platform-level enforcement
authority"). This must be modeled as a **narrow, explicit, auditable authority check** layered on
top of the default-deny boundary — never as unrestricted cross-domain access, and never as
ownership. Exact mechanics (what actions, what triggers them, what gets logged) are **OPEN**,
consistent with requirements' own "exact moderation system is not designed yet."

---

## 20. Creator / Audit Attribution

**DECISION: Creator is architecturally necessary as a field distinct from Owner** — not merely a
nice-to-have. Two concrete reasons:

1. **It is the only way to express the Project-owned-resource case at all.** `Owner = Project`,
   `Creator = Raiyan` is not expressible if Creator and Owner are the same field (§8.4, rejected).
2. **It is required infrastructure for the accountability the requirements explicitly anticipate**
   (requirements §13's `Actor: project_admin` audit example) — if Project Admins can create
   Project-owned resources and administer others' resources, some durable record of "who actually
   did this" is necessary, independent of current ownership or current membership.

**DECISION: Creator must never be treated as an authorization input** (§24-#5) — it is historical/
audit metadata only. A resource whose Creator no longer holds any authority (left the Project,
deactivated) remains fully governed by its current Owner and current Project Admin authority; the
Creator field simply persists as a historical label (§23 case 9).

No audit-log schema is designed here — only that Creator-as-a-concept is required, distinct from
Owner, and must never substitute for a real authorization check.

---

## 21. Visibility Interaction

Reaffirming, not redesigning, AD-03 §13's domain-scoped visibility model, now stated precisely
against ownership and authority:

- **PUBLIC/UNLISTED/PRIVATE does not change ownership.** Publishing Sabik's agent Project-public
  leaves `Owner = (Beyond Campus, ExternalUser, sabik)` untouched (§23 case 8) — only the
  visibility tier changes.
- **Project Admin authority does not change ownership.** A Project Admin moderating, suspending, or
  changing the visibility of Sabik's agent under their administrative authority never makes them
  its owner (§18.1, §24-#6).
- **Runtime access (a Runtime Actor using a public agent) never implies ownership.** Rahul chatting
  with Sabik's agent has no ownership or administrative relationship to it whatsoever (§7) —
  execute access is governed by visibility, entirely independent of the Owner/Subject distinction
  this decision establishes.

---

## 22. Authorization Inputs

**Not a complete authorization service — only the information a future one must have available**,
per task scope. Given `Domain(resource)`, `Owner(resource)`, `Visibility(resource)`, and an
`ActorPrincipal` (type + identity, plus any Project Admin membership / Platform Admin overlay
carried by that actor), a future authorization decision ("can Actor X perform Action Y on Resource
Z?") should be able to derive facts such as:

- Does `Domain(actor)` match `Domain(resource)`? (If not: denied, unless the actor holds Platform
  Admin authority — §19's sanctioned exception.)
- Does `Actor == Owner(resource)`? (Ownership match.)
- Does `Actor` hold Project Admin authority over `Domain(resource)`? (Membership-derived, §18.)
- Does `Actor` hold Platform Admin authority? (§19.)
- What is `Visibility(resource)`, and does it permit the requested `Action` for a non-owner,
  non-administering `Actor`? (§21.)

These are **derived facts a future authorization service computes from these raw inputs** — not an
algorithm decided here. `Creator` is deliberately **excluded** from this input list (§20, §24-#5).

---

## 23. Lifecycle / Membership Edge Cases

Each of the ten cases, classified as either **naturally supported** by this decision's model or
**requiring later policy** (not designed here):

1. **Project Admin creates Project-owned agent, then leaves Project.** Naturally supported —
   `Owner = Project`, unaffected by membership changes (§12.1).
2. **Project Admin creates a resource owned by an external user.** Technically supported by the
   model (`Creator` and `Owner` are independent, §7) — but *whether this capability should exist
   as a product feature* (e.g., pre-provisioning a starter agent for a specific user) is a product/
   API question, not decided here (**OPEN**, §29).
3. **External User is deleted/deactivated by host.** Requires later policy — per AD-02 §11.4, no
   automated cascade exists; ownership records are not automatically reassigned, the resource
   becomes orphaned/dormant (§13.1).
4. **Project Admin is removed.** Naturally supported — membership ends; Project-owned resources
   they created are unaffected (§12.1); Creator attribution persists as a historical record, never
   deleted (§20).
5. **Project has zero admins temporarily.** Not inherently forbidden by the domain model, but
   operationally risky (no one can manage the Project). Requires later policy: a future membership-
   management layer should prevent removing the *last* admin — recommended, not decided here
   (**OPEN**, §29).
6. **Project is suspended.** Already resolved by AD-03 §16 (reversible kill-switch, no data
   deletion) — ownership records are untouched; not re-decided here.
7. **Project is eventually deleted.** Already flagged **OPEN** by AD-03 §16 (staged mechanics
   deferred). This decision adds only: both Project-owned *and* external-user-owned resources
   within that Project's Domain fall within the eventual blast radius, since both are Domain-
   qualified to it — exact cascade/retention behavior remains AD-03's open question, not re-decided
   here.
8. **External-user-owned Agent is published Project-public.** Naturally supported —
   publishing/visibility changes never affect ownership (§21).
9. **Resource creator no longer exists.** Naturally supported for Project-owned resources
   specifically — `Owner = Project` never depended on the creator's continued existence (§20); for
   external-user-owned resources this reduces to case 3.
10. **Ownership transfer is requested.** Requires later policy — the model's shape conceptually
    supports any valid destination `(Domain, OwnerType, OwnerIdentity)` value, but the transfer
    *operation* (authorization, audit trail, effect on runtime state) is not designed (**OPEN**,
    §29). Cross-domain transfer is presumptively disallowed by default, consistent with AD-03 §14's
    no-sharing-by-default stance, absent a dedicated future mechanism.

---

## 24. Security Analysis

Threat-modeled against every item the task brief specified:

1. **Project Admin accidentally becoming resource owner** — Prevented by design: Project-owned-
   resource creation must always set `Owner = Project`, never the creating admin's own identity
   (§12.2). This is a modeling discipline established here; structural enforcement is an
   implementation-phase concern (§30).
2. **External user accessing another external user's private resource** — Prevented by the
   ownership check itself: `Owner = (Domain, ExternalUser, X)` must match the requesting actor's
   own `(Domain, X)` for private-resource access — directly extending AD-02 §15's non-collision
   guarantee into the ownership layer.
3. **Project A referencing Project B's owner identity** — Structurally prevented because `Owner` is
   only ever meaningful paired with its `Domain` (§1's "always carry Domain explicitly" design
   choice) — a check that compared owner identities without first verifying domain match would be
   exactly the "missing domain scope" failure mode AD-03 §19 flagged; this decision's shape makes
   that check natural and hard to omit rather than optional.
4. **Bare `externalUserId` used as owner** — Structurally impossible in this shape: there is no
   such thing as a valid `OwnerIdentity` without its paired `Domain` (§13), directly reusing AD-02's
   own invariant.
5. **Creator metadata being treated as authorization** — Explicitly forbidden (§20): only `Owner`
   and current Project/Platform Authority determine access; Creator is audit-only.
6. **Project Admin authority confused with ownership** — The recurring theme, with a concrete
   failure scenario: if an implementation checked "is requester the administrator" by comparing
   against an `Owner` field instead of *current* Project Admin membership, removing someone's
   membership would fail to revoke their access, since ownership was never affected. This decision's
   Owner/Authority separation is specifically designed to prevent this — provided the future
   implementation checks *current* membership/authority, not any ownership-adjacent proxy (§18,
   §30).
7. **Platform Admin authority confused with ownership** — Same class: Platform Admin must never be
   modeled as, or implemented via, temporarily setting it as a resource's owner (§19) — its
   cross-domain access must remain an explicit, narrow, auditable authority check.
8. **Resource losing its Domain during ownership transfer** — Since transfer mechanics are not
   designed (§23 case 10), this decision states the required invariant for whatever future
   mechanism is built: a transfer must never produce a resource with a missing `Domain`, and,
   absent a dedicated cross-domain-sharing mechanism (not designed here), should not change a
   resource's `Domain` at all.
9. **Project-owned resource deleted when creator leaves** — Explicitly prevented by design:
   `Owner = Project`, not `Creator`, so a creator leaving or being removed has zero effect on the
   resource's lifecycle (§12.1) — this resolves the task's own posed question by construction, not
   by policy.
10. **Runtime state exposed because generic ownership checks were reused incorrectly** — Precisely
    why §15 argues against forcing runtime state through the Owner/visibility model: if a Thread's
    access check were mistakenly implemented using Agent-style visibility logic, a Thread could
    become accidentally "discoverable" the way a PUBLIC agent is — but Threads have no visibility
    concept at all (synthesis: confirmed FACT, always private to their subject). The Owner/Subject
    separation is the direct mitigation.
11. **MCP runtime-user credentials exposed to Project Admin unnecessarily** — **DECISION:** a
    Project Admin's administrative authority over an MCP *definition* does not, by default, extend
    to reading or using the *contents* of individual runtime-subject credentials
    (`authMode: 'user'`). The entire purpose of `authMode: 'user'` is per-user credential isolation
    (synthesis §12, AD-02 §16); if Project Admin authority could freely read those credentials, that
    isolation guarantee would be meaningless — any Project Admin could silently act as any of their
    users on a connected third-party service. Project Admins may (under general moderation
    authority) disable/revoke a problematic user's connection — an administrative *action* — but not
    directly access the credential's *contents*. Exact enforcement mechanics are an implementation
    constraint (§30), the *principle* is decided here.
12. **Provider secret exposure** — Not newly introduced by this decision. **FACT** (synthesis):
    decrypted provider keys are never round-tripped back to any principal today — they are used
    internally by `AgentFactory._buildLLM()` and discarded. `OwnerType = Project` for Providers
    (§17) changes who may *configure/rotate* a provider's secret; it does not change this existing,
    already-correct non-exposure property.
13. **User-controlled owner type / owner identity supplied during create** — **The single most
    important rule this decision establishes**, directly mirroring AD-01 §12-#10 and AD-02 §15's
    "never trust caller-supplied projectId/domain" pattern, extended to ownership: **`OwnerType` and
    `OwnerIdentity` must never be accepted as arbitrary client-chosen fields at resource-creation
    time.** Instead: `Domain` always comes from the trusted AD-01/AD-02 context; whether a resource
    is Project-owned or external-user-owned must be **derived from which authenticated context
    created it** — a Project-Admin-authenticated Developer Studio action yields `Owner = Project`; an
    AD-02-asserted external-user runtime context yields `Owner = (Domain, ExternalUser, <the
    asserting externalUserId, never a different one>)`. Never a free-text "ownerType"/"ownerId"
    field a caller fills in.

---

## 25. Rejected Alternatives

### 25.1 A single universal Owner abstraction covering resources and runtime state (§8.2)

Rejected — see §9's comparison matrix and §15.1/§24-#10 for the concrete leak risk it creates by
lending Agent-style visibility/publish semantics to state that has none.

### 25.2 Collapsing PersonaUser into an implicit default rather than a real type (§8.3)

Rejected — would force exactly the kind of Persona-semantic special-casing AD-03 already rejected
for the Domain concept itself (AD-03 §11); `PersonaUser` remains an explicit, first-class
`OwnerType`.

### 25.3 Owner always equals Creator, no independent field (§8.4)

Rejected as insufficient (not "incorrect" in every case) — it remains the *correct instantiation*
for external-user-owned resources (§13.1, creator naturally equals owner there) and for today's
unchanged Persona behavior (§11), but it cannot express the Project-owned-resource requirement at
all (requirements §11, §29 invariant 7) and is explicitly and directly ruled out by requirements'
own language distinguishing ownership from creator/actor attribution.

### 25.4 A separate `DeveloperAccount` principal for Project Admins (§6, Option B)

Rejected — duplicates working Clerk infrastructure for no evidenced benefit and actively harms the
"one identity, both consumer and developer" property the task explicitly values (§6.2).

### 25.5 Developer-personal resource ownership inside a Project

Considered and explicitly not adopted — no requirement demands it (§12.3); inventing it would
violate the task's own instruction not to introduce speculative ownership types.

---

## 26. Consequences for Persistence Architecture

A future persistence decision must represent `(Domain, OwnerType, OwnerIdentity)` for every
ownership-capable resource, and `(Domain, Subject, [Agent])` for every runtime-state type,
independently — this decision does not choose polymorphic-field vs. discriminated-union vs.
separate-collections representation, only that the *conceptual* shapes are distinct and both must
be representable. Extends AD-03 §22's still-open field-vs-constant question for Persona's domain
value; this decision adds that `OwnerType = PersonaUser` should similarly not require immediate
schema disruption to existing `ownerId` fields — the new taxonomy can wrap today's field rather than
replace it.

## 27. Consequences for Runtime Architecture

Threads/Memory/checkpoints/MCP-user-credentials/AgentFactory-cache/rate-limits must key on
`(Domain, Subject, [Agent])`, generalizing AD-02 §17 and AD-03 §23's `(domain, actingIdentity)`
finding with the explicit addition that `Subject` may itself be `Project` (Project-level System
Agent calls, §15.2) — not only `PersonaUser`/`ExternalUser`. The `thread.agentId`-vs-`x-agent-id`
gap (carried forward unmodified from AD-02 §17/§21 and AD-03 §23) must still be closed in whatever
future effort performs this re-keying.

## 28. Consequences for Developer API / Studio

Developer Studio's resource-creation flows must derive `Owner` from the authenticated
context (§24-#13), never accept it as a submitted field. Developer Studio's credential-management
screens operate under Project Admin authority (§18.1), authenticated via the Project Admin's own
Persona/Clerk session (§6.4), distinct from the AD-01 machine credential itself. Any future
"Project Admin executes an agent for testing" capability (§5, flagged plausible-but-deferred) is a
Developer API/Studio design question, not resolved here.

---

## 29. Open Questions

1. Whether a lesser "Project Member/Developer" role (below Project Admin) is ever needed — §18.2,
   deferred, not precluded.
2. Whether Project Admins should ever be able to create resources on behalf of a specific external
   user (§23 case 2) — a product/API question, not a domain-model question.
3. Whether a policy layer should prevent removing a Project's last admin (§23 case 5) —
   recommended, not decided.
4. Exact mechanics of ownership transfer, if ever built (§13.1, §23 case 10, §24-#8).
5. Exact mechanics of Platform Admin's cross-domain enforcement authority — what actions, what
   triggers them, what gets audited (§19) — consistent with requirements' own "not designed yet."
6. Whether/how a "Project has zero admins" state should be actively prevented vs. merely tolerated
   and flagged (§23 case 5).
7. Whether developer-personal ownership inside a Project is ever genuinely needed (§12.3, §25.5) —
   not currently evidenced.
8. Provider's full future architecture (resolution order, fallback, secret storage, billing,
   quotas) — explicitly deferred to its own decision (§17).

---

## 30. Implementation Constraints

Collected from §12, §18, §20, §24 for visibility, non-binding on exact implementation:

- Resource-creation code paths must derive `Owner` from the authenticated request context (which
  authority created it — Project Admin vs. AD-02-asserted external user), never from a
  client-submitted `ownerType`/`ownerId` field (§24-#13) — the single most important rule from this
  decision.
- Authorization checks for "is this actor allowed to administer this resource" must check *current*
  Project Admin membership/Platform Admin status, never Creator, and never a stale ownership proxy
  (§18, §20, §24-#5, #6).
- Runtime-state access checks (Threads, Memory, MCP user credentials) must use the Subject model's
  own logic, never reuse Agent/Skill-style visibility-based access checks (§15.1, §24-#10).
- Project Admin authority over an MCP definition must not be implemented in a way that exposes the
  *contents* of individual `authMode: 'user'` runtime-subject credentials — administrative actions
  (disable/revoke) yes, credential-content access no (§24-#11).
- `Domain` should be carried explicitly alongside `OwnerType`/`OwnerIdentity` in every
  representation, even where technically derivable, so ownership checks have one uniform shape to
  audit (§1, §24-#3).

---

## 31. Evidence / References

| Claim | Source |
|---|---|
| AD-01: `AuthenticatedProjectContext`, "never trust caller-supplied projectId" | `architecture/01-project-authentication.md` §10, §14 |
| AD-02: `(projectId, externalUserId)`, delegated trust, optional externalUserId, Subject-shaped runtime re-keying requirement | `architecture/02-external-user-identity.md` §4, §13, §15, §17 |
| AD-03: Domain abstraction, Persona ≠ Project, `(domain, ownerPrincipal)` constraint, resources never cross domains by default | `architecture/03-project-domain-model.md` §1, §10, §14, §21 |
| Today's uniform `ownerId: ObjectId → User` pattern across all resource types; no creator/owner distinction today | Synthesis §9 |
| Threads have no visibility concept; always private to subject | Synthesis §6, §14 (Discovery & Visibility Findings) |
| Checkpoints keyed by `thread_id` only, no independent subject field | Synthesis §6 (Runtime/AG-UI Findings) |
| Decrypted provider keys never round-tripped to any principal (`_buildLLM()`) | Synthesis §11 |
| Provider is the deepest existing Persona coupling | Synthesis §11; reaffirmed AD-03 §15, §21 |
| Existing `role: 'admin'` is a flat field on the Persona User model, not a separate principal | Synthesis §13 |
| Requirements: two ownership categories (System/Project Agents, User-Owned Agents); Project Admin authority ≠ ownership; Platform Authority above Project Admin; auditable-action example | Requirements §11–14, §29 invariant 7 |
| Requirements: Provider credential ownership/billing explicitly listed under "What Is Not Decided Yet"; Providers absent from the User-Owned Resources enumeration | Requirements §18, "What Is Not Decided Yet" |

---

*This document decides resource ownership, the principal taxonomy, and Project administrative
authority only. It establishes `(Domain, OwnerType, OwnerIdentity)` for durable resources and a
separate `(Domain, Subject, [Agent])` for runtime state, keeps Creator distinct from Owner, and
keeps Project Admin authority distinct from ownership throughout. It explicitly defers persistence
representation, RBAC granularity, the Developer API surface, Developer Studio UX, SDK design, and
Provider's full resolution architecture to later, separately-scoped decisions (§26–28 record the
constraints each inherits).*
