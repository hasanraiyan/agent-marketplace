# Workflows — feature spec (draft)

> Status: idea capture, not yet scoped into a plan. Write-up only — nothing here has been built.
> Two pillars, wanted together: (1) a **visual workflow builder** in Studio, (2) **multi-agent
> orchestration** underneath it, powered by LangGraph. Developer-Platform-only for now (lives in
> `platform`, not the Persona consumer app) and exposed through the SDK too, not just the UI. This
> doc sketches both pillars and how they fit the existing codebase rather than inventing a
> parallel system. Decisions below marked **Resolved** came from Raiyan's own notes on the first
> draft; the rest are still open.

## 1. Why

Today, Studio's unit of work is one **Agent**: one system prompt, one model, one flat toolbox
(RCP sources, REST tool sources, MCP servers, skills), one conversation. `agent.factory.js`
already builds every agent via `deepagents`' `createDeepAgent`, and every agent already gets one
hardcoded `general-purpose` subagent it can delegate to — but that subagent isn't
user-configurable, isn't visible in Studio, and there's no way to chain *multiple, distinct*
Agents (each with its own prompt/model/tools) into a larger, repeatable, multi-step process.

"Workflow" = the ability to compose more than one unit of work — Agent runs, tool calls,
subagents, conditionals, human approval — into a named, saved, reusable, visually-editable thing,
instead of stuffing it all into one Agent's system prompt and hoping the model sequences it
correctly.

## 2. The two pillars

### Pillar A — Visual workflow builder (Studio UI)

A new Studio surface (alongside Agents, RCP Sources, REST Tools, MCPs, Skills) where a user drags
out a graph of **nodes** and wires them together: `Studio → Project → Workflows → New Workflow`.
Developer-Platform-only, same as the rest of Studio — this does not touch the Persona consumer
app or `frontend/`.

**UI library — recommendation:** [`@xyflow/react`](https://reactflow.dev) (React Flow). It's the
de facto standard for exactly this shape of tool (canvas pan/zoom, custom node components, typed
edges/handles, minimap) — it's what LangGraph Studio's own canvas is built on, which matters here
since we're modeling the same kind of graph LangGraph itself executes. Alternatives considered:
Rete.js (more node-editor-framework, less "just render my nodes" than React Flow) and rolling a
custom canvas (no reason to, for v1). React Flow it is unless something concrete rules it out
once we prototype.

Node types (draft):

- **Trigger** — how the workflow starts: manual ("Run" button in Studio), an incoming chat message
  to a specific Agent, an RCP/REST API call, a webhook, or a schedule (cron).
- **Agent step** — run one existing Agent (by id) with a given input (static text, a template
  interpolating upstream node outputs, or the triggering message).
- **Tool step** — call one tool directly (an RCP tool, REST tool, or MCP tool) without spinning up
  a whole Agent/LLM turn — useful for pure data-fetch/transform steps that don't need reasoning.
- **Condition / branch** — route based on a previous step's output (simple expression or an
  LLM-judged classification).
- **Human approval** — pause and wait for a person to approve/reject/edit before continuing
  (reuses the existing HITL/`interruptOn` + resume mechanism already in `agui.service.js`).
- **Parallel / join** — fan out to multiple steps concurrently, then merge their outputs.
- **Output** — what the workflow returns/emits when it finishes (a value, a file, a notification).

Each node has a small config panel (reusing existing Studio patterns: `Field`/`FieldLabel` from
shadcn, same as the RCP Source edit page). Edges carry data — the builder needs some way to show
"this node's output becomes that node's input" (probably named output slots, referenced by
`{{stepId.output}}` in downstream node config, echoing how `contextOverride`/turn `context`
templating already works in the chat layer).

### Pillar B — Multi-agent orchestration, on LangGraph (Resolved: engine choice)

**Resolved:** the visual graph compiles directly to a **LangGraph `StateGraph`** — nodes become
graph nodes, edges become graph edges, condition nodes become conditional edges. This reuses the
same checkpointer (`checkpointService`) and the same AG-UI event translation (`aguiTranslator.js`)
already built for single-agent runs, so a workflow run streams into the frontend (and the SDK)
exactly like a chat run does today — just with more node/step events layered on top of the
existing `TOOL_CALL_*`/`CUSTOM` event vocabulary. **Streaming protocol is AG-UI, full stop** — no
separate streaming format for workflows.

`deepagents` subagents (`agent.factory.js`'s `subagents: [...]`, currently hardcoded to one
`general-purpose` entry) stay the *other* kind of orchestration — LLM-judgment-driven delegation
*inside* a single Agent step, not a fixed graph. A workflow's "Agent step" node is exactly a call
into the existing single-agent execution path (`runAgentAsAguiEvents`), which may itself use its
own subagents — the two pillars nest rather than compete. Making per-Agent subagents
user-configurable in Studio is a later, separate piece of work (see rollout, v3).

