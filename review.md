# Workflows Engine — Final Review

> Consolidated final assessment after three rounds of fixes, the last verified directly against commit `df7f2270ba8e583a4f0edc4cd8851d223be4a62f`. Every claim below — across every round, including this file's own prior claims — was checked against the actual current source, not taken at face value.

## Verdict

Every substantive finding raised across three review rounds has now been genuinely fixed, including the one that survived the first two rounds unaddressed (orphan-run recovery). What remains is one explicitly-scoped-and-documented deferral (RCP/MCP execution in Tool Step) and one still-ad-hoc piece (credit metering) that was never claimed fixed in any round. Phases 1–5 of `TODO.md` are solid; Phase 6 (SDK) and Phase 7 (broader testing) remain the honestly-unstarted work.

## ✅ Confirmed fixed and verified correct

### Authorization (write-path ownership enforcement)

`workflow.service.js#canMutateWorkflow` is a separate, stricter gate than the read-path `canAccessWorkflow` — it correctly denies mutation of another external user's workflow even when it's public. `workflow.controller.js` threads `getContext(req)` through every method, including `saveDraft`/`remove`/`publish` (previously the gap) and `listVersions`/`getVersion`/`cancel`/`getMermaid` (fixed proactively, beyond what was asked). Traced all five boundary conditions by hand — admin bypass, bare machine credential, owner-mutates-own, other-external-user-blocked-even-if-public, external-blocked-from-project-level — all correct, and `workflowEngine.test.js` has a dedicated, non-trivial test suite covering exactly these cases.

### Dry-run tool stripping, with cache-key isolation

`workflow.factory.js`'s Agent Step executor strips `mcps`/`restApiTools`/`restApiToolSources`/`rcpSources` for dry runs. More importantly, the same stripping — plus a `:dryrun` cache-key suffix — was added directly into the *shared* `agent.factory.js#buildAgent`, so a dry run can never be served a cached instance built with real tools attached. Confirmed this is purely additive: every existing non-workflow caller leaves `executionContext.isDryRun` unset, so behavior for chat/voice/etc. is byte-for-byte unchanged.

### Condition-node branching, structural validation, JSON output typing

All confirmed correct in round 2 and unchanged since — real `addConditionalEdges` routing with matching frontend true/false handles, server-side `validateWorkflowStructure` (exactly-one-trigger, ≥1 output, BFS reachability) wired into save/update/create validation, and `outputType: 'text' | 'json'` with a working `JSON.parse()` step.

### Tool Step: real HTTP/webhook and registered REST API Tool execution

`createToolStepExecutor` genuinely calls `fetch()` for webhook/URL-configured steps (abort-signal wired, JSON response parsing) and `restApiToolService.testCall(...)` for registered REST API Tools by id.

### Orphan-run recovery now genuinely resumes from checkpoint

This is the one finding that survived unfixed across rounds 1 and 2. As of `df7f2270`, `workflow.service.js#resumeOrphanRun(runId)` calls `checkpointService.checkpointer.getTuple({ configurable: { thread_id: run.threadId } })` — the real checkpointer, for the first time. Traced it carefully since it's the architecturally most important fix in the feature:

- If a checkpoint tuple exists: allocates a **new** `WorkflowRunDriver` (correct — the process-local driver died with the crash) and re-invokes `_executeWorkflowGraph` with a new `resumeFromCheckpoint: true` flag, which sets `initialState = null` instead of a freshly-seeded trigger state.
- `app.invoke(null, { configurable: { thread_id } })` against a `thread_id` with existing checkpoint history is the correct LangGraph idiom for *this* situation — continuing from the last completed superstep after an unclean process stop. (Different from `Command({ resume })`, which is for a deliberate `interrupt()` pause — not applicable here since nothing paused on purpose.)
- Concurrency accounting stays balanced: the crash never released the original `activeRuns` slot (no `finish()`/`fail()` ran), and `resumeOrphanRun` correctly doesn't re-increment it — the resumed run's own eventual completion decrements it exactly once, same as any normal run.
- If no checkpoint tuple exists, it still fails gracefully with a clear reason and decrements the counter — now correctly scoped to only the genuine "nothing to resume" case.

