# Developer Platform — Master Implementation Blueprint

> **Status:** Implementation planning only. No application code, schemas, migrations, routes, or
> UI were created or modified while producing this document. AD-01 through AD-08 are treated as
> **approved** and are not reopened anywhere below — where implementation research surfaces a real
> tension, it is flagged as **ARCHITECTURE BLOCKER** or **OPEN**, never silently redesigned.
> **Inputs:** requirements, synthesis, `architecture/01–08-*.md`, and fresh, implementation-oriented
> source reads performed for this document (§3).
> **Labels used throughout:** FACT / EVIDENCE / DECISION FROM AD-XX / IMPLEMENTATION RECOMMENDATION
> / RISK / OPEN / BLOCKER.

---

## 1. Purpose

AD-01–AD-08 decided *what* the Developer Platform is, conceptually, and *why*. This document
reconciles that approved architecture with the **actual, current codebase** and produces a
dependency-ordered, risk-ranked sequence of implementation phases — sufficiently concrete that a
team (or a set of coding agents) could begin Phase 0 with confidence, without re-deriving the
architecture or guessing at sequencing. It does not write code, schemas, or endpoints.

**Running example used throughout** (per task instruction): Project **Beyond Campus**, human Project
Admin **Raiyan**, Project-owned Agent **Career Launchpad**, external users **Sabik**, **Rahul**,
**Aman**. Sabik's **My Placement Agent** is `Owner = (BeyondCampus, ExternalUser, sabik)`. Rahul's
threads/memory/files/MCP credentials must remain fully isolated from Sabik's and Aman's, even though
all three may use the same Career Launchpad agent definition.

---

## 2. Approved Architecture Baseline

| AD | Locked decision this blueprint must honor |
|---|---|
| 01 | Project credentials: key-ID + hashed secret, shown once, multiple simultaneously-valid credentials, Domain never from caller input |
| 02 | `(projectId, externalUserId)` runtime identity; Project is authoritative for its users; no extra signature needed; JIT resolution; externalUserId is identity, profile is metadata |
| 03 | Project = Domain; Persona = a fixed, first-party Domain, **not** a Project; no resource crosses Domains by default |
| 04 | `(Domain, OwnerType, OwnerIdentity)` for durable resources; `(Domain, Subject, [Agent])` for runtime state; Creator ≠ Owner ≠ Authority ≠ Runtime Actor |
| 05 | Domain-qualified lookup mandatory, missing Domain = error; hybrid persistence (Mongo field+helper, memory namespace-root, checkpoint key+gate, Qdrant collection-per-KB) |
| 06 | Provider = combined vendor+credential+config record; `OwnerType ∈ {PersonaUser, Project}`; Platform/Internal Provider category (evidenced: `OPENAI_API_KEY`); no runtime failover; no cross-Domain fallback |
| 07 | Three request contexts (`ProjectMachineContext`, `ProjectRuntimeContext`, `ProjectAdminContext`); bounded machine authority; single externalUserId header; new Developer AG-UI route sharing existing runtime |
| 08 | No special Project Owner; Admin-only v1 role; last-Admin invariant; **credential creation requires `ProjectAdminContext` only** (refines AD-07); no first-class Environment; soft-delete + grace period + tombstone |

---

## 3. Current Codebase Implementation Map

Fresh, implementation-oriented findings (this document), layered on everything already verified in
AD-01–AD-08's own evidence sections.

**Bootstrap** (`src/index.js`, re-confirmed): one Express app; `clerkMiddleware()` global; four
already-coexisting auth postures; AG-UI's raw-body-before-`express.json()` ordering; wide-open
`cors()`; Swagger UI at `/docs` from `docs/swagger.config.js`.

**Background jobs — FACT, new finding this pass:** the only scheduling mechanism is `node-cron`
(`modules/cron/index.js`), a simple in-process interval scheduler with **one** existing job
(`deleteInactiveUsers`). **There is no job queue, no retry/backoff infrastructure, no distributed
worker system** (no BullMQ/Agenda/Temporal/etc. in `package.json`). **This is a real capability gap**
for AD-08's async Project-deletion cleanup (§28).

**Skills (`skill.repository.js`, read in full this pass):** `findOneAndUpdate({_id, ownerId}, ...)`
and `findOneAndDelete({_id, ownerId})` already combine identity + scope in **one query** — this is
structurally *close* to AD-05's target shape already (just needs `domain` added to the same compound
filter); `findById(id)` alone (used for the read-by-id path) is the one that needs to become
Domain-qualified. `findPublicSkills` is the unconditionally-global query synthesis already flagged.

**Upload (`upload.routes.js`, read in full this pass):** single-purpose (avatars only), flat
`uploads/` directory, `Date.now()-random` filename, Clerk-required, served **statically** at
`/uploads/*` with **zero** authorization check on retrieval — confirms AD-05 §20's finding directly,
not merely by citation. No durable-file record exists in Mongo at all for uploads today — the file
system *is* the only record.

**MCP (`mcp.service.js`, method inventory this pass):** `createMcp`, `getMyMcps`, `getMcpById`,
`updateMcp`, `deleteMcp`, `_invalidateAgentsUsingMcp`, `testConnection`,
`getOwnerAuthorizationUrl`/`handleOwnerCallback`, `getUserAuthorizationUrl`/`handleUserCallback`,
`getUserConnectionStatus`, `disconnectUserConnection`, `disconnectOwnerConnection`,
`getAgentsByMcp`, `readResource`, `callTool` — a complete, already-well-factored surface; every
method already takes `userId` as a parameter, meaning the re-keying work is mechanical (thread a
`domain` alongside the existing `userId`/`Subject` parameter) rather than structural.

**Frontend (previously established, `AGENTS.md`, re-confirmed, not re-read this pass):** two route
trees, `/dashboard` (Persona consumer) and `/studio` (Agent Studio, creator), sharing one Next.js
app, `frontend/src/lib/studio-routes.js` as the canonical Studio route table. No Developer-Studio-
shaped surface exists anywhere in the frontend.

---

## 4. Change Impact Matrix

| Module | UNCHANGED | INTERNAL REFACTOR | SCHEMA CHANGE | AUTH CHANGE | NEW PROJECT SURFACE | RUNTIME RE-KEYING | NEW MODULE | FRONTEND | MIGRATION REQ. | HIGH-RISK |
|---|---|---|---|---|---|---|---|---|---|---|
| Users/Auth (Clerk) | | ✔ | | | | | | | | |
| `userService.deleteUser` | | | | ✔ (last-Admin precondition) | | | | | | |
| Agents | | ✔ | ✔ | ✔ | ✔ | ✔ | | | ✔ | ✔ |
| Skills | | ✔ | ✔ | ✔ | ✔ | | | | ✔ | |
| Knowledge | | ✔ | ✔ | ✔ | ✔ | | | | ✔ | |
| MCP definitions + connections | | ✔ | ✔ | ✔ | ✔ | ✔ | | | ✔ | ✔ |
| Providers | | ✔ | ✔ | ✔ | ✔ | ✔ | | | ✔ | ✔ |
| Threads | | ✔ | ✔ | ✔ | ✔ | ✔ | | | ✔ | ✔ |
| Checkpoints | | ✔ | | ✔ | | ✔ | | | | ✔ |
| Memory | | ✔ | | | | ✔ | | | ✔ | ✔ |
| Upload/Files | | ✔ | ✔ | ✔ | ✔ | | | | | |
| AgentFactory | | ✔ | | ✔ | | ✔ | | | | ✔ |
| AG-UI | | ✔ | | ✔ | ✔ | | | | | ✔ |
| Rate limiter | | ✔ | | | | ✔ | | | | |
| Swagger/OpenAPI | | ✔ | | | ✔ | | | | | |
| Project | | | ✔ | | ✔ | | ✔ | | N/A (new) | |
| ProjectMembership | | | ✔ | | ✔ | | ✔ | | N/A (new) | |
| ProjectCredential | | | ✔ | | ✔ | | ✔ | | N/A (new) | ✔ |
| Developer API middleware/context | | | | ✔ | ✔ | | ✔ | | | ✔ |
| Background cleanup/jobs | | | | | ✔ | | ✔ | | | |
| Audit log | | | ✔ | | ✔ | | ✔ | | | |
| Persona Dashboard/Studio (frontend) | ✔ | | | | | | | | | |
| Developer Studio (frontend) | | | | | ✔ | | ✔ | ✔ | N/A (new) | |