**Resumable runs (Resolved: must support disconnect/reconnect):** a workflow run must survive the
starting client disconnecting — the run keeps executing server-side, and the client (or a
different client, or the SDK) can reconnect to the same run later and see where it's at. This
mirrors the pattern `sdk/runtime`'s chat route already uses: a `RunDriver` registered under a
`runId`, independent of any one HTTP response, reattachable via `GET /chat/:runId/resume` — a
`WorkflowRun` needs the same "driver survives the request" shape, not a per-request-only stream.

This splits into two separate concerns, only one of which is a hard requirement for v1 — **no
Redis anywhere in this stack** (confirmed: `agenda.js`'s own doc comment says so explicitly, and
`rateLimiterService`/voice ticket redemption are both in-memory-only with Redis noted as an
unaddressed future gap, not existing infra), so anything proposed here has to work on Mongo alone:

- **Execution durability across a server restart — Resolved, must-have.** Does the workflow
  itself still reach a correct final state if the backend process restarts mid-run? Yes, and
  mostly for free: LangGraph's checkpointer already durably persists graph state to Mongo after
  every node (the same mechanism already backing HITL pause/resume and thread-history reload for
  chat). The only missing piece is a **resumption sweep** — the exact pattern `agenda.js` already
  uses for its project-deletion job ("must survive a process restart mid-cleanup"): on startup (or
  a periodic tick), find any `WorkflowRun` with `status: 'running'` whose in-memory `RunDriver` no
  longer exists, and resume it from the checkpoint. No new infrastructure, just this pattern
  applied to a new resource.
