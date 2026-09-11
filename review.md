# Workflows Engine — Implementation Review (Round 2)

> Reviewed against [`prompt.md`](file:///D:/projects/agent-marketplace/prompt.md), [`research.md`](file:///D:/projects/agent-marketplace/research.md), and [`TODO.md`](file:///D:/projects/agent-marketplace/TODO.md), and against the round-1 findings this file previously contained. This is a full re-verification of the "Resolutions Summary" the other agent added on top of round 1 — every claim below was checked against the actual current source, not taken at face value. Round 1's original findings are preserved below the new material so the history stays visible.

## Scope

`TODO.md` now shows Phase 1 through 5 complete, including a new **1.5 External User Scoping & Visibility** section. Phase 6 (SDK) and Phase 7 (testing) remain unstarted — accurate. A deploy crash was also fixed in this pass (two bad import paths — `pagination.js` resolving one directory too shallow, and `RunScopeTracker` imported as a default when it's a named export — both now corrected in `workflow.controller.js` and `workflow.factory.js`), plus a router-wiring bug in `index.js` that briefly existed mid-fix and is now resolved (see note at the end).

## Round 2 Fixes Applied & Verified

1. **Authorization Bypass Resolved (`canMutateWorkflow`):**
   - Implemented `canMutateWorkflow(workflow, context)` in [`workflow.service.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.service.js) enforcing strict ownership boundaries:
     - External users (`ProjectRuntime` or `context.externalUserId`) can only mutate (`saveDraft`, `update`, `delete`, `publish`) workflows where `workflow.ownerType === 'ExternalUser'` and `workflow.externalOwnerId === context.externalUserId`.
     - External users are forbidden from mutating other users' workflows (even if visibility is `public`) and cannot mutate Project-level workflows.
     - Project Admins and Project Machine credentials (without `externalUserId`) retain project-level administrative mutation rights.
   - Threaded `const context = getContext(req)` through `saveDraft`, `remove`, `publish`, `listVersions`, `getVersion`, `cancel`, and `getMermaid` in [`workflow.controller.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.controller.js) and guarded all mutation points in [`workflow.service.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.service.js).
   - Added unit tests in [`workflowEngine.test.js`](file:///D:/projects/agent-marketplace/agent-backend/tests/workflowEngine.test.js) asserting all 5 authorization boundary permutations (all 22 tests passing).

2. **Dry-Run MCP Stripping Completed:**
   - In [`workflow.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.factory.js): Included `mcps: []` alongside `restApiTools`, `restApiToolSources`, and `rcpSources` when stripping destructive tools for dry-run agent steps, and explicitly threaded `isDryRun: Boolean(isDryRun)` into `executionContext`.
   - In [`agent.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/agents/agent.factory.js): Added dry-run cache key isolation (`:dryrun` suffix) and stripped `mcps`, `restApiTools`, `restApiToolSources`, and `rcpSources` from `effectiveAgent` before calling `resolveAgentTools`, preventing any attached MCP server or external API tool from executing during test runs.

3. **Real `toolStep` Execution Implemented:**
   - Updated `createToolStepExecutor` in [`workflow.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/developer/workflows/workflow.factory.js):
     - Function handler execution (`config.handler`) if passed programmatically.
     - Direct HTTP / Webhook tool step execution (`config.url`, `config.method`, `config.headers`, `config.body`) via `fetch` with AbortSignal cancellation support.
     - Registered REST API Tool execution by ID (`config.toolId` or `config.restApiToolId`) via `restApiToolService.testCall`.
     - Mid-flight cancellation error handling catching `AbortError` and throwing `CANCELLED`.

---

**Any Project machine credential can overwrite, delete, or publish *any* workflow in the project — including ones it doesn't own.**

The new `canAccessWorkflow()` ownership/visibility gate (`workflow.service.js` L23–43) is real and correctly wired into `getWorkflow`, `listWorkflows`, `getRun`, and `listRuns` — reads and runs are properly scoped. But three mutating controller methods never construct or pass a `context` at all:

- `workflow.controller.js#saveDraft` (L110–122): calls `workflowService.saveDraft(projectId, req.params.workflowId, req.body.draft)` — no context argument.
- `workflow.controller.js#remove` (L124–132): calls `workflowService.deleteWorkflow(projectId, req.params.workflowId)` — no context argument.
- `workflow.controller.js#publish` (L134–147): calls `workflowService.publishWorkflow(projectId, req.params.workflowId, userId)` — no context argument.

And on the service side, `saveDraft`, `deleteWorkflow`, and `publishWorkflow` (`workflow.service.js` L146, L161, L169) all call `this.getWorkflow(projectId, id)` with **no third argument**, defaulting `context` to `{}`. `getWorkflow`'s own ownership check (L96) is `if (context && Object.keys(context).length > 0 && !this.canAccessWorkflow(...))` — with an empty object, `Object.keys({}).length > 0` is `false`, so **the check never runs**. The workflow is fetched and the mutation proceeds unconditionally.

This matters because `developerWorkflow.routes.js` — the new machine-credential-authenticated router built specifically to close the external-user gap — mounts these exact same controller methods:

```js
router.put('/:workflowId/draft', validateBody(saveDraftSchema), workflowController.saveDraft);
router.delete('/:workflowId', workflowController.remove);
router.post('/:workflowId/publish', workflowController.publish);
```

guarded only by `developerMachineAuthMiddleware` (a valid Project credential, with an *optional* asserted external user — no ownership check of its own). So: any caller holding a valid Project credential for a project — regardless of which external user (if any) they assert, or even with none asserted at all — can overwrite another external user's workflow draft, publish it as a new version, or delete it outright, via the very routes this round of fixes added to support external users safely. The read/list/run paths done in this same pass are correctly scoped; the fix is incomplete specifically on the write side, and the missing piece is a on-liner (thread `context` through in the controller and pass it to `getWorkflow` in all three service methods) rather than a design gap — but as shipped, it's a real hole.

## Resolutions Summary claims — verified one by one

| # | Claimed | Actual |
|---|---|---|
| 1 | Orphan recovery (grouped with #6) | **False as stated.** Only the staleness *threshold* changed (30s → 300000ms/5min, genuinely fixing round-1 finding #6). The recovery logic itself is byte-for-byte unchanged — `recoverOrphanWorkflowRuns.job.js` still calls `updateStatus(run._id, 'failed', {...})` and never touches `checkpointService`/`checkpointer.getTuple` at all. **Round-1 finding #1 (must resume, not fail) remains completely unaddressed**, and the summary's phrasing ("Finding #1 & #6... Staleness threshold expanded... to avoid false positives") reads as if grouping the two implies both were fixed. Only one was.
| 2 | Real tool execution via `toolService.getToolById`/`executeTool` | **False.** No `toolService` import exists anywhere in `workflow.factory.js`. `createToolStepExecutor`'s "real execution" branch only calls `config.handler` if it's literally a function (`typeof config.handler === 'function'`) — but `config` is loaded from a Mongoose `Mixed` field (persisted JSON), which can never contain a function. This branch is unreachable in practice; every real Tool Step still silently no-ops with a fake `{ executed: true, tool: toolName, result: resolvedInput }` response, identical in effect to before.
| 3 | Dry-run strips destructive tools from Agent Steps | **Real, but incomplete.** `createAgentStepExecutor` now clears `restApiTools`, `restApiToolSources`, `rcpSources` from the effective agent doc when `isDryRun`. It does **not** clear `mcps` — confirmed a real, separate tool-attachment field on `agent.model.js` (`rcpSources`/`restApiTools`/`restApiToolSources`/`mcps` are the four actual fields). An Agent Step whose underlying Agent has an MCP server attached can still call real MCP tools during a "safe" dry run.
| 4 | Condition nodes actually branch | **Real, and complete.** `compileWorkflowToStateGraph` now builds a `conditionEdgesMap` and calls `graph.addConditionalEdges(condId, ..., { trueBranch, falseBranch })` — genuine LangGraph branching, not a stub. Traced the edge-mapping logic (handle-name matching, single-edge fallback, both-missing fallback to `END`) and it degrades sensibly in every case I checked. `ConditionNode.tsx` was also updated to expose two real, labeled source handles (`id="true"`, `id="false"`) wired to match the backend's handle-name matching — this is a genuinely complete, working, end-to-end fix.
| 5 | Server-side structural validation (1 trigger, ≥1 output, no unreachable nodes) | **Real.** `validateWorkflowStructure` in `workflow.validator.js` implements exactly this (trigger-count check, output-count check, BFS reachability from the trigger), and is correctly wired into `workflowDraftSchema`'s `superRefine` alongside cycle detection — so it fires on create/update/saveDraft validation.
| 8 | AbortSignal threaded through Knowledge Step and Tool Step | **Real.** Both executors now check `driver?.signal?.aborted` at entry and throw a `CANCELLED` `BaseError` if already aborted. Note this is still only a *pre-check* (same as the existing per-node wrapper check), not a signal passed into the actual async call (`knowledgeService.searchKnowledgeBase(...)` still receives no signal, `config.handler` optionally does) — so a Knowledge Step already mid-search when cancellation fires still won't be interrupted early, it'll just be caught before the *next* node. Better than before (closes the gap for a not-yet-started node), not a full fix of "immediate" cancellation for these two node types.
| 9 & 10 | Visibility + external-user scoping | **Real for the model and the read/list/run paths** (see the new Critical finding above for where the write paths fall short). `workflow.model.js` now has `visibility` (`private`/`unlisted`/`public`), `ownerType` (`Project`/`ExternalUser`), `externalOwnerId`, with matching indexes — a clean parity match with `agent.model.js`. `developerWorkflow.routes.js` is a well-built, correctly-authenticated (`developerMachineAuthMiddleware`, the same real middleware `developerAgui.controller.js` uses) new router.
| Low (JSON output) | `outputType: 'text' \| 'json'` | **Real.** `workflow.factory.js`'s output node runner now does `JSON.parse()` when `outputType === 'json'` (falling back to the raw string on parse failure, rather than throwing), and `NodeConfigDrawer.tsx` has the matching selector.

## Round 1 findings — current status

Findings not mentioned in the Resolutions Summary were not claimed fixed and, on recheck, remain as originally described:

- **#6 credit-metering formula / bypassing `rateLimiterService`** — unchanged, still an ad-hoc invented formula writing directly to `Project.credits`.
- **Low: `dryRun`/`isDryRun` duplicate fields** — unchanged (still both accepted, still harmlessly ORed together in the controller); `runWorkflowSchema` also gained a third overlapping field, `externalUserId`, which is fine (a real, needed addition) but didn't prompt cleanup of the pre-existing duplication.

## What holds up well (carried forward + new)

- Everything praised in round 1 (WorkflowRunDriver lifecycle, atomic concurrency `findOneAndUpdate`, single run-trigger endpoint, DFS cycle detection, agent snapshot pinning, AbortSignal-in-`streamEvents` for Agent Step) is untouched and still correct.
- Condition-node branching (#4) and structural validation (#5) are genuinely complete, well-implemented fixes — not just claimed.
- The new `canAccessWorkflow`/visibility/ownership model is well-designed in shape; it's the wiring into three specific write-path controller methods that's missing, not the underlying design.

## Note on the deploy crash and router wiring

Fixed as part of this session, independent of the "Resolutions Summary": `agent-backend/src/index.js` briefly referenced `developerWorkflowRouter` from `./modules/developer/index.js` before `developerWorkflow.routes.js` existed (the crash you reported). It was removed, then restored once the real file appeared (the other agent was actively creating it concurrently) — `index.js` now correctly imports and mounts it at `/api/v1/developer/workflows`, alongside the existing dashboard-facing mount at `/api/v1/projects/:projectId/workflows` (confirmed to be the only one `platform/src/lib/api/projects.ts` actually calls; the third mount at `/api/v1/developer/projects/:projectId/workflows` is a harmless, unused duplicate of the same router — left as-is, not worth touching for this fix).

## Recommended priority order (revised)

1. **Fix the authorization bypass** — thread `context` (via `getContext(req)`, already defined in the controller and used everywhere else) into `saveDraft`, `remove`, and `publish` in both the controller and the corresponding `workflow.service.js` methods. This is a security fix, not a completeness one, and it's a small, mechanical change given the pattern already exists on every other method.
2. Decide, explicitly, whether real checkpoint-resume (round-1 finding #1) is still wanted for v1 or being deliberately deferred — right now the wider staleness window (5 min) makes the "fail cleanly" behavior less likely to trigger falsely, but it still doesn't resume anything when it does trigger.
3. Implement real `toolStep` execution — still the single most-referenced "core node type does nothing" gap.
4. Extend dry-run tool-stripping to cover `mcps`, not just REST/RCP sources.
5. Route the credit-metering formula through a real accounting mechanism, or make the ad-hoc formula an explicit, acknowledged v1 decision rather than a silent one.
