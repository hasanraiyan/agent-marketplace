# Agent Architecture Toggle: DeepAgent vs ReAct Agent

## Context

Every Agent today is built through deepagents' `createDeepAgent` (`agent.factory.js`), which bundles a virtual filesystem backend, skills, auto-loaded memory files, subagent (`task` tool) delegation, and HITL approval gates — on top of the generic model/tools/checkpointer setup every agent needs. This is expensive: we traced a real bug where a plain "summarize sales performance" workflow query burned 6+ seconds because deepagents' built-in `ls`/`grep` filesystem tools got invoked for no reason, and the resulting text got dropped entirely by a checkpoint-namespace quirk we had to patch around.

Not every agent needs any of that. A simple single-turn or tool-calling step just needs a model + its own configured tools (MCP/REST/RCP/knowledge-base) — no filesystem, no skills, no subagents. The goal is a per-Agent **architecture toggle** (`agentType: 'deepagent' | 'react'`, default `'deepagent'`) so simple agents can skip the overhead and save tokens/latency, with zero behavior change for every existing agent.

Confirmed via web search + package tracing: LangGraph v1 has already deprecated `@langchain/langgraph/prebuilt`'s `createReactAgent` in favor of `langchain`'s own `createAgent` — and tracing `deepagents`'s own dist confirmed `createDeepAgent` is itself built on top of that same `createAgent`, just with deepagents' filesystem/skills/memory/subagents layered on. So "ReAct mode" = call `createAgent` directly, skipping that layering. This is the current, non-deprecated path, and it reuses `contextOverrideMiddleware` (the RCP per-turn context-injection plumbing) completely unchanged, because `createAgent` supports the same `middleware: [...]` array deepagents passes through — unlike the deprecated `createReactAgent`, which has no middleware hook at all and would have required rewriting that logic.

## Approach

### 1. Backend: `agent-backend/src/modules/agents/agent.factory.js`

Everything through building `llm`, `dynamicTools` (via `resolveAgentTools`), and `safeCheckpointer` inside `buildAgent(agentId, userId, checkpointer, executionContext)` stays fully shared — none of it is deepagents-specific. The branch starts where `personalizedPrompt` is composed and ends at the agent-construction call:

- Import `createAgent` from `'langchain'` alongside the existing `createDeepAgent` import from `'deepagents'`.
- Compute `const agentType = agent.agentType === 'react' ? 'react' : 'deepagent';` right after `agent` is resolved. The three hardcoded Architect/ProjectArchitect/DeveloperArchitect synthetic agent objects have no `agentType` field, so they fall through to `'deepagent'` automatically — no edit needed there, they can never be react-mode.
- Split `personalizedPrompt`: always include `agent.systemPrompt`; append the full PRESENT FILE / MEMORY / SUB-AGENT rule sections only for `deepagent`; for `react`, append only a trimmed PRESENT FILE note and skip the memory/subagent sections entirely (mentioning tools that don't exist would mislead the model).
- Gate the deepagents-only assembly (`backendRoutes`, `storeMounts` loop, skill-library mounts, sandbox backend resolution, `interruptOnConfig`) behind `if (agentType === 'deepagent')` — none of it should run for react mode.
- Two builder calls:
  ```js
  const agentInstance = agentType === 'react'
    ? await createAgent({
        model: llm,
        systemPrompt: personalizedPrompt,
        checkpointer: safeCheckpointer,
        store: getGlobalStore(),
        tools: dynamicTools,
        middleware: [contextOverrideMiddleware],
      })
    : await createDeepAgent({ /* existing block, unchanged */ });
  ```
  `sandboxBackend` is `null` for react mode (an already-tolerated shape elsewhere in this file).
- Add `agentType` to the existing `'building agent'`/`'agent built'` log calls.
- No change needed to cache-key/invalidation logic — `updatedAt` already bumps on any field write including `agentType`, so flipping the toggle and saving auto-invalidates the compiled-instance cache.
- `resolveAgentTools`: no changes. Both `presentFileTool` and `askClarificationTool` are backend-agnostic already (present_file is pure metadata passthrough; ask_clarification calls LangGraph's own `interrupt()` directly) — keep both attached unconditionally for both modes. `present_file` will rarely have anything real to point at in react mode (no file-writing tools) — harmless, just a documented quirk, not a bug.
- Sandbox + react mode: react-mode agents ignore `sandboxEnabled` at build time (no backend to swap it into); the frontend disables the toggle so this combination is unreachable through the UI (see section 4).

### 2. Backend: schema + validation

- `agent.model.js`: add next to `sandboxEnabled`:
  ```js
  agentType: { type: String, enum: ['deepagent', 'react'], default: 'deepagent' },
  ```
- `agent.validator.js`: add `agentType: z.enum(['deepagent', 'react']).default('deepagent')` to `createAgentSchema`, and `agentType: z.enum(['deepagent', 'react']).optional()` to `updateAgentSchema`. No other allow-list exists on the write path (`agent.service.js` only explicitly deletes 5 unrelated owner/routing fields), so this round-trips with just these two edits.

### 3. Workflow snapshot-pinning gap (must fix, easy to miss)

`workflow.factory.js`'s `createAgentStepExecutor` builds a synthetic `agentDoc` from a pinned snapshot (`config.pinSnapshot: true`) containing only `{ _id, modelName, systemPrompt, tools }` — no `agentType`. That snapshot is captured in `workflow.service.js#publishWorkflow` and its shape is enforced by `agentSnapshotSchema` in `workflowVersion.model.js`. Without a fix, any *published* workflow with a pinned react-mode Agent Step silently rebuilds as deepagent every time it runs — completely defeating this feature for that call path. Fix (three small, symmetric edits):
- `workflowVersion.model.js`: add `agentType: { type: String, enum: ['deepagent', 'react'], default: 'deepagent' }` to `agentSnapshotSchema`.
- `workflow.service.js` (`publishWorkflow`'s snapshot object): add `agentType: agentDoc.agentType || 'deepagent'`.
- `workflow.factory.js` (`createAgentStepExecutor`'s synthetic `agentDoc`): add `agentType: snapshot.agentType || 'deepagent'`.

Unpinned Agent Steps are unaffected — they call `agentRepository.findById(agentId)` directly and already get the real `agentType`.

### 4. Frontend: `platform/src/components/agents/agent-form.tsx`

This is the single-page (non-tabbed) Agent create/edit form — a "Configuration" card and an "Attachments" card (six `AttachPicker` checkbox lists: Skills/Knowledge/MCP/RestTools/RcpSources/Stores).

- `AgentFormState`: add `agentType: "deepagent" | "react"`. `EMPTY_FORM`: default `"deepagent"`. Edit-mode hydration: read `agentType` off the loaded doc, falling back to `"deepagent"`. `handleSubmit` payload: include `agentType: form.agentType`.
- New shadcn `Select` in the Configuration card (placed after the Category/Visibility row), following the existing "mode toggle with conditional dependent fields" pattern already used in `rest-tools/rest-tool-editor.tsx` (a `Select` bound via `onValueChange`, with `{form.x === "y" && (...)}` rendering dependent UI directly below):
  - Options: "Deep Agent (full features)" / "ReAct Agent (lightweight)", with a one-line description under each choice explaining what's unsupported in react mode (filesystem, skills, memory, subagents, approval gates) and that present_file rarely fires without file tools.
- Wrap the existing Sandbox `Switch` block and the Skills `AttachPicker` in `{form.agentType === "deepagent" && (...)}` — both are deepagents-only concepts. Leave Knowledge/MCP/RestTools/RcpSources/Stores pickers unconditional (those flow through the shared `resolveAgentTools` pipeline, not deepagents-specific).
- No Memory or Subagents UI exists anywhere in this form today (confirmed) — nothing else to hide.
- `src/lib/api/projects.ts`: no change needed — `createProjectAgent`/`updateProjectAgent` both take `data: unknown`, so the new field passes through automatically.

### Open decisions (defaults chosen below; flag during review if you want different)

- **Sandbox + react-mode guard**: silently ignored at build time + hidden in the UI (simplest). Not adding a server-side rejection for direct API calls that bypass the UI — low risk, can add later if it becomes a real problem.
- **`present_file`/`ask_clarification` in react mode**: kept attached unconditionally (simpler, harmless) rather than conditionally removed.
- **Enum naming**: `'deepagent' | 'react'` (matches existing terse enum style like `visibility`/`category`).

## Verification

1. **Regression (deepagent, unchanged agents)**: run an existing agent with no `agentType` set through the Playground with a normal prompt — confirm identical behavior to before this change.
2. **React mode, Playground**: flip an agent to `agentType: 'react'` via the new Select, save, run the same "summarize sales performance"-style prompt that originally exposed the bug. Confirm: response streams correctly, no `ls`/`grep`/filesystem tool calls appear in the trace, and latency visibly drops. Also confirm `ask_clarification` still pauses/resumes correctly (validates raw `interrupt()` under `createAgent`'s graph).
3. **Workflow Agent Step, react mode, unpinned**: build/run a workflow with an Agent Step referencing the react-mode agent (no `pinSnapshot`) — should build via the real `agentType` from the DB.
4. **Workflow Agent Step, react mode, pinned**: same, but with `pinSnapshot: true`, published — before the Step 3 fix this incorrectly falls back to deepagent; after the fix, confirm it correctly builds react-mode. Also re-run the specific `checkpoint_ns: ''` regression scenario (an Agent Step's streamed text correctly attributed to the workflow node, not dropped) with a react-mode agent in the step, since this stems from LangGraph's generic nested-invocation namespacing and should apply identically to `createAgent`'s compiled graph (same `tools` node name as deepagents).
5. **Toggle round-trip**: edit an agent, flip deepagent→react→deepagent, confirm each save is reflected in the very next Playground run (validates cache invalidation via `updatedAt`).

## Critical files

- `agent-backend/src/modules/agents/agent.factory.js`
- `agent-backend/src/modules/agents/agent.model.js`
- `agent-backend/src/modules/agents/agent.validator.js`
- `agent-backend/src/modules/developer/workflows/workflow.factory.js`
- `agent-backend/src/modules/developer/workflows/workflow.service.js`
- `agent-backend/src/modules/developer/workflows/workflowVersion.model.js`
- `platform/src/components/agents/agent-form.tsx`
