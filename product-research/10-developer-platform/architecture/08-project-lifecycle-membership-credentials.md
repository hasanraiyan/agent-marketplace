# Architecture Decision 08 — Project Lifecycle, Membership & Credentials

> **Status:** DECIDED (this document). Scope: Project control-plane lifecycle — creation, human
> ownership/membership, credential lifecycle (including a required refinement of AD-07), status,
> suspension, deletion, and Platform Admin lifecycle authority. Starts strictly after AD-01–AD-07 —
> none is reopened.
> **Explicitly NOT decided here:** exact MongoDB schemas, endpoint URLs, OpenAPI spec, RBAC tables
> beyond the minimum membership model, invitation-email implementation, Developer Studio UI/IA, SDK
> design, billing, pricing, quotas, deployment topology, webhooks, exact retention durations, cross-
> Project sharing, browser-safe Project authentication.
> **Inputs:** requirements, synthesis, `architecture/01–07-*.md`, and **fresh source reads
> performed for this decision** (§4).
> **Labels used throughout:** DECISION / FACT / EVIDENCE / ASSUMPTION / OPEN.

---

## 1. Decision

**DECISION:** A Project has **no special human Owner** — it is its own entity (a Domain, AD-03),
and humans hold **Admin membership**, a revocable authority grant, not a permanent role tied to
having created it (AD-04's Creator≠Owner principle, applied one level up). **v1 supports exactly one
membership role: Admin** — no lesser "Member/Viewer" tier is introduced without evidence. A Project
must always have **≥1 active human Admin while ACTIVE**; both direct membership-removal and Persona
account deletion are **blocked** if they would leave a Project with zero Admins.

**Project credential CREATION is elevated to require `ProjectAdminContext` (human) — refining, not
contradicting, AD-07 §11/§15**, which had classified Project-credential create/rotate as generally
machine-or-admin "routine." Deeper lifecycle analysis surfaces a real risk AD-07 did not resolve: a
leaked machine credential that could mint a sibling credential would let an attacker persist past
the original credential's revocation. **DECISION:** credential *creation* requires a human; a
credential may only **revoke itself** (a strictly capability-reducing operation, safe for
self-service) via its own `ProjectMachineContext`.

**No first-class Environment concept exists.** Under the already-locked "one Project = one Domain"
rule (AD-03), real environment isolation can only be achieved by creating **separate Projects** —
anything less would either fake isolation with a cosmetic label or require reopening AD-03. Labels
on credentials (e.g. "production," "staging") are permitted for organizational clarity only, with
**no** query-scoping or authorization meaning.

**Project deletion is soft: DELETING (immediate credential/runtime halt, grace period, cancellable)
→ DELETED (async, Domain-scoped cleanup across every storage type).** External-user-owned resources
do **not** survive the Domain's deletion anywhere — there is no other Domain for them to exist in.

---

## 2. Context

AD-01–AD-07 assumed a Project *exists* and is *administrable*, without defining how it comes to
exist, who may act as its human administrators, how its AD-01 credentials are actually managed
across their lifecycle, or what happens when the Project itself is suspended or ends. This decision
supplies exactly that — the control-plane lifecycle Developer Studio will eventually surface, not
invent.

---

## 3. Inherited Architecture (Restated, Unweakened)

From AD-03: every Project is a Domain; Persona is a fixed Domain, never a Project; nothing crosses
Domains by default. From AD-04: ownership ≠ creator ≠ authority; Project Admin authority is distinct
from ownership. From AD-05: Domain-scoped enumeration is what makes deletion/export/audit tractable.
From AD-06: Provider secrets are a distinct class from Project credentials. From AD-07: three context
types (`ProjectMachineContext`, `ProjectRuntimeContext`, `ProjectAdminContext`); machine authority is
bounded — cannot delete/suspend the Project, manage human membership, or perform bulk operations;
Platform Admin authority is narrow, explicit, and audited (AD-04 §19, AD-05 §24).

---

## 4. Current Account/Admin/Credential Findings (Fresh Research, This Decision)

**FACT, confirmed by direct repo-wide search:** no organization, workspace, team, tenant,
membership, invitation, or API-key/credential-issuance concept exists anywhere in the codebase.
Every match for these terms was either a Provider/MCP "apiKey" field (an unrelated secret class,
AD-06) or config/schema noise. **This entire decision is greenfield** — nothing here is a redesign
of an existing primitive.

**FACT — `User` model** (`user.model.js`, read in full this session): flat `role: 'normal' |
'admin'`, `isActive: Boolean`, unique `clerkId`/`email`, sparse-unique `username`. No organization
or membership field of any kind.

**FACT — `adminMiddleware`** (read this session): a single check, `req.user.role !== 'admin'` →
403. Platform-wide, binary, no scoping — the exact "flat, two-level authority" finding AD-04 §19
already relied on, now directly re-confirmed.

**FACT — `userService.deleteUser()`** (read in full this session): an unconditional cascade —
deletes all threads/checkpoints, then all agents/skills/providers/mcps/mcp-connections owned by the
user, then the user document itself, with **no check for any downstream consequence**. **This is
precisely the anti-pattern this decision must not repeat for Projects** (already flagged in
synthesis §13, reaffirmed in AD-02 §11.4, AD-04 §23, AD-05 §23 as a pattern to avoid — this decision
is where the analogous risk for *Project* lifecycle is actually resolved, not merely flagged again).

**FACT — existing soft-delete/status precedent:** `Agent` uses `isActive: Boolean` +
`deletedAt: Date` (read this session) — a real, working precedent for "soft, timestamped lifecycle
state," though a Project's richer lifecycle (§25) needs more than a boolean.

**Conclusion:** the only genuinely reusable primitives are (a) Clerk-based Persona User identity —
already the basis for `ProjectAdminContext` per AD-04 §6/AD-07 §8, (b) the `encryption.js`/
Node-`crypto` conventions AD-01 already built the credential model on, and (c) the isActive/
deletedAt-style soft-lifecycle *shape*, generalized. Everything else — membership, invitation,
credential-lifecycle-within-a-Project, Project status — is new.

---

## 5. Project Concept

Per AD-03 §6: primarily a security/isolation boundary, secondarily an application/tenant and
control-plane container. **DECISION, separating architectural from cosmetic properties:**

**Architectural** (gate authority or isolation, decided somewhere in this series):
Project identity (immutable, = the Domain identity itself, AD-03), Status (§25, gates all AD-01/07
authority), Membership (§9, gates `ProjectAdminContext`), Credentials (AD-01, gates
`ProjectMachineContext`/`ProjectRuntimeContext`), default Provider/model (AD-06, already required).

**Display/UI metadata only** (never gates anything): name, description, logo, and — critically —
**slug** (§14: routing/display convenience, never a security identity).

**DECISION:** no generic, arbitrary "Project settings" blob is introduced (§31) — only concepts
already required by AD-01–AD-07 exist as architectural properties.

---

## 6. Project Creation

**DECISION:** any authenticated Persona User (Clerk — reusing existing, working identity
infrastructure, no new signup path) may create a Project. Creation is **atomic**: it simultaneously
(a) instantiates the Project (a new Domain, AD-03), (b) records that Persona User as **Creator**
(audit-only, per AD-04 §20's pattern applied one level up), and (c) grants that **same** Persona
User an initial **Admin membership** — a live, ordinary, later-revocable grant, **not** a special
permanent role. Creator and initial-Admin happen to be the same person at *t=0*; they are, from that
moment on, two independent facts (§7–8).

**Does creating a Project automatically create a credential?** **DECISION: no** — credential
creation is explicit (§17) and, per this decision's central finding, requires deliberate human
action anyway. A Project may validly exist, ACTIVE, with zero credentials (AD-03 §16 already
established a Project may exist without resources; this extends the same reasoning to credentials).

---

## 7. Human Ownership Models

**Option A — special Owner + Admins**, a permanent or transfer-only designation (à la a single
GitHub repo owner).

**Option B — no human Owner; Project is its own entity, humans hold Admin membership only.**

**Option C — transferable ownership** (a variant of A, adding an explicit transfer mechanic).

---

## 8. Selected Human Ownership Model

**DECISION: Option B.** Evaluated against the task's criteria:

- **Consistency with AD-04** (explicit criterion) — Option A would mean "the creator is special
  forever," precisely the pattern AD-04 rejected for every ordinary resource (Career Launchpad,
  Providers, etc.). Option B extends the *same* discipline one level up: no resource type in this
  architecture, including the Project itself, gives its creator permanent, un-revocable standing.
- **Removing founders/employees later** — an ordinary membership operation (remove one Admin row)
  under B; a special "ownership transfer" ceremony under A, which doesn't actually avoid the "what
  happens when the human is gone" problem, only relocates it to a more special-cased path.
- **Account deletion** — reduces to "one membership row becomes invalid" under B, the same mechanism
  regardless of whether that person was the first or fifth Admin; A requires bespoke handling for
  "the Owner's account is being deleted."
- **Avoiding accidental coupling between one Persona account and Project resources** (explicit
  criterion) — B achieves this structurally: no Persona account is ever special to a Project's
  survival, by construction.
- **Enterprise/team future** — B scales to more Admins with zero architectural change; A would need
  to retrofit "what if the Owner isn't around" logic B never needed in the first place.
- **Option C (transfer) becomes unnecessary** — there is nothing single or special to transfer; the
  task's own hint ("prefer not to invent a transfer concept unless necessary") is directly honored.

---

## 9. Membership Model

**DECISION: v1 supports exactly one role — Admin.** No lesser "Member/Developer/Viewer" tier is
introduced. Justification: (a) AD-04 already deferred the full RBAC matrix; (b) the requirements
document uses "Project Admin" throughout and never describes a lesser Project role; (c) the task's
own quality bar explicitly warns against inventing roles "just because other developer platforms
have them." Every human member of a Project **is** a Project Admin — full authority as AD-07 §12
already scoped (everything machine authority allows, plus the AD-07 §11 carve-outs), refined further
by §17's credential-creation finding. A finer role model remains **OPEN** (§40), not precluded.

This directly answers the task's enumerated questions: **Developer Studio entry** — any Project
Admin. **Manage Project resources** — any Project Admin. **Create/revoke credentials** — nuanced,
§17–20. **Manage membership** — any Project Admin, subject to §12's invariant. **Delete/suspend
Project** — any Project Admin (§26–27), never `ProjectMachineContext` (AD-07, reaffirmed).

A flat, no-hierarchy peer model means any Admin could in principle remove every other Admin,
leaving themselves sole administrator. **DECISION:** this residual risk is not eliminated (no
evidence justifies inventing a hierarchy to prevent it) but is mitigated by mandatory audit logging
of every membership change (§35) and Platform Admin's narrow recovery authority (§33) — named
explicitly in the security analysis (§38-#3), not silently accepted.

---

## 10. Membership Identity

**DECISION:** membership attaches to the **internal Persona User identity** (Mongo `_id`), not the
Clerk ID directly — consistent with every existing ownership reference in the codebase, where
`clerkId` is purely the external bridge resolved once at the auth-middleware layer (**FACT**, §4).
No new identity pattern is invented.

---

## 11. Invitation Model

**DECISION:** the **membership architecture** (multiple Admins per Project, §9) is decided now; a
full **invitation workflow** (pending state for someone without a Persona account yet, email
delivery, accept flow) is **deferred** — no current requirement demands a specific invite UX, and
this is Developer-API/Studio-surface work, not architecture. **Minimum v1 mechanism:** an existing
Admin may directly add an **existing** Persona User (looked up by some existing-user identifier,
exact mechanism deferred) as a new Admin — no separate pending-invitation state machine is required
for this minimum case. A richer flow (inviting someone with no account yet) is **OPEN** (§40),
explicitly not blocking the core membership model.

---

## 12. Last-Admin Invariant

**DECISION, unambiguous, per the task's explicit demand:** a Project **must always have ≥1 active
human Admin while ACTIVE.** Membership-removal (self-removal or removal-by-another-Admin) is
**blocked** — a hard, enforced rule, not a UI nicety — if it would bring the Admin count to zero.
This closes, firmly, what AD-04 §29 had left as merely a *recommendation*.

**Implementation constraint (not designed here):** the "would this leave zero Admins" check must be
atomic/race-safe against concurrent removal requests — a check-then-act window would defeat the
invariant (§38-#19, §42).

---

## 13. Persona Account Deletion

**DECISION, extending the last-Admin invariant to cover the indirect path:** Persona account
deletion is **blocked** if the deleting user is the sole remaining Admin of any **ACTIVE** Project —
mirroring §12's rule rather than allowing account deletion to silently orphan a Project the way
today's blanket `userService.deleteUser()` cascade (**FACT**, §4) currently would if left
unmodified. The user must first add another Admin, or have the Project suspended/deleted, before
their own account can be removed.

If **other** Admins exist, account deletion is a non-event for the Project — one membership row
becomes stale, nothing else changes. **Project-owned resources are never affected by any Admin's
account status** — `Owner = Project` persists regardless of who created it or who currently
administers the Project (AD-04, reaffirmed, unchanged) — this is precisely *why* Project resources
are not owned by their creator.

**OPEN, named honestly:** this creates a tension between an individual's account-deletion rights and
Project continuity (e.g. a future "right to be forgotten" pressure could argue for allowing deletion
with orphaning instead). The v1 default is "block" — the architecturally cleaner, safer starting
posture — with the alternative (allow deletion, leave a recoverable orphaned state requiring Platform
Admin intervention) flagged as a fallback to reconsider only if a real product/legal requirement
demands it.

---

## 14. Project Metadata / Identity

**DECISION, directly per the task's explicit warning:** the Project's **security identity** is its
immutable, internal Domain identity (established at creation, never changes) — never the mutable
display **name**, and never the **slug**. Slug (if used at all, for Developer Studio URL
readability) is **routing/display convenience only**, never an authorization identity, never
required if no need is evidenced. Identity-critical: the immutable Domain ID. Display-only: name,
slug, description, logo, `createdAt`, `createdBy` (audit-only, per §6, never authorization-relevant).

---

## 15. Project Credential Models

Reaffirms AD-01's already-decided shape (key-ID + hashed secret, shown once) and adds lifecycle
attributes needed within a Project: a stable `credentialId` (already relied on by AD-07's context
model), a human-readable **label** (display-only, e.g. "production," never a security or isolation
signal, §24), `createdBy` (which Admin — audit, per AD-04 §20's pattern), `createdAt`/`lastUsedAt`
(security-hygiene metadata), `revokedAt` (a one-way transition, §20), and a minimal **status**:
`ACTIVE | REVOKED` — no separate per-credential "suspended" state is introduced, since Project-level
suspension (§26) already gates every credential at once and no evidence demands a finer-grained
state.

---

## 16. Multiple-Credential Decision

**Already locked by AD-01** ("a Project may hold multiple simultaneously-valid keys," AD-01 §1,
§9.5) — **not re-decided here**, only reaffirmed and extended: multiple credentials directly serve
usage attribution (`credentialId` already appears in AD-07's rate-limit/audit dimensions), safer
independent rotation, and organizational labeling (§24). This decision adds nothing new to the
*existence* of multiple credentials, only to *who may create them* (§17).

---

## 17. Credential Creation Authority — the Critical Refinement

**The most important finding of this decision.** AD-07 §11/§15 classified Project-credential
create/rotate generally as machine-or-admin "routine" — a reasonable first pass, but one this
decision must re-examine specifically for the *lifecycle* implication, per task instruction, without
reopening AD-07's general machine-authority boundary.

**The risk, stated precisely:** under AD-01 §9.5, "rotation" *is* "create a new credential, then
later revoke the old one" — there is no separate "mutate secret in place" operation. If a machine
credential (`ProjectMachineContext`) could create new credentials as part of routine rotation, then
a **leaked** machine credential could mint an **independent** sibling credential purely for
persistence, undetected at the moment of creation, surviving the original credential's eventual
revocation entirely. This is the textbook cloud-security "compromised credential mints a backdoor
credential" pattern (the same reasoning behind why mature cloud IAM systems restrict
credential/access-key-creation permissions specifically, not just broad "manage resources"
permissions).

**DECISION — Option B, refined:** **Project credential CREATION requires `ProjectAdminContext`
(human) only.** `ProjectMachineContext` may **never** create another credential, including for its
own rotation. The asymmetry that makes this safe and sufficient: **capability-reducing operations
are safe for machine self-service; capability-expanding operations are not.**

- **Machine credentials MAY revoke *themselves*** — a strictly reducing operation. The worst case of
  an attacker also self-revoking a stolen credential is that legitimate service goes down, not that
  the attacker gains anything — no persistence value to an attacker.
- **Machine credentials MAY NOT revoke a *different* credential** — reducing in outcome, but a
  compromised credential revoking *every other* legitimate credential is a real sabotage/denial-of-
  service vector (locking the legitimate Project out of its own infrastructure while the attacker's
  stolen one remains valid) — this requires `ProjectAdminContext` too.
- **Rotation, in practice**, becomes: a human Admin creates the replacement credential →
  deploys/reconfigures the backend → either the human or the *old* credential itself (self-revoke)
  retires the original. The downtime-avoiding overlap-window property AD-01 §9.5 established is
  fully preserved — only the *creation* trigger now requires a human, a minor operational friction,
  not a safety regression (§38-#16).

**DECISION, per the task's explicit instruction:** this is recorded as an explicit **clarification of
AD-07 §11/§15**, not a silent contradiction — AD-07's general framing ("routine... machine or admin")
is refined specifically for credential *creation* (and the create-half of rotation), consistent with
the same underlying principle AD-07 §11 already used to justify its other carve-outs (preventing a
leaked machine secret from producing persistent, escalated control).

---

## 18. Credential Secret Handling

Reaffirms AD-01 §9.2–9.3 unchanged: shown exactly once at creation, stored only as a one-way hash,
never retrievable again through any API, for any principal — including via the Platform Admin
exceptional path (§33). **Project credentials (AD-01) and Provider credentials (AD-06) remain two
distinct secret classes** — restated explicitly here, per the task's reminder, because both are
colloquially "the Project's credential" and the confusion risk is real (already named once in AD-06
§27-#12; worth restating at the lifecycle level where the two are most likely to be discussed side
by side in Developer Studio later).

---

## 19. Credential Rotation

**Already decided by AD-01 §9.5 (create-new → overlap → revoke-old, never in-place mutation)** —
reaffirmed, not re-derived, with §17's authority refinement layered on top: the create-half requires
`ProjectAdminContext`; the revoke-old half may be performed by the human Admin or, for self-revoke
only, the retiring credential's own `ProjectMachineContext`.

---

## 20. Credential Revocation

**DECISION:** revocation is **immediate** for new authentications — the next request using a revoked
credential fails. In-flight requests that already passed authentication before the revocation moment
may complete (revocation prevents future use, not an already-authorized, already-executing request)
— a standard, reasonable posture. **Revocation is one-way and terminal** — a revoked credential
cannot be "un-revoked" (consistent with AD-01's "shown once" philosophy: no ambiguity about whether a
restored credential was compromised in the interim); the remedy is creating a new one (§17).
**Deletion differs from revocation:** credential *records* are never hard-deleted, only status-
transitioned to `REVOKED` — the record itself (label, timestamps, who created/revoked it) remains as
audit history (§35); permanently purging the record entirely is a separate, low-priority, not-v1
concern.

---

## 21. Credential Expiration

**DECISION: optional, not mandatory, deferred for v1.** No current requirement mandates automatic
expiry, and forcing one would create real operational pain (a mandatory rotation cadence) with no
evidenced compliance driver. The architecture remains structurally compatible with adding an
optional `expiresAt`-shaped concept later without redesigning the credential model — not built now.

---

## 22. Future Credential Scopes

**Already deferred by AD-01 §9.8, reaffirmed unchanged:** v1 credentials remain unscoped — every
Project machine credential shares the same bounded authority (AD-07 §11, refined by §17). The design
space for future per-credential scopes is reserved (a credential record could gain an optional
scopes field later without a model redesign) but not built now.

---

## 23. Environment Models

**Option A — no environment concept; use separate Projects for hard isolation.**
**Option B — Project contains Environments** (a sub-Domain concept).
**Option C — credentials carry environment labels only, no isolation semantics.**

---

## 24. Environment Decision

**DECISION: Option A**, with an explicit, narrow allowance from Option C layered on top (credential
labels — not "environments").

**The reasoning, derived from the already-locked Domain model, not preference:** would a
"staging" vs. "production" split need *real* isolation (separate `externalUserId` spaces, separate
resource/thread/memory scopes) to avoid, e.g., a staging test user "rahul_test" polluting or
colliding with production data? **Yes, plausibly** — that is a genuine operational risk if
staging/production merely share one Domain. But the *only* mechanism this architecture has for real
isolation is the Domain boundary, and AD-03 already, permanently, locked **one Project = one
Domain**. Therefore: real environment isolation, under this already-decided architecture, can
**only** be achieved by making each environment its **own Project** (its own Domain) — Option B
(Environments *inside* one Domain) would require either reopening AD-03 (not permitted) or making
"Environment" a fake, non-isolating label — which is just Option C, and does not solve the real risk
just identified.

**DECISION:** no first-class Environment concept exists. A developer needing staging/production
separation creates **separate Projects** (e.g. "Beyond Campus" and "Beyond Campus (Staging)"), each
a full, independent Domain. Credentials **may** carry a human-readable **label** (e.g.
"prod-backend") for organizational clarity within one Project's credential list — explicitly
cosmetic, **never** elevated to query-scoping or authorization meaning, and deliberately **not**
called an "Environment," to avoid implying isolation it does not have (directly closing the threat-
model item "environment labels accidentally being treated as security isolation," §38-#21).

---

## 25. Project Status Model

**DECISION: ACTIVE, SUSPENDED, DELETING, DELETED.** No `PENDING` state — creation is atomic (§6), so
nothing meaningfully "waits" between creation and ACTIVE.

| State | Studio (human) access | Credential auth | Runtime execution | Resource read | Resource mutate | Provider consumption |
|---|---|---|---|---|---|---|
| ACTIVE | Full | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUSPENDED | View + limited recovery actions (Clerk session unaffected — suspension gates AD-01 credentials, not first-party Clerk login) | ❌ | ❌ | ✅ (for the Admin's own recovery/audit) | ❌ | ❌ (no execution → none consumed) |
| DELETING | View + cancel-deletion only | ❌ (immediate, not deferred to grace-period end) | ❌ | ✅ (recovery/cancellation purposes) | ❌ | ❌ |
| DELETED | None (terminal; audit tombstone may persist, §29) | ❌ | ❌ | ❌ | ❌ | ❌ |

**Why SUSPENDED doesn't gate human login:** a human Admin's Clerk session is Persona's own
first-party authentication, categorically separate from AD-01 credential authentication (AD-07 §8) —
suspension gates the latter, not the former, so an Admin can still reach limited recovery/status
information even while suspended.

---

## 26. Suspension Semantics

**DECISION:** suspension is a reversible, non-destructive Project-wide kill switch (AD-03 §16,
reaffirmed) — data is never touched. **Project Admin MAY self-suspend** (a voluntary, low-risk,
fully reversible precaution — e.g. containing a suspected leak). **Un-suspension symmetry, precisely
stated:** a Project Admin may restore a Project **only if it was suspended by Project Admin
authority** (voluntary); a Project suspended by **Platform Admin** authority may be restored **only**
by Platform Admin — otherwise Platform-level enforcement (requirements' explicit "platform-level
enforcement authority" language) would be trivially defeated by the Project undoing its own sanction.
**Implementation constraint (not designed here):** the suspension record must retain *which
authority level* performed the suspension, to make this asymmetry enforceable (§42). **Machine
credentials can never suspend or restore a Project** — AD-07's already-locked rule, unmodified.

---

## 27. Project Deletion Models

**A. Immediate hard delete** — simplest, but no recovery path for an accidental or malicious trigger;
unacceptable given the catastrophic, low-frequency, high-regret nature of the action.
**B. Soft-delete + retention window** — a grace period before data is touched; cancellable.
**C. Tombstone + asynchronous cleanup** — the record/fact of the Project's past existence (for audit)
outlives the purge of its operational data.

---

## 28. Project Deletion Decision

**DECISION: B and C combined.** Deletion is **requested** by `ProjectAdminContext` (or
`PlatformAdminContext` in an extreme enforcement case) → the Project **immediately** transitions to
`DELETING`: credentials stop authenticating and runtime execution stops **at once** (not deferred to
the end of the grace period — the "soft" in soft-delete refers to *data retention timing*, not
continued operational availability, directly closing threat-model item §38-#18) → a **grace period**
(duration not decided here — no requirement specifies one, **OPEN**) elapses, during which a Project
Admin may **cancel**, returning the Project to `ACTIVE` → if not cancelled, the Project becomes
`DELETED` and **asynchronous, Domain-scoped cleanup** purges operational data across every storage
type, directly reusing AD-05 §23's already-established enumeration mechanisms (Mongo `find({domain})`
via the shared helper; memory's Domain-rooted namespace prefix-delete; Qdrant's per-Knowledge-Base
collection deletion, enumerated via the now-purged KB records; checkpoints via the existing
Thread-first-then-`cleanupThreads(threadIds)` pattern, **FACT**, §4 of AD-06) — **no new cleanup
mechanism is invented; this decision reuses what AD-05 already made tractable.**

**Audit tombstone (Option C):** the historical fact of the Project's existence, its lifecycle events,
and its membership/credential history (§35) are **retained** beyond the operational-data purge —
compliance/audit trails often need to outlive the data they describe, especially the record of the
deletion itself. **Provider secret material is explicitly purged, not retained** — no legitimate
future need exists to keep an encrypted vendor API key once the Project is gone (§38-#8 addressed
via this explicit inclusion, not a silent gap).

---

## 29. Domain Resource Cleanup Semantics

Directly reuses AD-05 §23's finding that Domain-scoped enumeration makes cleanup tractable using the
**same** mechanism ordinary operation already requires — restated here at the Project-lifecycle
level: no bespoke "Project deletion" query path is needed; the grace period exists precisely to give
this reused, already-tractable mechanism time to run asynchronously across Mongo, Qdrant, memory, and
checkpoints without requiring an impossible atomic, synchronous purge across four different storage
technologies at the instant of deletion.

---

## 30. ExternalUser Resource Lifecycle

**DECISION, directly resolving the task's most emphasized point, unambiguously:** external-user-
owned resources do **not** survive the Project's Domain deletion in any global sense. There is no
"Persona-global" home for them — per AD-03, Persona and Projects are structurally separate Domains,
and per AD-02, `(BeyondCampus, sabik)` has no meaning or existence in any *other* Domain, including
Persona's. **Ownership type (`Project` vs. `ExternalUser`, AD-04) determines who has *authority* over
a resource during the Project's life — it creates no separate *survival* path once the Domain itself
ceases to exist.** When a Project's Domain is deleted, Project-owned and external-user-owned
resources alike, without distinction, fall within the same `DELETING`→`DELETED` lifecycle (§28).
Suspension, being Domain-wide rather than ownership-specific (AD-03 §16), applies identically to both
ownership types too — not a new decision, a reaffirmation of AD-03's existing Domain-level (not
ownership-level) granularity.

---

## 31. Project Settings

**DECISION:** the only settings-like concept genuinely required by prior decisions is the **Project
default Provider/model** (AD-06 §11, already decided). No generic, arbitrary "Project settings" blob
is introduced — consistent with §5's architectural-vs-cosmetic distinction and the task's explicit
instruction to include only what's already required.

---

## 32. Project Policy Boundary

**DECISION: Option A — platform-wide behavior for v1; no per-Project policy toggle.** Requirements
already establish (as product truth, not re-decided here) that external users generally may create
Agents (requirements §12), and AD-06 §12 already established they may select among the Project's own
Providers with no additional allow-list needed (the Domain boundary is sufficient policy). No
evidence in the requirements demands a **per-Project** configurable toggle (e.g. "Beyond Campus
allows user-created Agents, Coursify disables it") — Option B (a minimal per-Project capability flag)
is flagged as a **plausible, low-cost future extension** if a real product need emerges, **not**
built now. Option C (a full policy engine) is explicitly rejected, per task instruction, as
unjustified by current evidence.

---

## 33. Platform Admin Authority

Applying AD-04 §19/AD-05 §24's already-locked constraint (narrow, explicit, separately-authorized,
audited — never generic unscoped access, never ownership) to Project lifecycle specifically:

**DECISION, Platform Admin may:** view Project metadata (support/moderation, a narrow audited read);
suspend a Project (the enforcement action requirements explicitly anticipate, "platform-level
enforcement authority"); restore a Project **it (or another Platform Admin) suspended** (mirroring
§26's symmetry at the platform level); assist orphan recovery in genuinely exceptional cases (e.g.
legal/dispute scenarios) by granting a new Admin membership to a verified human — a narrow, audited
exception, not a routine path (note: §12–13's hard invariants are designed to make this case rare,
not to preclude Platform Admin's ability to handle the residual exceptional case); initiate/complete
Project deletion in extreme abuse cases; revoke Project credentials as an enforcement/support action
(e.g. responding to a reported leak). **Inspecting credentials is always metadata-only** — plaintext
remains impossible for **everyone**, including Platform Admin, without exception (AD-06/AD-07,
reaffirmed).

**DECISION, the hard constraint restated:** none of this is implemented as "Platform Admin bypasses
the normal scoped queries" — every action above must go through the **same** distinctly-named,
separately-authorized, audited exceptional-access path AD-05 §24 already established, applied to
Project-lifecycle operations specifically, not a new bypass mechanism.

---

## 34. API Authority Matrix

| Operation | ProjectMachineContext | ProjectAdminContext | PlatformAdminContext |
|---|---|---|---|
| Create Project | N/A — created by an authenticated Persona User directly, not via a Project's own credential (none exists yet) | — | — |
| Read Project (metadata/status) | ✅ | ✅ | ✅ (narrow, audited) |
| Update Project metadata | ✅ | ✅ | — |
| Create credential | ❌ | ✅ | — |
| List credentials (metadata only) | ✅ | ✅ | ✅ (metadata only) |
| Revoke credential (self) | ✅ | ✅ | — |
| Revoke credential (other) | ❌ | ✅ | ✅ (enforcement) |
| Add Admin | ❌ | ✅ | ✅ (orphan recovery only) |
| Remove Admin | ❌ | ✅ (subject to §12) | — |
| Leave Project | N/A | ✅ (subject to §12) | — |
| Suspend Project | ❌ | ✅ (self-suspend) | ✅ (enforcement) |
| Restore Project | ❌ | ✅ (only if self-suspended) | ✅ (only if Platform-suspended, or override) |
| Delete Project (request) | ❌ | ✅ | ✅ (extreme enforcement) |
| Cancel deletion | ❌ | ✅ | ✅ |

---

## 35. Audit Requirements

**DECISION:** every lifecycle event — Project created; metadata changed; Admin added/removed;
credential created/revoked/rotated; Project suspended/restored; deletion requested/cancelled/
completed; relevant Provider credential changes; Platform Admin intervention — must record **what**
happened, **when**, and the **actor**, with its **context type** (`ProjectAdminContext` + which
Persona User; `ProjectMachineContext` + which `credentialId`; `PlatformAdminContext` + which platform
admin), directly reusing AD-07 §35's already-established audit-context model rather than inventing a
new one. **Never log credential plaintext**, reaffirming AD-01/AD-06/AD-07 unchanged. No audit schema
is designed here.

---

## 36. Developer Studio Constraints

Not designing UI, per task scope — but the concepts this decision establishes (Project, Members,
API Keys/Credentials, default Provider, and the resource groups from AD-07) are what a later Studio
IA will organize around; imagined UI does not drive this architecture, and none of these concepts
were invented merely to populate a UI section.

## 37. Developer API Constraints

Not defining routes — but §34's matrix is what a later Developer API decision must enforce
per-operation, with `ProjectAdminContext` verified via an actual Project-membership lookup (§10),
never inferred from a bare Clerk session alone.

---

## 38. Security Analysis

Threat-modeled against every item the task specified:

1. **Leaked credential creating a replacement for persistence** — the central finding this decision
   resolves: credential creation requires `ProjectAdminContext`, never machine (§17).
2. **Leaked credential adding attacker as human Admin** — prevented; "Add Admin" requires
   `ProjectAdminContext` (§34, reaffirming AD-07 §11).
3. **Compromised Admin removing all other Admins** — a named, accepted residual risk of the flat
   peer-membership model (§9), mitigated by mandatory audit logging (§35) and Platform Admin
   recovery authority (§33) — not hidden.
4. **Last Admin leaving** — prevented by the hard invariant (§12).
5. **Creator account deletion deleting Project resources** — prevented twice over: `Owner=Project`
   never depends on Creator's account status (AD-04), and account deletion is itself blocked if it
   would orphan a Project (§13).
6. **Project slug used as authorization identity** — explicitly forbidden (§14).
7. **Revoked credential continuing to authenticate** — prevented, immediate revocation (§20).
8. **Credential secret retrievable after creation** — prevented (§18, AD-01).
9. **Credential stored plaintext** — prevented (AD-01, reaffirmed).
10. **Project A credential operating on Project B** — prevented; a credential always resolves to its
    own Project only (AD-01, unmodified).
11. **Suspended Project continuing Agent execution** — prevented (§25, credential auth blocked).
12. **Suspended Project continuing Provider spend** — prevented (no execution, trivially, §25).
13. **Deleted Project resources remaining discoverable** — prevented; credential/runtime access stops
    the instant deletion is requested, not deferred to grace-period end (§25, §28).
14. **External-user-owned resources surviving outside deleted Domain** — explicitly, directly
    resolved: they do not survive elsewhere; there is nowhere else for them to exist (§30).
15. **Platform Admin bypass becoming generic unscoped access** — prevented; reaffirms AD-05 §24
    unmodified, applied to lifecycle operations specifically (§33).
16. **Credential rotation causing outage** — mitigated; the create-new/overlap/revoke-old shape
    (AD-01 §9.5) is unaffected by §17's authority refinement — the overlap window still exists,
    only the creation *trigger* now requires a human, a minor friction, not a safety regression.
17. **Hard deletion leaving Qdrant/files/MCP credentials behind** — mitigated by choosing soft-delete
    + grace period specifically to give AD-05's already-tractable, asynchronous cleanup mechanisms
    time to complete, rather than requiring an impossible synchronous atomic purge (§28–29).
18. **Soft-deleted Project credentials remaining usable** — explicitly prevented: `DELETING` stops
    credential authentication immediately, not deferred (§25, §28).
19. **Membership race resulting in zero Admins** — mitigated by the invariant (§12) plus the
    explicit implementation constraint that the check must be atomic/race-safe (§42).
20. **Machine credential escalating itself to human authority** — structurally impossible;
    `ProjectMachineContext` and `ProjectAdminContext` are permanently separate context types with no
    upgrade path between them (AD-07 §8, reaffirmed).
21. **Environment labels accidentally being treated as security isolation** — explicitly, by design,
    prevented: labels are documented as cosmetic-only and the architecture grants them no
    query-scoping or authorization role whatsoever (§24).

**Fail-closed posture, restated:** every ambiguous or ill-formed lifecycle request (last-Admin
removal, credential creation by a machine, un-suspend by the wrong authority level) resolves to an
explicit rejection — consistent with every prior decision in this series.

---

## 39. Migration / Compatibility Impact

Entirely new-build — no existing schema or data is migrated (**FACT**, §4: no existing
organization/membership/credential concept exists to migrate *from*). The one existing thing this
decision constrains is `userService.deleteUser()`'s cascade (§4, §13): a future implementation must
add the last-Admin-orphan check to that flow — a real, additive change to existing code, but a
narrow, well-scoped one (a single new precondition check), not a restructuring.

---

## 40. Rejected Alternatives

**Option A ownership (special human Owner, §7–8)** — rejected: inconsistent with AD-04, couples a
Persona account to permanent Project authority, and doesn't actually avoid the "human is gone"
problem, only relocates it.

**Environment as a sub-Domain concept (§23–24, Option B)** — rejected: would require reopening the
already-locked one-Project-one-Domain rule, or would be isolation in name only.

**Machine credentials creating new credentials as part of routine authority (§17, the original AD-07
framing)** — refined, not silently kept: the specific persistence-attack risk is real and
sufficiently serious to require human authority for credential creation specifically.

**Full RBAC/role system (§9)** and **full per-Project policy engine (§32, Option C)** — both
rejected as unevidenced, per the task's explicit instruction not to build generic infrastructure
ahead of a demonstrated need.

**Immediate hard deletion (§27, Option A)** — rejected: no recovery path for a catastrophic,
low-frequency, high-regret mistake.

---

## 41. Open Questions

1. Exact grace-period duration for Project deletion (§28) — no requirement specifies one.
2. Whether a lesser, non-Admin membership role is ever needed (§9) — deferred, not precluded.
3. Whether a richer invitation workflow (inviting a non-Persona-account human) is ever built (§11).
4. Whether the Persona-account-deletion block (§13) should ever be relaxed in favor of an
   orphan-recovery path, if legal/product pressure demands it.
5. Exact audit-tombstone retention duration (§28) — no requirement specifies one.
6. Whether a minimal per-Project capability policy (§32, Option B) is ever needed.

---

## 42. Implementation Constraints

Collected from §12, §17, §26, §28, §35 for visibility, non-binding on exact implementation:

- The last-Admin check (both direct membership removal and, transitively, Persona account deletion)
  must be atomic/race-safe against concurrent requests.
- Project-credential *creation* must be gated to `ProjectAdminContext` only; self-revocation may use
  `ProjectMachineContext`; revoking a *different* credential requires `ProjectAdminContext` or
  `PlatformAdminContext`.
- The suspension record must retain which authority level (Project Admin vs. Platform Admin)
  performed the suspension, to enforce the restore-symmetry rule.
- `DELETING` must halt credential authentication and runtime execution immediately upon request,
  independent of when the grace period elapses or asynchronous cleanup completes.
- Project deletion's cleanup must reuse AD-05 §23's existing Domain-scoped enumeration mechanisms
  (Mongo `find({domain})`, memory namespace prefix-delete, Qdrant per-KB collection deletion,
  Thread-first-then-`cleanupThreads`) rather than a new, bespoke mechanism.
- Audit records for lifecycle events must persist beyond operational-data purge (the tombstone),
  while Provider secret material must be included in the purge, not retained.

---

## 43. Evidence / References

| Claim | Source |
|---|---|
| No organization/workspace/team/membership/credential-issuance concept exists anywhere | Direct repo-wide search this session |
| `User` model shape: flat `role`, `isActive`, unique `clerkId`/`email` | `agent-backend/src/modules/users/user.model.js` — read in full this session |
| `adminMiddleware`: flat, binary, platform-wide role check | `agent-backend/src/modules/users/admin.middleware.js` — read this session |
| `userService.deleteUser()`: unconditional cascade across all owned resources | `agent-backend/src/modules/users/user.service.js` — read in full this session |
| `Agent` model's `isActive`/`deletedAt` soft-delete precedent | `agent-backend/src/modules/agents/agent.model.js` — read this session |
| AD-01: credential structure, shown-once, rotation shape, multi-credential support | `architecture/01-project-authentication.md` §1, §9 |
| AD-03: Domain=Project 1:1, Persona is a fixed Domain not a Project, suspension semantics | `architecture/03-project-domain-model.md` §1, §16 |
| AD-04: Creator≠Owner, Project Admin authority ≠ ownership, Platform Authority scope | `architecture/04-ownership-and-authority.md` §12, §18–19 |
| AD-05: Domain-scoped enumeration makes deletion/export/audit tractable; Platform Admin exceptional-path constraint | `architecture/05-persistence-and-tenant-isolation.md` §23–24 |
| AD-06: Provider vs. Project credential are distinct secret classes | `architecture/06-provider-architecture.md` §27-#12 |
| AD-07: three context types, bounded machine authority, audit-context model | `architecture/07-developer-api-runtime-contract.md` §8, §11, §35 |
| Requirements: Platform-level enforcement authority above Project Admin | `developer-platform-requirements.md`, Platform Authority section |

---

*This document decides Project lifecycle, membership, and credential-management architecture only.
It resolves human ownership (no special Owner), the minimum v1 role set (Admin only), the last-Admin
invariant, a required refinement to AD-07's credential-creation authority, the rejection of a
first-class Environment concept, and Project status/suspension/deletion semantics — including the
explicit, unambiguous fate of external-user-owned resources upon Domain deletion. It explicitly
defers exact schemas, endpoints, invitation UX, Developer Studio IA, and SDK design to later,
separately-scoped decisions (§36–37, §41 record the constraints each inherits).*
