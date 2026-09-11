# Workflows Engine — Final Review

> Consolidated final assessment after three rounds of fixes. Every claim below — including the other agent's own "Round 2 Fixes Applied & Verified" note — was checked against the current committed source. Full round-by-round history (round 1's original findings, round 2's "Resolutions Summary" table) is preserved in git history of this file if needed; this version is the authoritative current state.

## Verdict

The authorization work is now genuinely solid — the most important fix of the last two rounds landed correctly. The tool-execution and dry-run-safety work made real, substantial progress and is far more honest than it was, but has one concrete bug and one real scope gap left. The one thing that has **never actually been fixed across any round** is orphan-run recovery, which still contradicts what `prompt.md`/`research.md` both call a v1 must-have.

## ✅ Confirmed fixed, verified correct

### Authorization bypass (was the headline finding last round) — fully resolved

`workflow.service.js` now has a separate, stricter `canMutateWorkflow(workflow, context)` (distinct from the read-path `canAccessWorkflow`) that correctly denies mutation of another external user's workflow **even if it's public** — read-access and write-access are properly different bars. `workflow.controller.js` now calls `getContext(req)` and threads it through *every* method, including the four that previously skipped it (`saveDraft`, `remove`, `publish`, and — bonus — `listVersions`/`getVersion`/`cancel`/`getMermaid` too, which round 1 hadn't even flagged as missing it). Traced all five real boundary conditions by hand (admin bypass, bare machine credential, owner-mutates-own, other-external-user-blocked-even-if-public, external-blocked-from-project-level) and they're all correct. `workflowEngine.test.js` now has a dedicated `Workflow Ownership & Write Authorization Enforcement` suite exercising exactly these five cases with real, non-trivial assertions — not padding. This is a clean, complete fix.

### Dry-run tool stripping, including cache-key isolation — fixed carefully and correctly

`workflow.factory.js`'s `createAgentStepExecutor` now strips `mcps` alongside `restApiTools`/`restApiToolSources`/`rcpSources` (closing the MCP gap from last round). More importantly, the same stripping — and a `:dryrun` cache-key suffix — was added directly into the **shared** `agent.factory.js#buildAgent` (L619–659), not just at the workflow call site. That cache-key isolation matters: without it, a dry-run call could have received a *cached, already-built* agent instance from an earlier real run of the same agent/identity, with its real tools still attached, silently defeating the stripping done at the call site. I checked this doesn't touch any normal (non-workflow) caller: `executionContext?.isDryRun` is `undefined` for every existing caller (chat, voice, etc.), so `dryRunSuffix` is always `''` and `effectiveAgent` always equals the original `agent` for them — this is a purely additive, opt-in change with no regression risk to the rest of the system. Genuinely careful work.

### Condition-node branching, structural validation, output-type JSON parsing (carried from round 2)

All still correct on recheck — no changes needed.

## ⚠️ Real progress, but not fully done

### `toolStep` execution: mostly real now, one concrete bug, one real scope gap

`createToolStepExecutor` now has three real paths instead of zero: a raw HTTP/webhook call via `fetch` (with abort-signal support, JSON parsing) — **this one is correct** — and a "registered REST API Tool by ID" path via `restApiToolService.testCall(...)`.

**The registered-tool path has a genuine argument-order bug.** `restApiTool.service.js`'s real signature is:

```js
async testCall(context, toolDraft, testValues = {}, toolId = null)
```

`workflow.factory.js` calls it as:

```js
await restApiToolService.testCall(targetId, restTool, resolvedInputObj, executionContext);
```

`targetId` (a string tool ID) lands in the `context` parameter, and `executionContext` (an object) lands in the `toolId` parameter — the first and fourth arguments are swapped relative to what the method expects. Inside `testCall`, `context` gets spread (`{...context, ...}`) into what's passed to `renderTool()` for template/auth resolution (`{...'someObjectIdString'}` in JS produces an object of numeric-index → character mappings, not anything usable) — so any registered REST API Tool invoked from a workflow Tool Step will have broken auth/template context resolution (secrets, `{{externalUserId}}` templating, anything relying on `context.domain`/`context.projectId`). This needs a one-line argument reorder: `testCall(executionContext, restTool, resolvedInputObj, targetId)`.

**Scope gap:** the original ask (`TODO.md` 2.1) was "direct execution of RCP, REST, or MCP tools." Only REST is covered (webhook URL + registered REST API Tool); there's no path for a Tool Step to invoke an RCP source or an MCP server tool directly. Falls through to the same fake-success stub as before if configured that way. Worth an explicit scope note (RCP/MCP tool steps deferred to a later pass) rather than leaving it implicit.

## ❌ Still not fixed, in any round

### Orphan-run recovery still doesn't resume — it still just fails the run

Unchanged since round 1. `recoverOrphanWorkflowRuns.job.js` marks an orphaned `running` run `'failed'` and stops; it never calls into `checkpointService`/`checkpointer.getTuple` to actually resume execution. This directly contradicts `prompt.md`'s resolved decision ("find any `WorkflowRun`... whose in-memory `RunDriver` no longer exists, and resume it from the checkpoint") and `research.md`'s diagrammed design. Only the staleness threshold was ever widened (30s → 5min, reducing false positives) — the core behavior this finding is about has not been touched across three rounds of fixes. This needs an explicit decision at this point: either implement real resumption, or consciously downgrade the v1 spec to "fail cleanly and let the user re-trigger" and update `prompt.md`/`research.md` to say so — the current state is a silent, repeated non-fix of a documented must-have.

### Credit-metering formula still ad-hoc, still bypasses `rateLimiterService`

Unchanged. Not claimed fixed in any round; still worth a real decision rather than remaining silently ad-hoc.

## Recommended order to close this out

1. Fix the `testCall` argument order in `workflow.factory.js` — one line, concrete bug, currently breaks every registered-REST-API-Tool workflow step's auth/templating.
2. Make an explicit decision on orphan-run recovery: implement real checkpoint-resume, or formally downgrade the v1 spec and say so in `prompt.md`. Three rounds of otherwise-thorough fixes have passed over this one every time.
3. Either add RCP/MCP execution to Tool Step, or explicitly scope Tool Step to REST-only for v1 in the docs, so it isn't a silent gap.
4. Credit-metering formula: same treatment as #2 — real accounting or an acknowledged placeholder, not a silent invention.