---

## 5. Target Internal Context Model

**IMPLEMENTATION RECOMMENDATION:** stop threading raw `userId` (or, later, raw headers) through
services. Establish exactly the context types AD-07/08 already named — **no new vocabulary**:

```
HTTP request
  │
  ├─ Clerk session present? ──► authMiddleware (existing) ──► PersonaPrincipalContext
  │                                                             { domain: PERSONA_DOMAIN (constant),
  │                                                               principalType: 'PersonaUser',
  │                                                               personaUserId }
  │
  └─ Project credential present? ──► NEW Developer auth middleware
        │
        ├─ no externalUserId header ─► ProjectMachineContext
        │                                { domain: project.id, credentialId }
        │
        ├─ + externalUserId header ──► ProjectRuntimeContext
        │                                { domain, credentialId, subject: externalUserId (JIT-resolved) }
        │
        └─ Clerk session + verified
           Project membership   ────► ProjectAdminContext
                                        { domain, personaUserId, membershipRole: 'Admin' }
  │
  ▼
controller  — receives ONLY a context object, never raw req.headers/req.user for identity purposes
  │
  ▼
domain-aware service  — every method signature: (context, ...otherArgs)
  │
  ▼
repository/query  — every method signature: (context.domain, ...) → built via the shared
                     scoped-filter helper (AD-05 §10) — never a hand-written filter literal
  │
  ▼
storage (Mongo / memory namespace / checkpoint key / Qdrant collection)
```

**IMPLEMENTATION RECOMMENDATION:** `PersonaPrincipalContext` is a genuinely new, thin wrapper this
blueprint introduces — today's code passes `req.user` (a Mongoose doc) directly into services. Wrap
it once, at the controller boundary, into the same four-context shape everything else uses, with
`domain` defaulted to a `PERSONA_DOMAIN` constant. This is the single mechanical change that makes
Persona and Developer code paths consumable by the **same** downstream services (§6).

**No service reconstructs Domain from an arbitrary field. No repository infers scope from
`ownerId` alone** — every repository method's first parameter is the trusted `domain` from the
context, never derived from the resource being queried.

---

## 6. Persona Compatibility Strategy

**DECISION FROM AD-03/AD-05:** Persona's Domain may be an implicit, defaulted constant — no forced
live-data migration. **IMPLEMENTATION RECOMMENDATION, concrete sequence:**

1. Introduce the `PERSONA_DOMAIN` constant and the `PersonaPrincipalContext` wrapper (§5) — zero
   behavior change, nothing else touched yet.
2. **Extract** (not duplicate) each service's core logic to accept a `domain` parameter with the
   existing call sites passing the constant. Example, `agentService.createAgent`:

   ```
   // Before (today):
   createAgent(userId, data) { ... ownerId: userId ... }

   // After:
   createAgent(context, data) {
     const owner = context.principalType === 'PersonaUser'
       ? { ownerType: 'PersonaUser', ownerId: context.personaUserId }
       : context.subject
         ? { ownerType: 'ExternalUser', ownerId: context.subject }
         : { ownerType: 'Project', ownerId: context.domain };
     ... domain: context.domain, ...owner ...
   }
   ```

   Existing Persona controllers change their one call site (`agentService.createAgent(userId, data)`
   → `agentService.createAgent(personaContext, data)`) — **the route, validation, and response shape
   are untouched.**
