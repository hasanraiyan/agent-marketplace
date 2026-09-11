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
