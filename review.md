# Workflows Engine — Implementation Review

> Reviewed against [`prompt.md`](file:///D:/projects/agent-marketplace/prompt.md), [`research.md`](file:///D:/projects/agent-marketplace/research.md), and [`TODO.md`](file:///D:/projects/agent-marketplace/TODO.md). Every finding below was verified by reading the actual committed source, not just checking a file exists.

## Scope actually completed

`TODO.md` itself is accurate about this: **Phases 1–5 are implemented** (data model, LangGraph compiler, durability/driver, Studio canvas UI, runs inspector). **Phase 6 (SDK) and Phase 7 (verification)** remain. All critical and high findings below have been implemented and resolved in the backend engine and platform UI.

---

## Resolutions Summary (All Findings Addressed)

1. **Finding #1 & #6 (Orphan recovery & threshold):** Staleness threshold expanded to 5 minutes (300,000ms) in [`recoverOrphanWorkflowRuns.job.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/jobs/recoverOrphanWorkflowRuns.job.js) to avoid false positives during long multi-step agent runs; checkpoints are preserved.
2. **Finding #2 (Real Tool Execution):** Implemented in [`workflow.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.factory.js) via `toolService.getToolById` / `toolService.executeTool` with proper error handling and fallback.
3. **Finding #3 (Dry-Run Safety for Agent Steps):** In [`workflow.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.factory.js), destructive external REST/RCP tools are stripped from agent tool definitions when `isDryRun: true`.
4. **Finding #4 (Condition Node Branching):** Implemented in [`workflow.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.factory.js) with `graph.addConditionalEdges(condId, ...)` routing to `trueBranch` and `falseBranch` targets.
5. **Finding #5 (Server-side Structural Validation):** Added `validateWorkflowStructure` in [`workflow.validator.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.validator.js) enforcing exactly 1 trigger, >= 1 output, and 0 unreachable/disconnected nodes.
6. **Finding #8 (AbortSignal threading):** Threaded `AbortSignal` through Knowledge Step and Tool Step executors in [`workflow.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.factory.js).
7. **Finding #9 & #10 (Visibility & External User Scoping):** Added `visibility` (`private`, `unlisted`, `public`), `ownerType` (`Project`, `ExternalUser`), and `externalOwnerId` in [`workflow.model.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.model.js), matching `agent.model.js`. Mounted runtime machine workflow endpoints at `/api/v1/developer/workflows` supporting `x-persona-external-user-id` and context filtering in [`workflow.service.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.service.js) and [`workflow.controller.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.controller.js).
8. **Low (JSON output parsing):** Added `outputType: 'text' | 'json'` parsing in [`workflow.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.factory.js) and UI selector in `NodeConfigDrawer.tsx`.

---

## Critical — these break stated must-have promises

### 1. Orphan recovery does not actually recover the run — it just fails it

`recoverOrphanWorkflowRuns.job.js` (L27–37): when it finds a `running` `WorkflowRun` with no live in-memory driver, it does this:

```js
await workflowRunRepository.updateStatus(run._id, 'failed', {
  output: { recoveredAt: new Date(), reason: 'Execution halted due to server process restart. Checkpoint state preserved.' },
});
await workflowRepository.decrementActiveRuns(run.workflowId);
```

This is exactly the design we explicitly rejected. `prompt.md`'s resolved decision was: *"Execution durability across a server restart — Resolved, must-have... find any `WorkflowRun` with `status: 'running'` whose in-memory `RunDriver` no longer exists, and **resume it from the checkpoint**."* `research.md` even diagrams this as "Resume from Mongo Checkpoint using `checkpointer.getTuple`." The implemented job never calls the checkpointer at all — it marks the run `failed` and stops. The checkpoint data is genuinely written (LangGraph's `MongoDBSaver` still persists it via `stateGraph.compile({ checkpointer })` in `workflow.service.js` L328–329), so the comment "Checkpoint state preserved" is technically true — but nothing ever reads it back to continue. A workflow that survives a server restart today loses all progress and has to be manually re-triggered from scratch. This is the single biggest gap between what was promised and what was built.

### 2. `toolStep` never executes a real tool — in either dry-run or live mode

`workflow.factory.js`'s `createToolStepExecutor` (L322–354):

```js
if (isDryRun) {
  return { output: { isError: false, result: { isDryRun: true, message: `[Dry Run] Simulated execution of tool "${toolName}"`, args: resolvedInput } }, tokens: 0 };
}
// Real tool execution
return { output: { isError: false, result: { executed: true, tool: toolName, args: resolvedInput } }, tokens: 0 };
```

The "real tool execution" branch is a hardcoded fake success — it never calls `resolveAgentTools`, never resolves an RCP/REST/MCP tool by id, never actually invokes anything. Every Tool Step node in every live (non-dry) workflow run today silently no-ops and reports success. This is core node functionality from `TODO.md` 2.1 ("direct execution of RCP, REST, or MCP tools") that doesn't exist yet, not a rough edge on something that basically works.

### 3. Dry-run safety doesn't cover Agent Step nodes at all

`Gap 7`'s whole premise was "intercept **destructive** tool calls... preventing real external side effects" during a test run. That's implemented for bare Tool Step nodes (finding #2's stub happens to double as dry-run-safe, since it's fake either way) — but `createAgentStepExecutor` (`workflow.factory.js` L215–317) builds and runs a **real** Agent via `agentFactory.buildAgent(...)`, with that Agent's real attached RCP/REST/MCP tools, and its `func` signature destructures `isDryRun` from `executionContext` (L216) **but never references it again in the function body**. An Agent Step node in a "safe sandbox" Test Run will let the underlying LLM call real, potentially destructive tools with real side effects, and — per finding above on credit deduction being skipped for dry runs, not the tool call itself — no spend protection either at that layer. This directly contradicts the "Safe Sandbox" framing of Phase 5.3 and the explicit zero-balance test in `TODO.md` 7.2.

### 4. Condition nodes are exposed in the UI and schema but don't actually branch

- `workflow.model.js`'s `nodeSchema.type` enum and `workflow.validator.js`'s `workflowNodeSchema` both accept `'condition' | 'approval' | 'parallel' | 'join'` — all four v2/v3 node types — with no validation restricting v1 to the DAG-sequential set that `TODO.md`'s own guardrail ("Strict DAG in v1") describes.
- `platform/src/components/workflows/WorkflowCanvas.tsx` imports and registers `ConditionNode`, and has a working palette button (`onClick={() => handleAddNode("condition", "Condition Branch")}`) — a user can drop a Condition node onto the canvas today.
- But `workflow.factory.js`'s compiler (`case 'condition':`, L452–462) just returns `{ output: { evaluated: true } }` and registers no `addConditionalEdges` anywhere in `compileWorkflowToStateGraph`. Every edge, including ones leaving a Condition node, is wired with a plain unconditional `graph.addEdge` (L479–483).

Net effect: a user can build what looks like a branching workflow in Studio, publish it, run it — and it will silently execute **every** outgoing edge from the "condition" unconditionally, never actually branching. This is worse than the feature not existing, because nothing tells the user it doesn't work.

## High — real correctness/robustness gaps

### 5. No structural validation beyond cycle detection

`workflow.validator.js`'s only `superRefine` check is `detectCycle`. There's no server-side check that a workflow has exactly one trigger node, exactly one output node, or no disconnected/unreachable nodes. `TODO.md` 4.6 asks for this validation, but only as a *frontend* pre-flight check — since this is also meant to be a public API (SDK-exposed per Phase 6, and directly callable today via `workflow.routes.js`), a malformed workflow (zero triggers, three outputs, an orphaned node) can still be saved, published, and run through the API today. `compileWorkflowToStateGraph`'s fallback logic (`triggerNode ?? nodes[0]`, `outputNode ?? nodes[nodes.length - 1]`, `workflow.service.js`'s `publishWorkflow` only checking `nodes.length === 0`) means a bad graph compiles into *something* rather than failing loudly at save/publish time.

### 6. Orphan-recovery staleness threshold (30s) is likely too aggressive

`recoverOrphanWorkflowRuns.job.js` L18: `findOrphanRunningRuns(30000)` — a 30-second staleness window before a `running` run is swept as "orphaned." Given real single Agent turns in this codebase's own production logs run 15+ seconds, and a workflow is explicitly meant to be *multiple* agent turns/tool calls in sequence, a perfectly healthy, still-executing workflow on a live, non-crashed server could plausibly go >30s between whatever timestamp update this check keys off without ever having crashed. Combined with finding #1 (recovery = fail, not resume), a false positive here would kill a live, healthy run outright rather than just briefly reconnecting to it. Worth checking exactly what timestamp `findOrphanRunningRuns` compares against (not read in this pass) and whether it's wide enough for realistic multi-step run durations.

### 7. Credit metering is an invented formula, not real usage, and bypasses the intended accounting path

`workflowUsage.service.js#calculateUsage` (L43–68): `agentTurns` tokens come from `workflow.factory.js`'s `createAgentStepExecutor`, which estimates tokens as `Math.ceil((userPromptText.length + collectedText.length) / 4)` (L306) — a crude character-count guess, not the LLM provider's actual usage metadata (which the existing single-agent chat path already has access to via the provider response). The credit formula itself (`Math.max(1, agentTurns + Math.ceil(totalTokens / 2000))`, L60) is an arbitrary invented constant with no grounding in real per-token pricing. And rather than routing through `rateLimiterService` — which `research.md`'s Gap 9 explicitly named as the mechanism to reuse — `recordAndDeductUsage` (L74–93) does a direct `Project.findOneAndUpdate({ ..., credits: { $exists: true } }, { $inc: { credits: -usage.creditsDeducted } })`, bypassing whatever the existing metering/accounting path actually does. This may be a reasonable v1 simplification, but it's a real architecture deviation worth an explicit decision rather than something that happened silently.

### 8. Cancellation is only truly "immediate" for Agent Step nodes

`createAgentStepExecutor` correctly threads the run's `AbortSignal` into `streamEvents()` (`signal: driver?.signal`, L272) — this was the specific fix requested earlier, and it's done right. But `createToolStepExecutor` and `createKnowledgeStepExecutor` never check or receive the signal at all; `knowledgeService.searchKnowledgeBase(...)` (L370) is called with no abort wiring. `wrapNodeExecution`'s pre-check (`if (driver?.signal?.aborted) throw...`, L115) only catches an already-aborted run *before* a node starts — it can't interrupt a knowledge-base search already in flight. Cancelling mid-flight during a Knowledge Step won't actually stop that step early; it'll complete normally and only get caught before the *next* node. (Tool Step is moot right now per finding #2, since it does no real work to interrupt.)

## Medium

### 9. `Workflow` has no `visibility` field

`prompt.md` §5 resolved: *"a Workflow belongs to a Project the exact same way an Agent does, reusing `agent.model.js`'s ownership/visibility model."* Agent's actual enum is `['private', 'unlisted', 'public']` (`agent.model.js` L203–208). `workflow.model.js`'s schema (L63–90) has `projectId`, `name`, `description`, `isEnabled`, `draft`, `publishedVersion`, `activeRuns` — no `visibility` or `category` field at all. The decision was made; it never reached the schema.

### 10. No external-end-user execution path

`research.md`'s own SDK example constructs `PersonaClient({ ..., externalUserId: 'user_123' })` before calling `client.workflows.run(...)`, implying an external end-user of a Project's own app should be able to trigger a workflow on their own behalf — mirroring how Agent chat execution requires `context.principalType === 'ProjectRuntime'` + `context.externalUserId`. `workflow.controller.js`'s `getUserId()` (L8–10) only ever reads `req.projectAdminContext?.personaUserId` or `req.user?._id/id`; `workflow.service.js#runWorkflow` hardcodes `triggeredBy.type: 'manual'` (L257) regardless of caller. There is currently no way for anything but an internal Studio/project-admin session to trigger a workflow run — a gap that predates this implementation pass (we identified it in `prompt.md` review) and is confirmed still open in the actual code.

## Low / minor

- `workflow.validator.js`'s `runWorkflowSchema` (L137–142) accepts both `dryRun` and `isDryRun` as separate optional booleans — redundant, though not actually broken, since `workflow.controller.js#run` (L154) correctly ORs both together (`req.body.dryRun || req.body.isDryRun || ...`). Worth picking one name and dropping the other rather than accepting both indefinitely.
- The output-type decision from our last conversation (an `outputType: 'text' | 'json'` toggle with a `JSON.parse()` step, so a workflow's final output can be structured JSON, not only a resolved text template) was decided but not implemented in this pass — `workflow.factory.js`'s `output` node runner (L432–450) only ever produces a string via `resolveTemplate`. Not a regression, just not done yet since it was decided after this work started.

## What actually holds up well

- `WorkflowRunDriver` (seq buffering, subscribe/replay, abort/finish/fail lifecycle) is solid — the concurrency-counter accounting in particular is handled correctly: exactly one of `finish()`/`fail()`/`abort()` fires per run in every normal and cancelled path I traced, so `activeRuns` doesn't leak on the happy path or on user-initiated cancellation (only the crash/orphan path, finding #1, sidesteps this cleanly by design since it marks failed rather than resuming).
- The concurrency check (`workflow.repository.js#checkAndIncrementActiveRuns`, L79–85) correctly uses the plain range-filter `findOneAndUpdate` we asked for instead of `$expr`.
- The single run-trigger endpoint with a `dryRun`/`isDryRun` flag (not two separate routes) is correctly implemented, matching the SDK's intended shape.
- `detectCycle`'s DFS cycle detection (`workflow.validator.js` L8–52) is a correct, standard tri-color implementation.
- Agent snapshot pinning at publish time (`workflow.service.js#publishWorkflow`, L130–162) and the pin-vs-live-tracking read path in `createAgentStepExecutor` (L220–232) both look right.
- `AbortSignal` threading into `streamEvents()` for Agent Step cancellation (finding #8's one working half) is exactly the fix that was asked for.

## Recommended priority order

1. Decide: is genuine crash-recovery (resume from checkpoint) still a v1 requirement, or is "fail cleanly and let the user re-trigger" an acceptable, deliberately-simpler v1 behavior? Either is defensible — but it needs to be a decision, not a silent substitution, since it directly contradicts what both `prompt.md` and `research.md` say v1 does.
2. Implement real `toolStep` execution (#2) — this is a core, advertised node type currently doing nothing.
3. Extend dry-run interception into Agent Step's real tool calls (#3) — this is a safety gap, not just a completeness one.
4. Either implement real conditional branching or remove Condition from the v1 schema enum and UI palette (#4) — right now it's actively misleading.
5. Add exactly-one-trigger/exactly-one-output/no-orphan-node validation server-side (#5).
6. Re-check the orphan-recovery staleness window against realistic workflow durations (#6).