3. Repository queries gain the shared scoped-filter helper (AD-05 §10), called with the Persona
   constant for every existing Persona code path — since Persona has exactly one Domain, results are
   byte-for-byte identical to today (AD-03 §13's singleton-Domain finding, now made concrete).
4. New Mongo documents (Agents, Skills, Knowledge, MCP, Providers, Threads) gain the `domain` field
   with a schema **default** of `PERSONA_DOMAIN` — existing documents need no immediate backfill
   (Mongoose's schema default does not retroactively populate existing documents, but every *query*
   goes through the scoped-filter helper which explicitly includes `{domain: context.domain}` — an
   existing document with no stored `domain` field will not match `{domain: 'persona'}` unless a
   backfill runs). **This is the one real migration requirement**, and it is a simple,
   low-risk, additive backfill (`updateMany({domain: {$exists: false}}, {$set: {domain:
   'persona'}})`), safely run once per collection, no restructuring (§25).
5. **Skills/Knowledge/MCP/Providers** follow the identical pattern to Agents.
6. **Threads** — same additive-field pattern (AD-05 §25 revised this down from AD-03's original
   EXTREME estimate once the mechanism was known to be additive, not restructuring).
7. **Memory** — the one genuine exception: namespace is an **array**, and Domain must be the **root**
   element (AD-05 §16) — this cannot be a passive schema default. **IMPLEMENTATION RECOMMENDATION:**
   a temporary dual-format read path (recognize both `['users', id, ...]` and `['domains', 'persona',
   'subjects', id, ...]`), write new data in the new format only, background-backfill existing
   documents, then remove the dual-read path once verified complete (AD-05 §25, reaffirmed).

**Avoiding a permanent dual architecture (explicit task concern):** every compatibility shim above
(defaulted field, dual-format memory read) is scoped to have a **removal step** (§25) — none is
designed to persist indefinitely. The `PersonaPrincipalContext` wrapper itself is *not* a
compatibility shim to be removed — it is the permanent shape Persona's identity takes inside the
shared, Domain-aware service layer, by design (§5).

---

## 7. New Project Modules

Per AD-08, three new backend modules, no schema written here — responsibilities and relationships
only:

**`Project`** — responsibilities: identity (immutable Domain ID), display metadata (name, slug —
display-only, AD-08 §14), status (`ACTIVE|SUSPENDED|DELETING|DELETED`), default Provider/model
reference (AD-06 §11). Security-critical operations: status transitions (§22), each requiring the
context-type checks from AD-08 §34's authority matrix. No `ownerId`-shaped field on Project itself —
a Project is not "owned" (AD-04 §6, AD-08 §1).

**`ProjectMembership`** — responsibilities: the `(Project, PersonaUser) → role` relationship (v1:
`role` is always `'Admin'`, AD-08 §9). Relationships: many-to-many between `Project` and the existing
`User` collection (internal `_id`, not `clerkId`, AD-08 §10). Security-critical operation: removal —
**must** enforce the last-Admin invariant (AD-08 §12) atomically. Likely conceptual index:
`(project, personaUserId)` unique compound.

**`ProjectCredential`** — responsibilities: key-ID (indexed, public) + hashed secret (never
plaintext, AD-01), `label` (display-only), `status: ACTIVE|REVOKED`, `createdBy` (which
`PersonaUser`, audit), `createdAt`/`lastUsedAt`/`revokedAt`. Security-critical operations: **creation
requires `ProjectAdminContext` only** (AD-08 §17 — the refinement of AD-07); self-revocation may use
`ProjectMachineContext`; revoking a *different* credential requires `ProjectAdminContext`. Likely
conceptual index: `(keyId)` unique, `(project, status)` for listing.

**Relationships:** `Project 1 —— * ProjectMembership —— 1 User`; `Project 1 —— * ProjectCredential`;
every other Domain-scoped resource collection (Agent, Skill, etc.) references `Project` only via its
`domain` field value — **no direct foreign key from, e.g., `Agent` to a `Project` document is
required beyond the `domain` scalar**, keeping the coupling one-directional and consistent with
AD-05's field-based (not reference-heavy) tenancy model.

---

## 8. Authentication Pipeline

**IMPLEMENTATION RECOMMENDATION, concrete middleware boundary (extends AD-07 §32 with actual
sequencing):**

1. A **new** Express middleware, mounted only under the Developer API's path prefix, runs **before**
   any controller: (a) look for a Project-credential Authorization header → extract key ID → O(1)
   lookup → verify not revoked, Project not suspended/deleting/deleted (AD-08 §25's status-gates
   authority checks belong *here*) → hash-compare secret → produce `ProjectMachineContext`. (b) If an
   externalUserId header is also present, JIT-resolve (create-or-fetch) the internal ExternalUser
   record (§11) → upgrade to `ProjectRuntimeContext`. (c) Separately, a Clerk-session-based path
   verifies Project membership (a `ProjectMembership` lookup keyed by the Clerk-resolved
   `personaUserId`) → produces `ProjectAdminContext` for Developer Studio / admin-authenticated
   Developer API calls.
2. **Raw headers/credentials never reach the controller** — only the constructed context object
   does; this is the concrete mechanism behind AD-07 §8's "downstream code must always know which
   context type it received."
3. JIT ExternalUser creation (§11) happens **inside** this middleware, not in each individual
   controller — one place, not N.
4. Validation order matters: credential validity → Project status → externalUserId
   resolution — checking Project status **before** resolving the Subject avoids doing unnecessary
   work (and avoids JIT-creating an ExternalUser record for a Project that's already suspended).

---

## 9. Domain-Aware Persistence Strategy

**IMPLEMENTATION RECOMMENDATION — the shared scoped-filter helper (AD-05 §10), concretely:**

```
scopedFilter(domain, extraFilter = {}) {
  if (!domain) throw new Error('Domain is required for this query');
  return { domain, ...extraFilter };
}
```

Every repository method changes from e.g. `Agent.findById(id)` to
`Agent.findOne(scopedFilter(domain, { _id: id }))`. Per-model migration table:

| Model | Current dangerous pattern (FACT) | Target pattern |
|---|---|---|
| Agent | `findById(id)`; `find({visibility:'public'})` (unconditionally global) | `findOne(scopedFilter(domain, {_id:id}))`; `find(scopedFilter(domain, {visibility:'public'}))` |
| Skill | `findById(id)` (bare); `findOneAndUpdate({_id,ownerId})` (already scope+id combined, just needs `domain` added); `findPublicSkills` (unconditionally global) | Add `domain` to every existing filter object |
| KnowledgeBase | Same shape as Skill (per synthesis) | Same |
| MCP | `getMcpById(id, userId)` internally does `findById` + manual ownerId check (two steps) | Collapse to one `findOne(scopedFilter(domain, {_id, ownerId}))` |
| Provider | `findById(id)` (bare, per AD-06 §4.1) | `findOne(scopedFilter(domain, {_id:id}))` |
| Thread | `findById(id)` + separate ownership check in controller | `findOne(scopedFilter(domain, {_id:id, subject}))` — folds Domain+Subject into one query |

**No bare `findById` survives** where it could return a cross-Domain document (AD-05 §11).
Persona's existing call sites are updated to pass `PERSONA_DOMAIN` (§6) — mechanical, not risky,
because the scoped-filter's added predicate is a no-op for Persona once the backfill (§6.4) runs.

---

## 10. Ownership Migration

| Resource | Current representation | Target (AD-04) | Migration | Compatibility | Auth impact |
|---|---|---|---|---|---|
| Agents | `ownerId: ObjectId→User` | `(domain, ownerType, ownerId)`, `ownerType∈{PersonaUser,Project,ExternalUser}` | Additive fields, default `ownerType='PersonaUser'` for existing docs | Existing `ownerId` field reused as `ownerId` under the new shape | `canUserExecuteAgent` extended to check `domain` match first |
| Skills/Knowledge/MCP | Same pattern | Same pattern | Same | Same | Same shape of extension |
| Providers | Same, `OwnerType∈{PersonaUser,Project}` only (AD-06) | Same, no `ExternalUser` | Same | Same | Dependency-check corrected to Domain-scoped, not owner-scoped (AD-06 §22) |
| Threads/runtime state | `userId` | `(domain, subject, agentId)` — **Subject model, not Owner** (AD-04 §15) | Additive fields | `userId` field reused as `subject` | Ownership check becomes a 3-way match (§13) |
| Files | None (flat, unscoped) | `(domain, subject, [agentId/threadId])` — Subject model | New durable-file record needed for any non-avatar upload (§15) | N/A — no current model to preserve | Access becomes mediated, not static |
| Memory | `['users', userId, ...]` | `['domains', domainId, 'subjects', subjectId, ...]` | Namespace **restructuring**, dual-read window (§6.7) | Old-format read path during transition | Namespace prefix *is* the isolation boundary |

**IMPLEMENTATION RECOMMENDATION:** no polymorphism is invented beyond the three `OwnerType`s AD-04
already named — every model above reuses the exact same two added dimensions (`domain`, `ownerType`)
or the Subject triple, never a bespoke per-model shape.

---

## 11. ExternalUser / Subject Implementation

**IMPLEMENTATION RECOMMENDATION:** a minimal internal record is required — **not** a full "User"
document. Needed fields (conceptually): `(domain, externalUserId)` compound-unique key, an internal
stable ID (for foreign-key-style references from owned resources, if that's operationally easier
than always carrying the compound key), optional soft display metadata (never used for scoping,
AD-02 §12). **JIT resolution** happens inside the auth middleware (§8) — resolve-or-create,
idempotent, mirroring `authService.syncUser`'s existing shape (AD-02 §11.1) for a different identity
source. **Which resources need the internal ID vs. the qualified key directly:** resources with a
Mongo foreign-key-style reference (an ExternalUser-owned Agent's `ownerId`) are cleaner with the
internal ID; namespace-shaped state (memory, cache keys) uses the qualified `(domain, externalUserId)`
pair directly, since arrays/strings don't benefit from an extra indirection. **No over-persistence:**
no profile sync job, no periodic reconciliation with the host's own user data — metadata is accepted
and stored softly only if supplied on a given request (AD-02 §12).

---

## 12. Agent Changes

**Model:** add `domain`, `ownerType`, generalize `ownerId`'s meaning (§10). **Service:**
`canUserExecuteAgent(agent, principalContext)` replaces `canUserExecuteAgent(agent, userId)` — first
check becomes `agent.domain === context.domain` (else not-found, per AD-07 §29's collapsed-error
rule), then the existing owner/visibility logic, generalized to compare `context`'s effective
identity against `(ownerType, ownerId)` rather than a bare `userId`. **`_buildSearchFilter`:** the
unconditionally-global no-owner branch (`match.visibility='public'`) gains a mandatory `domain`
predicate — this is the single highest-priority code change in the entire blueprint (synthesis's
top-severity finding, AD-05 §27-#3/#4). **AgentFactory:** `buildAgent(agentId, userId, checkpointer)`
→ `buildAgent(agentId, context, checkpointer)`; cache key `${cacheKey}:${userId}` →
`${cacheKey}:${domain}:${subject}` (§27).

---

## 13. Thread / Checkpoint Changes

**Thread model:** add `domain`; `userId` reinterpreted as `subject` (Subject model, not Owner, AD-04
§15.3). **The known gap, closed here architecturally (not yet in code):** every Thread lookup/resume
must verify **all three** of `(domain, subject, agentId)` — today only `userId` is checked and
`agentId` is never compared to the requested one (verified FACT across synthesis/AD-02/AD-05/AD-08).
**IMPLEMENTATION RECOMMENDATION:** this is the *same* code change that adds Domain-awareness — do
not schedule it as a separate follow-up (AD-05 §29, AD-08 §42, both already insist on this). **AG-UI
resume:** the deterministic fallback ID `agui-${agentId}-${userId}` becomes
`agui-${domain}-${agentId}-${subject}` (AD-05 §14, directly closing synthesis §11.1's flagged
weakness). **Checkpoint service:** no stored field (third-party schema); the gate that already
exists (`thread.userId === userId` before `getTuple`) is extended to check all three, and this
remains the **only** call site permitted to touch the raw checkpointer (AD-05 §15).
**Playground/test threads (Studio):** **OPEN** — no current architecture decision distinguishes
Studio test conversations from consumer conversations by a flag; nothing in AD-01–AD-08 requires one
either. **Not invented here** — flagged OPEN per task instruction, to be revisited only if a real
product need surfaces.

---

## 14. Memory Changes

Covered in depth at §6 step 7 and AD-05 §16 — restated concretely: `userMemoryNamespace(userId)` →
`userMemoryNamespace(domain, subject)`, returning `['domains', domain, 'subjects', subject]`;
`agentMemoryNamespace` gains the same root prefix. **Critical test (explicit in task):**
`(BeyondCampus, "rahul")` and `(Coursify, "rahul")` must produce entirely different namespace
arrays — true by construction once `domain` is the root element, since the two arrays diverge at
index 1, before `"rahul"` ever appears.

---

## 15. File / Upload Changes

**FACT (§3, this pass):** today's upload module handles avatars only, unscoped, static. **IMPLEMENTATION
RECOMMENDATION:** Developer-Platform file upload is a **new** capability, not a retrofit of the
avatar path (different purpose, different risk profile) — introduce a durable file record
`(domain, subject, [agentId], [threadId], storageKey)`, with retrieval **mediated** through an
authorization check (verify requester's `(domain, subject)` matches, or genuine admin authority) —
**never** a bare static URL for Developer-Platform files (AD-05 §20, AD-07 §22). The existing avatar
path may remain exactly as-is for Persona (low risk, narrow, unrelated to Project data).

---

## 16. Skills Changes

Same shape as Agents (§12, §10): `domain` + `ownerType` added; `findPublicSkills`'s unconditional
`{isPublic:true}` gains the mandatory `domain` predicate (same class of fix as Agent search);
Domain-local `(domain, ownerType, ownerId, name)` uniqueness replaces today's global
`(ownerId, name)` (AD-05 §12).

---

## 17. Knowledge / Qdrant Changes

Mongo side: identical pattern to Skills. **Qdrant side (DECISION FROM AD-05 §19): no change to the
collection-per-Knowledge-Base architecture** — it already isolates by construction. **IMPLEMENTATION
RECOMMENDATION:** add `domain` (alongside the existing `kbId`/`sourceName`) as point-level payload
metadata going forward, as a cheap, additive, non-breaking defense-in-depth backstop (AD-05 §19) —
existing vectors are unaffected; only new writes gain the field.

---

## 18. MCP Changes

**Definition:** same Owner-model pattern as Skills/Agents. **`authMode:'user'` connections
(`mcp-user-connection.model.js`):** compound key `(mcpId, userId)` → `(domain, mcpId, subject)`
(AD-05 §17). **OAuth initiation/callback (`mcp.service.js`, method inventory §3):**
`getUserAuthorizationUrl`/`handleUserCallback` already isolate the signed-state payload
(`{mcpId, userId, mode, codeVerifier, exp}`, AD-01/AD-02 evidence) — **IMPLEMENTATION
RECOMMENDATION:** extend the payload to `{mcpId, domain, subject, mode, codeVerifier, exp}`, reusing
the exact existing HMAC-SHA256 signing mechanism (no new crypto). **The callback must never trust a
caller-supplied `domain`/`subject` on the live callback request** — both come exclusively from the
verified state (AD-02 §16, AD-07 §25, reaffirmed, not re-decided). **Status/revoke:** self-access
returns full status; administrative access (Project Admin/machine) returns metadata/status only,
**never** the credential contents (AD-04 §24-#11, AD-06 §16.3, AD-07 §24 — the same rule, now applied
at the concrete method level: `getUserConnectionStatus` for admin callers must not expose the
decrypted token, only existence/timestamps).

---

## 19. Provider Changes

Per AD-06 in full: `domain` + `ownerType∈{PersonaUser,Project}` added; dependency-check corrected
from `count({providerId, ownerId})` to `count({providerId, domain})` (AD-06 §22, closing the gap AD-04
§17 flagged); a new `Disabled` status (reversible, distinct from delete); resolution algorithm gains
the Project-default branch and drops the "first found" fallback outside Persona's Architect case
(AD-06 §15). **AgentFactory secret-lifetime cleanup (explicitly requested, not implemented):** the
cached `result.providerConfig.apiKey` (plaintext, confirmed unused downstream except
`providerConfig.label`, AD-06 §4.2) should be **removed from the cached bag** — construct the LLM
client with the decrypted key, then let the key go out of scope; do not carry it forward in the
cache entry. This reduces how long decrypted material lingers in process memory, without changing
any external behavior. **Not implemented in this pass** — flagged as a concrete, low-risk cleanup
task for the Provider implementation phase (§34 Phase 7).

---

## 20. AG-UI / Runtime Changes

**DECISION FROM AD-07 §20:** a **new**, Project-authenticated AG-UI route, sharing the **same**
runtime (`runAgentAsAguiEvents`, `AgentFactory.buildAgent`, the AG-UI translator) as today's
`/api/v1/agui`. **IMPLEMENTATION RECOMMENDATION:** the shared runtime functions gain a `context`
parameter (replacing bare `userId`) everywhere identity currently flows — `buildAgent(agentId,
context, checkpointer)`, `resolveAgentTools(agent, context)`, `resolveMcpTools`,
`resolveKnowledgeBaseTools`. The **route-level** code (header parsing, SSE setup, concurrency
limiter) is duplicated **only** to the extent the authentication mechanism differs (Clerk vs.
Project credential) — everything downstream of context construction is one code path, not two. No
new streaming protocol; AG-UI's event shapes are untouched.

---

## 21. Developer API

Per AD-07 §15's capability matrix, grouped for implementation sequencing:

**Control plane (new controllers/services):** Project CRUD, ProjectMembership CRUD, ProjectCredential
lifecycle, Project-owned resource CRUD (reusing the same generalized Agent/Skill/Knowledge/MCP/
Provider services from §12/16-19, called with `ProjectMachineContext`/`ProjectAdminContext`).
**Runtime plane (new controllers, shared services):** ExternalUser-owned resource CRUD (same
services, called with `ProjectRuntimeContext`), Agent execution (§20), Thread list/create/resume
(§13), file upload/access (§15), MCP user OAuth (§18). **Existing Persona controllers are not
exposed under the new prefix** — their trust assumptions (`req.user` from Clerk) are Persona-specific
and are not reused as Developer API controllers, per explicit task instruction; only the
**underlying services**, generalized per §5's context model, are shared.

---

## 22. Project Lifecycle

Implementation phases for AD-08's model: (1) creation — atomic Project+Creator-record+initial-
Admin-membership; (2) membership add/remove with the last-Admin invariant enforced as an atomic
check (§42 risk); (3) credential create (Admin-only)/self-revoke/admin-revoke; (4) status
transitions ACTIVE↔SUSPENDED (self or Platform, with the restore-symmetry rule, AD-08 §26)
→DELETING (immediate credential/runtime halt) →DELETED (async cleanup, §28). **Persona account
deletion precondition (new, required change to existing code):** `userService.deleteUser` gains a
check — reject if the user is the sole remaining Admin of any ACTIVE Project (AD-08 §13) — a narrow,
additive precondition on existing, working code, not a rewrite of the cascade itself.

---

## 23. Audit

**FACT:** no audit-log infrastructure exists today (distinct from the operational `logger.info`
structured logging already in use everywhere). **Classified as a new platform primitive**, per task
instruction — not analytics. **IMPLEMENTATION RECOMMENDATION:** minimum viable shape — an
append-only record per lifecycle event (AD-08 §35's list) capturing `{eventType, timestamp,
actorContextType, actorIdentity, targetDomain, targetResourceId}` — reusing the existing MongoDB
deployment (a new collection), not a new datastore. No schema fields are locked here.

---

## 24. Observability

**IMPLEMENTATION RECOMMENDATION:** extend the existing structured-logging convention (`logger.info`
calls already used throughout, e.g. `_buildLLM`'s masked-key logging, AD-06 §4.2) with `domain`,
`credentialId`/`subject`, `principalType`, `agentId`, `threadId` fields, attached once the context
object is constructed (§8) and passed through, not reconstructed at each log site. **Never log:**
Project credential secrets, Provider secrets, OAuth tokens, decrypted file contents — reaffirming
existing convention (`maskedKey` pattern, `AGENTS.md`), not a new rule.

---

## 25. Data Migration Strategy

| Model | Migration classification | Why |
|---|---|---|
| Agent, Skill, KnowledgeBase, MCP definition, Provider | **BACKFILL** (one-time, additive `domain` field defaulted to `PERSONA_DOMAIN`) | Additive field, no restructuring, no live-data risk (AD-05 §25) |
| Thread | **BACKFILL** | Same reasoning — revised down from AD-03's original EXTREME estimate |
| Checkpoint | **NO DATA MIGRATION** | Existing checkpoints keep working unmodified under their existing bare keys; only new threads use the Domain-extended key (AD-05 §25) |
| Memory | **DUAL READ TEMPORARILY**, then one-time backfill, then remove dual-read | The one genuine namespace restructuring case (§6.7) |
| Qdrant | **NEW DATA ONLY** (point metadata on future writes) | No existing vectors are touched |
| Project/ProjectMembership/ProjectCredential/ExternalUser | **NEW DATA ONLY** | Nothing to migrate from — greenfield (AD-08 §39) |

**Preserving AD-03's benefit, explicitly:** no model above requires a giant, synchronous, all-at-
once Persona migration — every classification is either additive-and-safe or entirely new.

---

## 26. Index Strategy

Conceptual only, justified by the queries above, no exact schema:

- `(domain, _id)` — every Domain-qualified single-resource lookup (§9).
- `(domain, ownerType, ownerId)` — "list my own resources" queries.
- `(domain, visibility)` — discovery/marketplace queries (Agent, Skill, Knowledge).
- `(domain, subject, agentId)` — Thread lookup/resume (§13).
- `(domain, mcpId, subject)` — MCP user connections (§18).
- `(project, externalUserId)` unique — ExternalUser resolution (§11).
- `(domain, ownerType, ownerId, name)` — replacing today's global `(ownerId, name)` uniqueness on
  Skill/MCP (AD-05 §12).
- `(keyId)` unique on ProjectCredential; `(project, personaUserId)` unique on ProjectMembership.

**Global uniqueness constraints requiring Domain-scoping:** Agent `slug` → `(domain, slug)`;
Skill/MCP `(ownerId, name)` → `(domain, ownerType, ownerId, name)`. **Remaining global, unchanged**
(AD-05 §12): `qdrantCollectionName`, User `clerkId`/`email`/`username`.

---

## 27. Cache / Singleton Re-Keying

| Cache/state | Current key (FACT) | Target key | Risk if unchanged | Required change |
|---|---|---|---|---|
| AgentFactory `agentCache` (LRU) | `${agentId}:${userId}` | `${agentId}:${domain}:${subject}` | Cross-Domain cache poisoning if `userId`/`externalUserId` ever collide | Add `domain` to key construction |
| Rate limiter (`rateLimiterService`) | `concurrency:CHAT:${userId\|\|ip}`, keyed by `req.user._id`/IP | `${domain}:${subject}` incorporated | One Project could exhaust a shared bucket keyed only on a colliding subject string | Extend `buildKey` inputs |
| Knowledge embeddings map (`_embeddingsMap`) | `${providerId\|\|'default'}:${modelName}` | Unaffected by Domain directly — keyed by Provider, already unique per Domain via `providerId` | Low — Provider IDs are already Domain-qualified once §19 lands | No change needed beyond Provider itself being Domain-scoped |
| Knowledge Qdrant client (`_qdrantClientPromise`) | Singleton, one shared client | Unchanged | None — connection-level singleton, not identity-keyed | No change |
| Checkpoint deterministic ID | `agui-${agentId}-${userId}` | `agui-${domain}-${agentId}-${subject}` | Cross-Domain thread-ID collision (synthesis §11.1) | AG-UI route construction (§13) |

**No process-local cache was missed** by virtue of being "not a database model" — the AgentFactory
LRU and the rate-limiter's in-memory counters are both covered above precisely because they are
process-local, not persisted.

---

## 28. Background Cleanup Requirements

**BLOCKER-adjacent finding, not an architecture blocker but a real implementation gap:** AD-08 §28's
deletion model requires **asynchronous** cleanup across Mongo, memory, Qdrant, checkpoints, and
files. **FACT (§3, this pass): no job-queue/worker infrastructure exists** — only `node-cron`'s
simple interval scheduler, currently running one job. **IMPLEMENTATION RECOMMENDATION (capability
required, not a specific library choice, per task instruction):** the platform needs a durable,
retry-capable, at-least-once task-execution mechanism for Project-deletion cleanup specifically (a
single cron tick is insufficient for a multi-storage-type purge that may span minutes and must
survive a process restart mid-cleanup). This capability does not need to be chosen in this
document — it is flagged as a **required infrastructure decision** for Phase 10 (§34), with the
existing `node-cron` mechanism sufficient only as the *trigger* that discovers Projects in `DELETING`
past their grace period, not as the cleanup executor itself.

---

## 29. Frontend / Developer Studio Dependencies

Not designing UI. Concepts this architecture already establishes (Project, Members, Credentials,
default Provider, Agents/Skills/Knowledge/MCP resource groups, per AD-07 §36) are what a later
Studio IA organizes around. **IMPLEMENTATION RECOMMENDATION:** Developer Studio is additive to the
existing Next.js app (a third route tree alongside `/dashboard` and `/studio`) and authenticates via
`ProjectAdminContext` — reusing Clerk exactly as `/studio` already does (AD-07 §36) — no new
frontend auth system.

---

## 30. Test Strategy

| Scenario (from task list) | Level |
|---|---|
| Persona regression (existing behavior unchanged post-backfill) | Integration + E2E |
| Project A vs. Project B isolation (every resource type) | Security isolation (integration) |
| Persona vs. Project (neither sees the other) | Security isolation |
| Same `externalUserId` across different Projects (no collision) | Security isolation |
| Project-owned Agent used by multiple ExternalUsers (shared def, isolated state) | Integration |
| Cross-Domain IDOR (bare-ID guesses) | Security isolation |
| Thread replay: wrong Domain / wrong Subject / wrong Agent | Security isolation (three distinct tests, closing the known gap) |
| Memory/file/Knowledge isolation | Security isolation |
| MCP owner-auth vs. user-auth; OAuth callback tampering | Security isolation + runtime |
| Provider secret non-exposure (every endpoint, every principal) | Security isolation |
| Machine credential cannot mint a credential | Security isolation (specifically validates AD-08 §17) |
| Last-Admin removal blocked; account deletion blocked while sole Admin | Service/integration |
| Suspension/deletion halts execution immediately | Runtime + integration |
| Domain cleanup completeness after deletion | Migration/E2E |
| AG-UI streaming regression (both Persona and Developer routes) | Runtime/E2E |

**IMPLEMENTATION RECOMMENDATION:** the "missing Domain fails closed" property (§9) deserves a
dedicated **unit** test on the shared scoped-filter helper itself, in addition to all the
integration-level isolation tests above (AD-05 §26).

---

## 31. Security Gates

Derived directly from the approved architecture, required before enabling Developer Projects in
production:

1. No unscoped Developer-reachable resource lookup remains (`grep`-verifiable: no bare
   `findById`/`find({visibility:...})` without the shared helper in any Developer-reachable path).
2. Full cross-Domain isolation test suite passes (§30).
3. Thread `(Domain, Subject, Agent)` invariant enforced and regression-tested.
4. Provider secrets verified never returned, across every endpoint including Platform Admin's path.
5. Project credential revocation verified immediate; credential creation verified `ProjectAdminContext`-only.
6. MCP OAuth signed-state verified to carry and check `(domain, subject)`, tamper-tested.
7. `SUSPENDED`/`DELETING` Projects verified unable to authenticate or execute.
8. Project deletion cleanup verified complete across Mongo, memory, Qdrant, checkpoints, and files.

---

## 32. Risk Register

| Risk | Severity | Likelihood | Modules | Mitigation | Test | Phase |
|---|---|---|---|---|---|---|
| Cross-Domain leakage via a missed unscoped query | Critical | Medium (large surface) | Agents/Skills/Knowledge/MCP/Provider | Shared scoped-filter helper + lint/grep gate | §31 Gate 1–2 | 3 |
| Persona regression during backfill | High | Low–Medium | All Mongo models | Additive-only fields, defaulted, non-destructive backfill | E2E regression suite | 3 |
| Thread/session collision (known gap) | High | Medium until fixed | Threads, AG-UI | Domain+Subject+Agent verification, closed in the same re-keying effort | §30 dedicated tests | 6 |
| Memory collision across Projects | Critical | Low once root-prefixed | Memory | Domain-as-root namespace | §30 isolation test | 6 |
| File leakage via static path | High | Medium (currently zero auth on retrieval) | Upload/Files | Mediated access, no new static-serving for Developer files | §30 isolation test | 6 |
| Provider secret leakage | Critical | Low (already well-guarded) | Providers, AgentFactory | Preserve existing never-return posture; trim cached plaintext lifetime | §30, §31 Gate 4 | 7 |
| MCP credential collision/OAuth tampering | Critical | Low–Medium | MCP | Domain-extended signed state; compound key | §30 | 7 |
| Credential escalation (machine mints credential) | Critical | Low once gated | ProjectCredential | `ProjectAdminContext`-only creation (AD-08 §17) | §30, §31 Gate 5 | 2 |
| Project deletion incompleteness | High | Medium (multi-storage purge) | Background cleanup | Reuse AD-05's tractable enumeration; durable task execution (§28) | §30, §31 Gate 8 | 10 |
| Cache-key collisions | High | Medium | AgentFactory, rate limiter | Domain-qualified keys | §30 | 6–7 |
| Admin authority confusion (context conflation) | High | Low (structurally separated) | Auth middleware | Distinct, non-overlapping context types | §30 | 1–2 |
| Performance degradation from added predicates | Low | Low | All Mongo queries | New compound indexes (§26) | Load test | 3 |
| Developer Studio bypassing API authority | High | Low if disciplined | Studio (frontend) | Studio consumes the same API, no hidden service calls (AD-07 §36) | Code review + integration test | 11 |

---

## 33. Architecture Debt Included in Scope

Verified against current code (not assumed), all four already known and now confirmed still present:

- `thread.agentId` never compared to requested `x-agent-id` (§13) — fixed as part of Thread
  re-keying, Phase 6.
- Global public-discovery queries (Agent search, Skill `findPublicSkills`) with zero scope predicate
  (§9, §12, §16) — fixed as part of Domain-aware persistence, Phase 3.
- AgentFactory's cached plaintext `providerConfig.apiKey`, confirmed unused downstream except
  `.label` (§19) — fixed as part of Provider implementation, Phase 7.
- `userService.deleteUser`'s unconditional cascade (§3, §22) — gains the last-Admin precondition as
  part of Project Lifecycle, Phase 10; the cascade's core behavior for Persona-only deletions is
  otherwise untouched (not in scope to redesign further).

**Explicitly not included as debt cleanup** (avoiding scope creep, per task instruction): the dual
legacy `MongoDBStore`/`MemoryFilesStore` memory-store split mentioned in earlier research is left
alone unless it interacts directly with Domain re-keying.

---

## 34. Implementation Phases

Sequenced by dependency and safety, derived from the actual coupling graph above — **not** a
UI-driven or aesthetic ordering.

**Phase 0 — Safety baseline.** *Objective:* establish the shared scoped-filter helper, the
`PersonaPrincipalContext` wrapper, and a security-isolation test harness, touching zero user-visible
behavior. *Why now:* every later phase depends on this existing and being trusted. *Files:* new
util (`domainQuery.js`-shaped helper), no model changes yet. *Schema/API/Runtime/Frontend impact:*
none. *Tests:* unit tests on the helper (§30). *Gate:* none yet — this phase creates Gate 1's
tooling. *Dependencies:* none. *Rollback:* trivial (unused code, feature-flagged off). *Exit
criteria:* helper exists, is unit-tested, and is not yet called by any production code path.

**Phase 1 — Domain/context primitives.** *Objective:* implement the four context types (§5, §8) and
the new Developer auth middleware skeleton (no Project model yet — stub credential lookup). *Why
now:* every subsequent controller change depends on a stable context shape. *Files:*
`modules/auth/*` (new Developer middleware alongside existing), no changes to `authMiddleware`
itself. *Schema:* none yet. *Tests:* middleware unit tests (context construction correctness, fail-
closed on missing Domain). *Gate:* contributes to Gate 1. *Dependencies:* Phase 0. *Rollback:* new,
unmounted middleware — zero risk to existing routes. *Exit criteria:* all four context shapes
constructible and unit-tested in isolation.

**Phase 2 — Project + membership + credentials.** *Objective:* build the three new modules (§7),
wire the real Developer auth middleware to them, enforce AD-08 §17's credential-creation refinement
and §12's last-Admin invariant. *Why now:* nothing Project-scoped can be tested end-to-end without a
real Project to authenticate against. *Files:* new modules only. *Schema:* new collections. *API:*
Project/Membership/Credential CRUD (control-plane only, no resource CRUD yet). *Tests:* the
credential-escalation and last-Admin test cases (§30, §31 Gate 5). *Gate:* Gate 5. *Dependencies:*
Phase 1. *Rollback:* entirely new, unreferenced modules — safe to disable. *Exit criteria:* a
Project can be created, administered, credentialed, and authenticated against, with zero coupling to
existing resource models yet.

**Phase 3 — Domain-aware persistence (Agents first).** *Objective:* apply the scoped-filter helper
and `domain`/`ownerType` fields to Agents specifically (the highest-value, highest-risk module),
including the backfill (§25) and the global-search fix (§12, §31 Gate 1–2's primary target). *Why
now:* Agents are the resource every other phase's tests reference; fixing the highest-severity known
issue (unscoped public search) early reduces exposure window. *Files:* `agents/*`, one-time backfill
script (not written in this doc). *Schema:* additive fields + backfill. *Auth:* `canUserExecuteAgent`
generalized. *Tests:* Persona-regression E2E + cross-Domain isolation for Agents specifically. *Gate:*
1, 2. *Dependencies:* Phases 0–2. *Rollback:* additive fields, feature-flag the new query path
alongside the old one during rollout; revert flag if regression detected. *Exit criteria:* Agent
CRUD/search/execution-authorization Domain-aware and regression-clean for Persona.

**Phase 4 — Ownership model, remaining resources (Skills, Knowledge, MCP, Providers).** *Objective:*
repeat Phase 3's pattern across the remaining durable resource types (§10, §16–19). *Why now:*
mechanical repetition of a now-proven pattern; parallelizable across resource types (§36). *Files:*
per-module. *Schema:* additive + backfill, per module. *Tests:* per-module isolation tests. *Gate:*
1, 2, 4. *Dependencies:* Phase 3 (pattern proven). *Rollback:* per-module, independent. *Exit
criteria:* every durable resource type Domain-aware.

**Phase 5 — ExternalUser / Subject model.** *Objective:* JIT resolution (§11), wired into the
Developer auth middleware from Phase 2. *Why now:* runtime-plane testing (Phase 6+) needs a real
Subject to test against. *Files:* new `externalUsers/*` module. *Schema:* new collection. *Tests:*
JIT idempotency, `(project, externalUserId)` non-collision across Projects. *Gate:* contributes to
Gate 2. *Dependencies:* Phase 2. *Rollback:* new, isolated module. *Exit criteria:* Subject
resolution stable and collision-tested.

**Phase 6 — Threads / memory / files.** *Objective:* the highest-risk runtime-state re-keying —
Thread `(domain,subject,agentId)` invariant (closing the known gap), memory namespace-root migration
(dual-read window), file mediation. *Why now:* depends on Subject (Phase 5) and Agent Domain-
awareness (Phase 3); this is explicitly the module the task and prior ADs flag as most
security-critical. *Files:* `threads/*`, `memory/*`, `upload/*` (new Developer file path). *Schema:*
additive (Thread) + restructuring (memory, dual-read). *Runtime:* checkpoint key extension, AG-UI
deterministic-ID extension. *Tests:* the three thread-replay tests (§30), memory cross-Domain
collision test. *Gate:* 3. *Dependencies:* Phases 3, 5. *Rollback:* memory dual-read window is
explicitly designed for safe rollback (old format still readable); Thread/checkpoint changes are
additive. *Exit criteria:* all three thread-replay tests pass; memory isolation test passes.

**Phase 7 — Providers + MCP runtime.** *Objective:* AD-06's full resolution algorithm, Provider
dependency-check fix, AgentFactory secret-lifetime cleanup, MCP `(domain,subject,mcpId)` re-keying,
OAuth signed-state extension. *Why now:* depends on Domain-aware Providers (Phase 4) and Subject
(Phase 5); runtime execution (Phase 8) needs working Provider resolution first. *Files:*
`providers/*`, `mcp/*`, `agents/agent.factory.js`. *Tests:* Provider secret non-exposure, MCP
owner/user auth isolation, OAuth tampering. *Gate:* 4, 6. *Dependencies:* Phases 4–5. *Rollback:*
Provider resolution changes are additive (new branches in an existing algorithm); revertible via
feature flag. *Exit criteria:* Gates 4 and 6 pass.

**Phase 8 — Developer runtime / AG-UI.** *Objective:* the new Developer AG-UI route (§20), sharing
the runtime proven in Phases 3–7. *Why now:* this is the first phase where an external product could
actually run an agent end-to-end — deliberately sequenced *after* every isolation guarantee it
depends on is already tested. *Files:* new `agui`-adjacent Developer route + context-parametrized
runtime functions. *Tests:* full E2E — Beyond Campus/Sabik/Career-Launchpad scenario (§1). *Gate:* 3,
7. *Dependencies:* Phases 3–7 all complete. *Rollback:* new, separately-mounted route; disable via
route-level flag. *Exit criteria:* the running example (§1) works end-to-end with full isolation
verified.

**Phase 9 — Developer control-plane API.** *Objective:* REST CRUD surface for every resource type,
grouped per AD-07 §15/21. *Why now:* runtime already proven (Phase 8); this phase is mostly wiring
existing generalized services to new routes. *Files:* new controllers/routes under the Developer
prefix. *Tests:* API-level contract tests, error-model collapsing tests (AD-07 §29). *Gate:* 1
(re-verified at the API layer). *Dependencies:* Phase 8 (proves the underlying services work) —
though much of the control-plane CRUD could parallelize with Phase 8 (§36). *Exit criteria:* full
AD-07 §15 capability matrix reachable.

**Phase 10 — Project lifecycle / deletion / audit.** *Objective:* status transitions, suspension,
soft-delete + grace period, async Domain cleanup (requiring the background-execution capability
flagged in §28), audit log. *Why now:* deletion is the highest-blast-radius operation in the entire
platform (AD-08 §27) — deliberately sequenced last among core phases, once every storage type's
cleanup path (Mongo, memory, Qdrant, checkpoints, files) has already been built and tested
individually in Phases 3–7. *Files:* `Project` status logic, new cleanup-orchestration capability
(§28), new audit module. *Tests:* full deletion-completeness E2E, suspension-halts-execution. *Gate:*
7, 8. *Dependencies:* Phases 2–9. *Rollback:* deletion's own grace-period/cancel mechanism *is* its
rollback path by design. *Exit criteria:* Gates 7–8 pass; a full create→use→suspend→delete lifecycle
is E2E-tested.

**Phase 11 — Developer Studio (frontend).** Not designed here; depends on Phase 9's API surface
being stable.

**Phase 12 — SDK / integration tooling.** Not designed here; depends on Phase 9.

---

## 35. Dependency Graph

```
Phase 0 (helper+context wrapper)
  └─► Phase 1 (context types + middleware skeleton)
        └─► Phase 2 (Project/Membership/Credential)
              ├─► Phase 3 (Agents Domain-aware)  ──┐
              │      └─► Phase 4 (Skills/KB/MCP-def/Provider)
              ├─► Phase 5 (ExternalUser/Subject)     ├─► Phase 6 (Threads/Memory/Files)
              │                                       │        └─► Phase 8 (Developer AG-UI)
              └──────────────────────────────────────┴─► Phase 7 (Providers+MCP runtime)
                                                                 └─► Phase 8 ─► Phase 9 (Control-plane API)
                                                                                    └─► Phase 10 (Lifecycle/deletion/audit)
                                                                                          └─► Phase 11 (Studio) ─► Phase 12 (SDK)
```

---

## 36. Parallelization Strategy

**Safely parallel:** Phase 4's per-resource-type work (Skills, Knowledge, MCP definitions, Providers
can all be re-keyed by different agents simultaneously once Phase 3 proves the pattern on Agents).
Phase 9's control-plane CRUD wiring can substantially overlap with Phase 8's runtime work (different
files, same underlying services). Phase 2's three new modules (Project, Membership, Credential) can
be built by separate agents against an agreed interface, then integrated.

**Must remain sequential:** Phase 6 (Thread/Memory/Files) **must not** start before Phase 5 (Subject)
and Phase 3 (Agent Domain-awareness) are both done — re-keying runtime state without a stable Subject
identity to key on would have to be redone. Phase 8 (Developer AG-UI) **must not** race ahead of
Phase 7 (Provider/MCP runtime) — executing agents against unfinished Provider resolution is exactly
the kind of "UI before API semantics" mistake the task warns against, generalized to runtime. Phase
10 (deletion) **must** wait for every individual storage type's cleanup path to exist (Phases 3–7) —
deletion orchestrates them, it doesn't invent new cleanup logic.

---

## 37. Merge-Conflict Hotspots

`agent.factory.js` (touched in Phases 3, 7, 8 — cache key, Provider resolution, context
parametrization all land here); `agent.service.js`'s `canUserExecuteAgent`/`_buildSearchFilter`
(Phases 3 and reused everywhere authorization is checked); the shared scoped-filter helper itself
(Phase 0, then called from every subsequent phase — changes to its signature ripple widely, so its
interface should be finalized and stable by the end of Phase 0, not iterated on later);
`mcp-token.service.js`/`mcp.service.js` (Phases 4 and 7 both touch MCP). **Recommendation:** freeze
the scoped-filter helper's signature after Phase 0's tests pass; treat `agent.factory.js` changes as
strictly sequential (one phase's PR merges before the next phase's branch is cut against it).

---

## 38. Rollback Strategy

Every phase above lists a per-phase rollback (§34). **General principle:** additive schema changes
(new fields with defaults) are rolled back by simply reverting the code that reads them — the fields
themselves are harmless to leave in place. The memory dual-read window (Phase 6) and Project
deletion's grace period (Phase 10) are the two places where rollback is a **designed feature**, not
an afterthought — both were chosen specifically because they're reversible.

---

## 39. Developer Platform MVP

**MUST HAVE for first dogfood (Beyond Campus):** Project creation + single Admin (Raiyan) + one
credential; Project default Provider; Project-owned System Agent (Career Launchpad) creation via
control-plane API; external-user-owned Agent creation (Sabik's Placement Agent) via runtime-plane
API; Agent execution via Developer AG-UI with full Thread/Memory/File isolation (Rahul ≠ Sabik ≠
Aman); Project-scoped discovery (no Persona/other-Project leakage); MCP runtime-user auth (at least
one connector); basic lifecycle (create, suspend, delete) — **all security gates (§31) must pass**,
none are cut for MVP, per explicit task instruction.

**SHOULD HAVE before general release:** multiple Admins + invitation of an existing Persona User;
multiple credentials with labels; audit log UI/export; richer error-model coverage across every
endpoint; background-cleanup infrastructure hardened (not just "works for one Project at a time").

**LATER:** invitation-of-non-account-holder workflow; per-Project capability policy (AD-08 §32,
Option B); credential expiration; any richer role beyond Admin; Developer Studio full IA; SDK.

---

## 40. General-Release Requirements

Everything in §39's SHOULD-HAVE, plus: load-tested Domain-predicate performance (§26 indexes
validated under realistic query volume), a proven, tested background-cleanup mechanism (§28) rather
than a single-Project-at-a-time stopgap, and a completed audit-log query surface for Platform Admin
support use (AD-08 §33).

---

## 41. Deferred Work

Exact schemas/field types; RBAC beyond Admin-only; invitation email delivery; Developer Studio UI;
SDK method design; billing/pricing/quotas; deployment topology; webhooks; exact retention durations;
cross-Project sharing; browser-safe Project authentication; a chosen background-job technology
(§28 — capability identified, product not chosen).

---

## 42. Open Implementation Questions

1. Exact background-job/queue technology (§28) — capability required, not chosen here.
2. Exact grace-period duration for Project deletion (AD-08 §41, unresolved, carried forward).
3. Whether Studio playground/test threads need a distinguishing flag (§13) — OPEN, no current
   requirement demands one.
4. Exact mechanism for making the last-Admin check atomic under concurrent requests (§32 risk) —
   an implementation-level locking/transaction choice, not an architecture question.
5. Whether the existing `node-cron` `deleteInactiveUsers` job needs to become aware of the new
   last-Admin-blocks-deletion precondition, or whether that job is superseded by the checked
   `userService.deleteUser` path entirely — needs a quick, targeted look at that job's own call path
   before Phase 10.

---

## 43. Recommended First Coding Task

**PR objective:** implement the shared Domain-scoped query helper (§9) and the
`PersonaPrincipalContext` wrapper (§5) — **nothing else.** No Project model, no new routes, no
behavior change reachable by any existing user.

**Files/modules affected:** one new utility module (the scoped-filter helper) and one new, small
wrapper function called from existing controllers' entry points, constructing a context object
from `req.user` — **the wrapper is constructed but not yet threaded into any service signature.**

**What it deliberately does NOT do:** does not change any Mongoose model; does not change any
repository method signature; does not touch `agent.factory.js`, threads, memory, MCP, or providers;
does not create the Project/Membership/Credential modules; does not mount any new route; is not
reachable from any existing request path yet (it is exercised only by its own unit tests).

**Tests:** unit tests proving (a) the scoped-filter helper always includes the `domain` key in its
output and throws when `domain` is missing/falsy, and (b) the context wrapper correctly extracts
`personaUserId`/`domain` from a mock `req.user`.

**Rollback:** delete the two new files — nothing else references them yet, so rollback has zero
blast radius.

**Exit criteria:** both utilities exist, are unit-tested, are reviewed, and are merged — with **zero**
observable change to any existing endpoint's behavior. This is the foundation Phase 1 immediately
builds on (§34).

---

## 44. Evidence / References

| Claim | Source |
|---|---|
| No job-queue/worker infrastructure exists; `node-cron` is the only scheduler | `agent-backend/src/modules/cron/index.js`, `package.json` — read this session |
| Skill repository's existing `{_id, ownerId}` compound-filter pattern | `agent-backend/src/modules/skills/skill.repository.js` — read in full this session |
| Upload module: single-purpose, flat, unscoped, statically served | `agent-backend/src/modules/upload/upload.routes.js` — read in full this session |
| MCP service's complete method inventory | `agent-backend/src/modules/mcp/mcp.service.js` — method list extracted this session |
| All AD-01–AD-08 decisions cited inline throughout | `architecture/01–08-*.md` |
| Frontend dashboard/studio route split, `studio-routes.js` | `AGENTS.md` (previously established, not re-read this session) |

---

*This document is the implementation planning deliverable only. It creates no code, schemas,
routes, or UI. §43's recommended first PR is described but not implemented — per explicit
instruction, work stops here pending approval.*
