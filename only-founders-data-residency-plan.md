# Data residency follow-up — internal scoping plan

**Context:** OnlyFounders reframed REQ-6 (bulk thread import) from "help us
migrate cleanly" into something bigger: Agent Marketplace should be the
**permanent system of record** for all agent-related data (threads,
memory, skills) across every consumer product (OnlyFounders first,
BeyondCampus next), not a place they occasionally sync into. Dual-run is
explicitly off the table. Two new asks came with that: bulk/read export,
and subject (external user) data deletion. This doc scopes both before we
respond.

Investigated against the actual codebase (not the architecture docs alone)
— findings below are file-referenced.

---

## Why this is more tractable than it sounds

Every developer-platform resource — threads, skills, memory namespaces —
is already scoped by the same `ProjectRuntimeContext` shape:
`{ domain, externalUserId }`, composed as `identityKey =
${domain}:${externalUserId}` (`agent.factory.js:234-237`) and reused
identically in `thread.service.js`'s `subjectFilterForContext` and in
memory namespace roots. That consistency is the reason both new asks are
"wire existing primitives to a new caller," not "redesign storage."

We also already have a whole-Project deletion cascade
(`jobs/cleanupDeletedProject.job.js:40-105`) that touches every one of
these collections correctly, scoped by `domain`. What's missing is the
one-level-narrower case: a single `externalUserId` *within* a Project that
stays active.

---

## Workstream 1: Bulk/read export

| Need | Status | Gap |
|---|---|---|
| List all threads for a user | **Exists**, production-ready | None — `GET /api/v1/developer/threads`, paginated (`developerThread.routes.js:84`) |
| Bulk message bodies across threads | Missing | No multi-thread checkpoint read exists; `checkpoint.service.js:75-94` is one-thread-at-a-time. New endpoint needed: fan out `getMessages` per thread, or query `checkpoints`/`checkpoint_writes` directly by `thread_id: {$in: [...]}` (same query shape `cleanupThreads` already uses, `checkpoint.service.js:56-59`) |
| Memory export across a user | Storage-layer primitive already generalizes (`memory.service.js:49-82` `getAllMemory`) | No developer route exists at all — `memory.routes.js` is Clerk-only; needs a `developer/memory` controller (same gap already identified for REQ-3) |
| Skills export | Model already supports it (`ownerType:'ExternalUser'`, `externalOwnerId` — `skill.model.js:25-44`) | `skill.repository.js` has no `findByExternalOwner`; `search()` is generic enough to take the right filter, just needs a route |

**Sizing:** moderate. Nothing requires new storage capability. REQ-3
(developer memory API) and this export work overlap — building REQ-3's
single-file read naturally produces the primitive a bulk memory export
endpoint would reuse. Worth sequencing REQ-3 first and building export as
an extension of it, not a parallel effort.

---

## Workstream 2: Subject data deletion

| Collection | Cascade primitive exists? | What's missing |
|---|---|---|
| Threads + checkpoints | **Yes, fully generalized** — `threadRepository.deleteAllBySubject` + `checkpointService.cleanupThreads` (`thread.repository.js:66-85`, `checkpoint.service.js:43-68`) | No caller for the ExternalUser case today (only called for Persona-user delete and whole-Project cleanup) — wiring, not building |
| Memory (`memoryfiles`) | **Yes, generalized** — `memory.service.js:117-144` `clearAllMemory` deletes by namespace root, same `identityKey` shape | No caller for ExternalUser scope |
| Legacy agent memory (`agent_memories` / `MongoDBStore`) | Partial — delete-by-key exists via `batch()`, not delete-by-user | Needs a small externalUserId-scoped query, mirrors existing agentIds-based branch |
| Skills | Model supports the scoping fields | `skill.repository.js` needs one new method: `deleteManyByExternalOwner(domain, externalOwnerId)` — mirrors `deleteManyByOwner`/`deleteManyByDomain`, which already exist |
| ExternalUser record (PII: `displayName`, `email`, `avatarUrl`) | No | `externalUser.repository.js` needs `deleteOneByProjectAndExternalUserId` — mirrors existing `deleteAllByProject` |
| Audit logs | N/A — no per-ExternalUser audit trail exists at all (confirmed: `developerAuditLog.controller.js` explicitly returns empty for ProjectRuntime callers) | Nothing to do |

**Sizing:** small-to-moderate. Four of six rows are "add a caller to an
existing, already-correctly-scoped primitive." Two rows need one new
repository method each, each mirroring a sibling method that already
exists. No storage redesign.

**The actual open question isn't "can we delete it" — it's "how do we
know to."** There is currently no channel for a Project (OnlyFounders) to
tell Persona "externalUserId X should be purged." The Clerk `user.deleted`
webhook only fires for our own dashboard users, not for external subjects
a Project asserts via `x-persona-external-user-id`. This is a known,
previously-flagged gap in our own identity architecture docs (AD-02 §11.4,
AD-04 §deletion) — deliberately deferred, not an oversight, but it's the
actual design work here, not the deletion mechanics themselves. Two shapes
to propose on the call:
- **Pull**: OnlyFounders calls a new `DELETE
  /api/v1/developer/subjects/:externalUserId` when their own user is
  deleted.
- **Push**: they register a webhook that we'd call... except we don't
  have outbound webhook infra yet either (same gap flagged in the REQ-7/8
  response). Pull is clearly cheaper given where we are today — recommend
  proposing pull-only for v1.

---

## How this reshapes REQ-6

Dual-run being off the table actually *lowers* the bar on the original
REQ-6 ask, not raises it: if OnlyFounders isn't keeping their old runtime
alive in parallel, they don't need imported threads to be resumable mid-
migration under load from two systems — they need a one-time cutover
where founders don't lose access to what was already said. That's much
closer to "read-only history import" (Direction 1 from our last reply)
than "full checkpoint resumability" (Direction 2). Worth confirming this
explicitly on the call rather than assuming.

---

## Proposed call agenda

1. Confirm REQ-6 can shrink to read-only import given dual-run is off the
   table (saves us the checkpoint-synthesis risk we flagged).
2. Bulk export — sequence as an extension of REQ-3, not standalone.
3. Subject deletion — mechanics are mostly wiring; the real decision is
   pull vs. push for the deletion signal. Propose pull (`DELETE
   /api/v1/developer/subjects/:externalUserId`) for v1.
4. Name this explicitly as a data-residency commitment, not just an API
   surface — worth being honest that "permanent system of record for
   every consumer product" is a bigger platform commitment than the
   original doc's per-endpoint framing, even though the incremental
   engineering lift on each piece is smaller than it sounds.