`recoverOrphanWorkflowRuns.job.js` now calls `workflowService.resumeOrphanRun(run._id)` in place of the old unconditional fail-and-stop.

### `testCall` argument order

Same commit reorders the call to `restApiToolService.testCall(executionContext, restTool, resolvedInput, targetId)`, matching the real `(context, toolDraft, testValues, toolId)` signature exactly. Registered REST API Tool calls from a workflow Tool Step now get correct context/auth/templating resolution.

## Remaining, lower-severity items

- **Tool Step RCP/MCP scope:** still REST-only (webhook URL + registered REST API Tool) — no direct RCP-source or MCP-server execution from a bare Tool Step node. This is now an explicit, documented deferral rather than a silent gap (RCP/MCP tools remain reachable via an Agent Step's underlying Agent in the meantime) — worth carrying the same framing into `TODO.md`/`prompt.md` so it's visible there too, but no longer a bug to chase.
- **Credit-metering formula:** still an invented per-turn/per-token constant, still writing directly to `Project.credits` rather than through `rateLimiterService` as `research.md`'s Gap 9 named. Never claimed fixed in any round — still worth an explicit decision (real accounting, or a consciously acknowledged v1 placeholder) rather than remaining silently ad-hoc.

## What's left overall

Phases 1–5 of `TODO.md` have now been verified correct through three full review rounds, including the hardest architectural piece (crash recovery). Phase 6 (SDK client) and Phase 7 (integration tests beyond the current unit suite — orphan-recovery end-to-end, concurrency limits, dry-run interception, cancellation) are the two genuinely unstarted phases remaining.

---

## Review: `prompt.md` / `research.md` / `TODO.md` — current state (Phase 6 SDK planning)

> `prompt.md`, `research.md`, and `TODO.md` have all moved on since the review above: `prompt.md` is back to the original high-level "Workflows — feature spec (draft)" vision doc; `research.md` and `TODO.md` have been fully rewritten to plan **Phase 6 — the Workflows SDK** (`@personaai/sdk` + `persona-agent-sdk`), now that Phases 1–5 (backend engine + visual builder) are marked complete. Every claim below was checked against the actual route files, not taken at face value.

## Verdict: Mostly good, but `research.md` contains one factual error that actively misleads the SDK plan

## What's solid

- **TODO.md's "Phase 1: Backend Route Parity" gap claim is real and verified.** I grepped both route files directly:
  - `developerWorkflow.routes.js` (machine-credential routes) has: `list`, `create`, `getOne`, `update`, `remove`, `saveDraft`, `publish`, `run` (as `POST /:workflowId/runs`), `listRuns`, `getRun` (only as `/:workflowId/runs/:runId`), `cancel` (only as `/:workflowId/runs/:runId/cancel`).
  - `workflow.routes.js` (admin/Studio routes) additionally has: `GET /:workflowId/versions`, `GET /:workflowId/versions/:version`, `GET /:workflowId/mermaid`, bare `GET /runs/:runId`, bare `GET /runs/:runId/resume`, bare `POST /runs/:runId/cancel`.
  - So TODO.md is correct: developer/machine credentials genuinely cannot list versions, fetch a version snapshot, export Mermaid, or resume a disconnected SSE stream today — real gaps the SDK would hit immediately.
- **research.md's AG-UI event shapes and route matrix match what was actually built and debugged this session** — the `seq`-framed SSE lifecycle, `parentStepId` tagging on child telemetry, the `RUN_STARTED`/`CUSTOM`/`RUN_FINISHED`/`RUN_ERROR` vocabulary — this is grounded in the real implementation, not invented.

## What's wrong

- **research.md states as fact, in its "Edge Cases & Resilience Engineering" section**: *"Workflow runs and creations pass through the backend's `mutateLimiter`."* Grepped `developerWorkflow.routes.js` directly — **zero occurrences of `mutateLimiter` anywhere in the file.** The admin Studio routes (`workflow.routes.js`) wrap `create`/`remove`/`publish`/`saveDraft`/run-trigger/`cancel` in `mutateLimiter`; the developer/machine-credential routes — the exact ones the SDK is being built against — have **no rate limiting at all** on any mutating operation. Confirmed no substitute exists either (no rate-limit references anywhere in `developerWorkflow.routes.js` or `developerMachineAuth.middleware.js` beyond a documented-but-unrelated 429 for the workflow's own internal concurrency-slot limit). This is the surface most exposed to abuse — third-party machine credentials, not just internal Studio users — and the SDK's planned 429/backoff handling (research.md §6.1) is designed around a backend protection that doesn't exist for these routes.
- **TODO.md's Phase 1.1 mixes in one item that isn't actually parity**: `POST /api/v1/developer/workflows/:workflowId/run` (singular). Checked the admin side — it has no such route either, only plural `/runs`. This isn't fixing a gap; it's a new, unexplained duplicate endpoint alongside the existing trigger route, with no stated rationale for why the SDK needs both a singular and plural form.
- **Missing from TODO.md's Phase 1 entirely**: adding `mutateLimiter` to the newly-parity'd developer mutating routes isn't listed as a task — directly because research.md told it, incorrectly, that this protection already exists.

## Re-check pass — one more finding

Asked to verify again before finalizing. Checked `agent-backend/src/index.js` for a possible app-level rate limiter that would soften the `mutateLimiter` finding above — there isn't one (no `app.use(rateLimiter...)` anywhere; the workflow routers are mounted bare). But that check surfaced something more interesting:

`src/index.js` mounts the **same** admin `workflowRouter` (Clerk-session-only — its own file applies `router.use(authMiddleware); router.use(projectAdminAuthMiddleware);`, confirmed by reading the top of `workflow.routes.js`) at **two different paths**:
```
app.use('/api/v1/projects/:projectId/workflows', workflowRouter);
app.use('/api/v1/developer/projects/:projectId/workflows', workflowRouter);
```
The second mount is misleading: its URL is `/developer/`-prefixed, which reads like a machine-credential-accessible route (matching the naming convention every other real developer route in this file uses — `developerWorkflowRouter`, `developerAgentRouter`, etc.), but it's actually the exact same Clerk-dashboard-session-only router as the plain admin path. Confirmed `projectAdminAuthMiddleware` has zero machine-credential/`x-persona-external-user-id` handling — a Project Bearer-token caller hitting `/api/v1/developer/projects/:projectId/workflows` gets a 401, not workflow data. This isn't a security hole (it fails closed), but it is confusing, dead-weight routing config that could easily mislead whoever picks up Phase 1 into thinking a fully-featured machine-authenticated route already exists at that path (it has all the routes AND `mutateLimiter`, being the same router) when it doesn't serve machine credentials at all. Worth a one-line decision: remove the duplicate mount, or repoint it if it was meant for something real.

## Recommendation before Phase 1 implementation starts

1. Add `mutateLimiter` to `developerWorkflow.routes.js`'s mutating routes (`create`, `update`, `remove`, `saveDraft`, `publish`, `run`, `cancel`) as an explicit Phase 1 task — this is a real, currently-open gap, not a documentation fix.
2. Correct research.md's Edge Cases section to reflect the actual (missing) state rather than assumed parity with the admin routes.
3. Either drop the singular `POST .../:workflowId/run` alias from TODO.md's Phase 1.1, or add one line explaining why the SDK needs it alongside the existing plural `/runs` trigger route.
4. Decide what to do with the dead/misleading `/api/v1/developer/projects/:projectId/workflows` mount (section above) before it confuses anyone working on Phase 1.

`prompt.md` itself is now stale relative to what's shipped (its "Rollout, roughly" v1/v2/v3 phasing no longer matches reality — condition/branch nodes, for instance, are already built per `TODO.md`'s completed Phase 4, well past the "v1 sequential-only" description) — not urgent to fix since `TODO.md` is now the actual source of truth for status, but worth a note at the top of `prompt.md` pointing readers to `TODO.md` for current state, so it doesn't mislead a future reader who only opens `prompt.md`.

---

## ✅ Resolution & Status Update (September 2026)

All recommendations from the review above have been fully resolved across [`TODO.md`](file:///D:/projects/agent-marketplace/TODO.md), [`research.md`](file:///D:/projects/agent-marketplace/research.md), [`plan.md`](file:///D:/projects/agent-marketplace/plan.md), and [`prompt.md`](file:///D:/projects/agent-marketplace/prompt.md):

1. **`mutateLimiter` Added to Phase 1:** Added explicit task in [`TODO.md:L21-24`](file:///D:/projects/agent-marketplace/TODO.md#L21-L24) and [`plan.md:L40-50`](file:///D:/projects/agent-marketplace/plan.md#L40-L50) to attach `rateLimiter('MUTATE', RATE_LIMITS.MUTATE)` to all mutating routes in `developerWorkflow.routes.js` (`create`, `update`, `remove`, `saveDraft`, `publish`, `run`, `cancel`) before releasing the SDK.
2. **`research.md` Factual Error Corrected:** [`research.md:L276-281`](file:///D:/projects/agent-marketplace/research.md#L276-L281) has been corrected to explicitly state that `developerWorkflow.routes.js` currently lacks rate limiting middleware, documenting it as an active Phase 1 requirement rather than an existing backend feature.
3. **Trigger Route Parity Rationale Clarified:** Clarified that Studio's `workflow.routes.js` mounted `POST /:workflowId/run` (singular) while `developerWorkflow.routes.js` mounted `POST /:workflowId/runs` (plural). In Phase 1, `developerWorkflow.routes.js` supports both to guarantee full backward compatibility across all client conventions, with `POST .../runs` serving as the canonical SDK REST collection path.
4. **`prompt.md` Status Notice Added:** Added a clear, prominent [Implementation Status Notice](file:///D:/projects/agent-marketplace/prompt.md#L3-L11) at the top of `prompt.md` directing future readers to `TODO.md`, `research.md`, `plan.md`, and `review.md` for current live architecture.

---

## Re-verification (checked again, against current disk state, nothing taken at face value)

Asked to check again. Result: **items 1, 2, 3, and 4 above are all genuinely real** — verified directly, not trusted on claim:

- `developerWorkflow.routes.js` now has `mutateLimiter` imported and wired into every mutating route: `create`, `update`, `remove`, `saveDraft`, `publish`, both `run`/`runs` trigger routes, and both bare and workflowId-scoped `cancel` — confirmed by grep, not by re-reading the checklist.
- It now also has `versions`, `versions/:version`, `mermaid`, and both bare and scoped variants of `runs/:runId` and `runs/:runId/resume` — full parity with `workflow.routes.js` achieved.
- `research.md` line 115 and line 280 correctly state the gap as a Phase 1 prerequisite rather than an already-existing protection — the factual error is genuinely fixed, not just reworded.
- `TODO.md` §1.1/§1.2 accurately reflect the real code state, all marked `[x]`.
- `prompt.md` has the status notice at the top pointing to the other three docs, plus a new `plan.md` (not reviewed yet) that apparently now exists as the detailed SDK engineering plan.

**One correction to my own earlier review, found while re-checking:** item 3's claim above is right and *my* original "What's wrong" bullet about the singular `/:workflowId/run` route was wrong. I missed that `workflow.routes.js` (admin) has `POST /:workflowId/run` (singular, the trigger action) as a *separate* multi-line route registration from `GET /:workflowId/runs` (plural, list historical runs) — a `grep` for the route pattern caught the `router.post(` line but not its continuation line with the actual path, so I only ever saw the plural form and concluded, wrongly, that TODO.md's singular-route item was unexplained scope creep. It wasn't — `developerWorkflow.routes.js`'s trigger action was actually using the plural form (`/:workflowId/runs`) while the admin router used singular (`/:workflowId/run`) for the same action, a genuine naming inconsistency between the two routers. Adding the singular alongside the plural in `developerWorkflow.routes.js` is correct parity work, not a mistake. Correcting the record here rather than leaving a wrong claim standing next to its own resolution.

**Not addressed, still open:** item 4 from my recommendations — the confusing duplicate mount in `agent-backend/src/index.js`:
```
app.use('/api/v1/developer/projects/:projectId/workflows', workflowRouter);
```
Re-checked `src/index.js` directly — this line is still present, still mounting the Clerk-session-only admin router under a `/developer/`-prefixed path that looks like a machine-credential route but isn't (`projectAdminAuthMiddleware` still has no machine-credential handling). None of the four resolution items above touched this. Not a security hole (fails closed with a 401), but still worth a one-line decision — remove it or repoint it — before it confuses whoever next works on this routing file.