- **Live-stream continuity across a restart — Resolved, deferred to later.** Exact zero-gap SSE
  frame replay via `RunDriver` (`sdk/runtime/src/runDriver.ts`'s in-memory `frames` buffer) is what
  would actually need new durable infrastructure (an event log surviving process restarts) — and
  it's a UX-polish concern, not a correctness one. For v1, this stays best-effort/in-memory, same
  as chat today, with an explicit (not silent) fallback: if a client reconnects to a `runId` whose
  driver is gone, the backend serves the **current state from Mongo** (`WorkflowRun.nodeRuns`)
  instead of resuming a live byte-exact stream. You lose seamless mid-token replay across a
  restart; you never lose the ability to find out what happened.

**SDK exposure (Resolved):** workflows aren't Studio-UI-only — starting a run, streaming its
progress, resuming a disconnected run, and answering a pending approval all need to be
first-class SDK operations (`@personaai/sdk`, and the framework adapters built on it), the same
way `ChatClient` exposes `stream()`/`sendMessage()` today. A `WorkflowClient` (or similar) is the
natural shape: `client.workflows.run(workflowId, input)`,
`client.workflows.resume(runId)`, `client.workflows.respondToApproval(runId, decision)`.

## 3. Sketch: data model

```text
WorkflowDefinition
  _id, projectId, name, description, isEnabled
  version                                    // bumped on every save (see §5 versioning)
  trigger: { type: 'manual'|'chat'|'api'|'webhook'|'schedule', config }
  nodes: [{ id, type, config, position }]    // position = canvas x/y for the builder
  edges: [{ from, to, condition? }]
  createdAt, updatedAt

WorkflowRun
  _id, workflowId, workflowVersion, projectId, triggeredBy   // pinned to the version at start
  status: 'running'|'paused'|'completed'|'failed'
  nodeRuns: [{ nodeId, status, input, output, startedAt, endedAt, error? }]
  pendingApproval?: { nodeId, actionRequest }   // mirrors PersonaInterrupt shape
```

`WorkflowRun` is the thing the AG-UI-style stream reports on — same event shape family the SDK
(`@personaai/react`'s `useChat`) already knows how to render (tool calls, reasoning, interrupts),
extended with a "node started/node finished" event so the builder's canvas can highlight the
currently-executing node live, same way a debugger highlights the current line.

## 4. Rollout, roughly

- **v1 (MVP):** sequential-only graphs (Trigger → Agent step → Agent step → ... → Output), manual
  trigger only, no branching/parallel/approval nodes yet. Prove the compile-to-LangGraph path, the
  resumable-run model, and the canvas UI before adding graph complexity.
- **v2:** conditions/branches, human approval nodes (reusing existing HITL plumbing), chat-message
  and API triggers.
- **v3:** parallel/join, scheduled triggers, user-configurable named subagents per Agent (Pillar B
  extension), a workflow-step "library" (save a subgraph as a reusable step).

## 5. Decisions from the first draft's review

- **Ownership/visibility — Resolved:** a Workflow belongs to a Project the exact same way an Agent
  does, reusing `agent.model.js`'s ownership/visibility model rather than inventing a new one.
- **Project scope — Resolved:** every Project stays isolated, same as today — no cross-project
  workflows (an Agent step calling into a different Project's Agent) for now. Revisit later.
- **Versioning — Resolved, and called out as the most important open engineering question to get
  right:** editing a live `WorkflowDefinition` must **not** affect an in-flight `WorkflowRun` — a
  run pins to the `workflowVersion` it started with (same precedent as checkpointed Agent runs).
  Needs real design work: how versions are stored/diffed, what "publish" vs. "draft" means while
  editing, whether old versions stay runnable/re-triggerable.
- **Single-editor-at-a-time — Resolved:** fine for v1. No real-time collaborative canvas editing
  yet.
- **NL-to-graph generator — Resolved:** confirmed later, not v1. Draw it by hand first.
- **Agent-step reuse vs. fork — Leaning yes (reuse), needs more clarification:** an Agent step
  should reference an existing Agent already used elsewhere (mirrors how RCP Sources/MCPs are
  already shared, attached resources) rather than forking/cloning it into the workflow — but the
  exact implications (does editing that Agent elsewhere silently change a published Workflow's
  behavior? does a workflow pin an Agent version too, same as it pins its own?) still need
  thinking through, likely alongside the versioning question above.
- **Cost/credit metering — still open, needs real thought:** how a multi-Agent-step workflow run
  meters against the existing credit/rate-limiting system (`rateLimiterService`, Coursify-style
  credit metering) isn't decided. A workflow could burn many Agent-step turns per run — flat-rate
  per run, per-step, or usage-based are all on the table.

## 6. Explicit non-goals for v1

- No natural-language "describe your workflow and I'll build the graph" generator yet — draw it by
  hand first, auto-generation is a later idea once the primitives are solid.
- No cross-project workflows (a workflow calling an Agent that lives in a different Project) —
  every Project stays isolated for now.
- No workflow marketplace/sharing (parallel to the existing Agent marketplace concept) yet.

## 7. Known gaps, not yet addressed

Surfaced on a second read-through of this doc, before it becomes a real implementation plan — none
of these are decided yet, listed roughly in order of how much they'd bite if ignored:

- **Cycles/loops.** The doc so far implicitly treats the graph as a DAG (sequential v1, branching
  in v2) — but LangGraph's defining feature is that it isn't DAG-only, it supports cycles natively.
  A workflow that can't express "retry this step up to N times" or "loop over a list of items" is
  missing a genuinely common pattern. Decide explicitly: is v1 DAG-only by policy (fine, as long as
  it's a stated choice, not an oversight), with loops added deliberately in v2/v3?
- **Error handling / retry policy per node.** `nodeRuns[].error` captures *that* a node failed, but
  not what happens next: does one failed node fail the whole run, or can a node have an "on error"
  edge (mirrors n8n's error output) routing to a fallback/notification step? Does a Tool/Agent step
  get automatic retries before being marked failed? This is core to what makes something a workflow
  *engine* rather than a linear script that stops at the first problem.
- **Trigger security.** Webhook and scheduled triggers are called out as v2/v3 features, but
  nothing yet addresses how a webhook trigger authenticates its caller (a shared secret? a
  signature header, the way most webhook systems require?). Left unspecified, this is exactly the
  kind of thing that ships insecure by default — needs a real answer before webhook triggers ship,
  not an afterthought once they're already live.
- **Concurrency of runs.** Can the same `WorkflowDefinition` have multiple `WorkflowRun`s in flight
  at once (a webhook firing several times quickly, or a scheduled trigger overlapping a still-
  running previous run)? The existing `rateLimiterService` model is per-user/per-endpoint, built
  around "one person actively chatting" — webhook/schedule-triggered runs don't have that shape and
  need their own concurrency/queueing answer, however simple, before v2 trigger types ship.
- **A "Runs" view as an explicit Studio surface.** The `WorkflowRun` data model exists, but Pillar A
  only describes the canvas editor. There should be a second surface: a run-history/log list per
  workflow (status, duration, which node failed, inputs/outputs per step) — this is where most
  day-2 debugging actually happens, not the canvas itself.
- **Output typing between nodes.** `{{stepId.output}}` templating is mentioned in Pillar A, but
  "output" isn't given a shape (string? JSON object? file reference?). Without at least a loose
  type, the builder can't flag an obviously-wrong wiring before a run fails on it at execution time.
- **Test/dry-run before going live.** No mechanism yet for validating a workflow — especially one
  with a real webhook/schedule trigger already wired up — before it's live and able to fire against
  real side effects (real Agent turns, real tool calls, real credits spent).
