# Workflows Engine & Visual Builder — Master Implementation Plan

> **Target:** Workflows Engine (LangGraph Multi-Agent Orchestration) + Visual Builder (React Flow in Studio)  
> **Directives:** [prompt.md](file:///D:/projects/agent-marketplace/prompt.md) and [research.md](file:///D:/projects/agent-marketplace/research.md)  
> **Architecture Guardrails:** Zero Redis (MongoDB only), Standard AG-UI protocol streaming, Resumable runs via RunDriver, Strict DAG in v1.

Status Legend: 🔲 Not Started · 🚧 In Progress · ✅ Completed

---

## Architecture Overview & Core Decisions
1. **Pillar A (Visual Builder):** `@xyflow/react` v12 embedded in Developer Platform at `platform/src/app/projects/[projectId]/workflows/`. Includes Mermaid flowchart export.
2. **Pillar B (Orchestration Engine):** Dynamic compilation to LangGraph `StateGraph` in `agent-backend/src/modules/developer/workflows/`.
3. **Resilience & Node Error Policies (Gap 2):** Each node runner wrapped with configurable retry logic (exponential backoff) and `onError` handling (`fail`, `continue`, `routeError`).
4. **Usage & Credit Metering (Gap 9):** Atomic deduction against Project balance upon run completion (per token/agent turn/tool call) via `rateLimiterService`. Dry runs (`isDryRun: true`) are explicitly exempted from both pre-flight balance checks and billing deduction.
5. **Durability & Reconnect:** In-memory `WorkflowRunDriver` with monotonic `seq` buffering for live re-attachment + `MongoDBSaver` checkpoints + `agenda.js` orphan-recovery sweep.
6. **Cancellation Support:** Mid-flight run cancellation via `WorkflowRunDriver.abort()` updating status to `cancelled`, emitting `RUN_ERROR` / abort AG-UI frame, and cleaning up active listeners.
7. **Zero Redis:** MongoDB exclusively for state, checkpoints (`checkpoints`, `checkpoint_writes`), and queues (`agendaJobs`).
8. **Streaming Protocol:** Standard AG-UI protocol (`@ag-ui/core`) via `EventType.CUSTOM` events (`workflow_node_started`, `workflow_node_completed`, `workflow_node_failed`).
9. **Tenancy Security:** All endpoints strictly guarded by `projectAdminAuth` middleware.

---

## Master Checklist

### Phase 1: Backend Foundation & Data Architecture (`agent-backend`)
- [ ] **1.1. Mongoose Models (`src/modules/developer/workflows/`)**
  - [ ] Create `workflow.model.js` (Project scoping, name, description, draft nodes with `retryPolicy`/`onError`, edges, publishedVersion).
  - [ ] Create `workflowVersion.model.js` (Immutable version snapshot, `agentSnapshots` map, publishedBy).
  - [ ] Create `workflowRun.model.js` (Run status including `'cancelled'`, trigger metadata, `nodeRuns` step traces with `retriesTaken`, `isDryRun` flag, pendingApproval, usage tokens).
- [ ] **1.2. Database Repositories**
  - [ ] Create `workflow.repository.js` (CRUD, project-scoped queries, draft save).
  - [ ] Create `workflowVersion.repository.js` (Snapshot creation, version queries).
  - [ ] Create `workflowRun.repository.js` (Run creation, step updates, atomic concurrency check & increment using `findOneAndUpdate`, atomic status update to `cancelled`).
- [ ] **1.3. Zod Validators & Cycle Detection**
  - [ ] Create `workflow.validator.js` (Validate node schemas, edge schemas, retry configs, DFS cycle detection check).
- [ ] **1.4. Routes & Controllers**
  - [ ] Create `workflow.controller.js` (Draft CRUD, publish action, single run-trigger action supporting a `dryRun` flag — not two separate endpoints, mirroring the SDK's `run(workflowId, input, { dryRun? })` shape — cancel run action, Mermaid export, run history inspection).
  - [ ] Create `workflow.routes.js` with complete `@openapi` JSDoc annotations and explicit `projectAdminAuth` middleware chaining on every endpoint:
    - [ ] `POST /workflows/runs/:runId/cancel` endpoint to abort a running workflow.
  - [ ] Register routes under `/api/v1/developer/projects/:projectId/workflows` in `agent-backend/src/index.js` or `project.routes.js`.

### Phase 2: LangGraph Workflow Compiler & Execution Engine (`agent-backend`)
- [ ] **2.1. Dynamic Compiler & Node Runner Wrappers (`workflow.factory.js`)**
  - [ ] Implement node runner execution wrapper:
    - [ ] Wrap node runners with retry policy (transient error retry loop with exponential backoff).
    - [ ] Implement `onError` strategy dispatch (`fail_workflow` aborts run, `continue_with_null` sets step output null and proceeds, `route_error_edge` routes to error target handle).
  - [ ] Implement `compileWorkflowToStateGraph(workflowDef, executionContext)`:
    - [ ] `trigger` node runner.
    - [ ] `agentStep` runner (executing `createDeepAgent` / `runAgentAsAguiEvents` with context injection; support snapshot pinning vs. live tracking; **thread the run's own `AbortSignal` into `streamEvents()`'s `signal` option** so a mid-flight cancellation actually interrupts an in-progress LLM/tool call inside this step, not just the next node transition).
    - [ ] `toolStep` runner (direct execution of RCP, REST, or MCP tools without LLM turn; intercept destructive tools if `isDryRun: true`).
    - [ ] `knowledgeStep` runner (direct vector search via `knowledgeService`).
    - [ ] `output` node runner (resolves output template mapping).
    - [ ] Wire LangGraph `START` and `END` with topological edges.
- [ ] **2.2. Template Resolver (`templateResolver.js`)**
  - [ ] Safe dot-path resolver supporting `{{steps.<nodeId>.output.<prop>}}` and `{{trigger.payload.<prop>}}`.
- [ ] **2.3. AG-UI Telemetry Extension (`aguiEventSchemas.js`)**
  - [ ] Declare new custom events: `workflow_node_started`, `workflow_node_completed` (with retriesTaken & durationMs), `workflow_node_failed`.
  - [ ] Bump `AGUI_SCHEMA_VERSION`.
- [ ] **2.4. Credit & Usage Metering Service (`workflowUsage.service.js`)**
  - [ ] Aggregate tokens, agent turns, and tool calls from node execution results into `WorkflowRun.usage`.
  - [ ] Deduct computed credits atomically against Project balance upon run completion via `rateLimiterService`.
  - [ ] Pre-flight balance check: reject run initiation if Project credit balance is insufficient (**explicitly bypassed when `isDryRun: true`**).
- [ ] **2.5. Mermaid Flowchart Exporter (`workflowMermaid.js`)**
  - [ ] Serialize `WorkflowDefinition` nodes and edges to standard Mermaid flowchart text (`graph TD` / `flowchart LR`).

### Phase 3: Resumable Execution & Background Recovery (`agent-backend`)
- [ ] **3.1. Workflow Run Driver (`WorkflowRunDriver`)**
  - [ ] Implement in-memory SSE frame buffering with monotonic sequence IDs (`seq`).
  - [ ] Decouple execution lifetime from client HTTP connection.
  - [ ] Implement `subscribe(sinceSeq)` for replay of missed frames and live tail streaming.
  - [ ] Implement `abort()` method: trigger AbortController signal, push in-band cancellation frame, mark driver finished, and transition `WorkflowRun` status to `cancelled` in Mongo.
- [ ] **3.2. Checkpoint Integration**
  - [ ] Wire `MongoDBSaver` thread persistence per node superstep.
- [ ] **3.3. Reconnect & Resume Route**
  - [ ] Expose `GET /workflows/runs/:runId/resume` supporting stream re-attachment or fallback to Mongo `nodeRuns` state snapshot.
- [ ] **3.4. Agenda Orphan Recovery Job (`recoverOrphanWorkflowRuns.job.js`)**
  - [ ] Register background Agenda job to detect orphaned `running` runs after server crash/restart and resume from checkpoint.

### Phase 4: Developer Platform Visual Canvas UI (`platform/`)
- [ ] **4.1. Core Setup & Navigation**
  - [ ] Add `@xyflow/react` to `platform/package.json`.
  - [ ] Add "Workflows" item to project sidebar (`platform/src/components/layout/app-sidebar.tsx`).
  - [ ] Setup route structure: `platform/src/app/projects/[projectId]/workflows/`.
- [ ] **4.2. Workflows List & Header Page**
  - [ ] Create `workflows/page.tsx` (Table of workflows, status, version badge, create button).
  - [ ] Create `workflows/new/page.tsx` (Create workflow dialog/form).
- [ ] **4.3. React Flow Canvas Editor (`[workflowId]/page.tsx`)**
  - [ ] Canvas viewport with background grid, minimap, zoom/pan controls.
  - [ ] Node palette toolbar (Trigger, Agent Step, Tool Step, Knowledge Step, Output).
  - [ ] Drag-and-drop / click-to-place node additions.
- [ ] **4.4. Custom Node Components (`components/workflows/nodes/`)**
  - [ ] `TriggerNode`, `AgentStepNode`, `ToolStepNode`, `KnowledgeStepNode`, `OutputNode`.
  - [ ] Visual indicators for handles, retry policies, validation warnings, and active execution states.
- [ ] **4.5. Node Configuration Sheet / Panel**
  - [ ] Slide-out config drawer for editing node details (model, agent selector, tool selector, prompt template).
  - [ ] **Agent Step Pinning Toggle (Gap 8)**: Add switch for "Pin to Published Snapshot" vs "Live Tracking" in Agent step config.
  - [ ] Node Resilience config section: retry attempts (0-5), backoff ms, and `onError` dropdown (`fail`, `continue`, `routeError`).
  - [ ] Dynamic variable picker for `{{steps.<nodeId>.output}}`.
- [ ] **4.6. Canvas Actions, Validation & Mermaid Export**
  - [ ] "Save Draft", "Publish Version", and "Export Mermaid" dialog/copy button in canvas header.
  - [ ] Pre-flight graph validation (cycles, disconnected nodes, missing required inputs).

### Phase 5: Workflow Runs & Live Playback Inspector (`platform/`)
- [ ] **5.1. Runs History View (`[workflowId]/runs/page.tsx`)**
  - [ ] Filterable table of past runs (Status, Triggered By, Started At, Duration, Tokens, Credits Deducted, Version).
  - [ ] **Dry-Run Distinction**: Include badge for "Dry Run" vs "Live Production", with quick filter toggle to view/hide dry runs.
- [ ] **5.2. Live Run Inspector & Canvas Playback (`[workflowId]/runs/[runId]/page.tsx`)**
  - [ ] Read-only canvas highlighting active and executed node paths.
  - [ ] Node detail inspector sheet: input JSON, output JSON, retries taken, error message, duration, and token usage.
  - [ ] Live AG-UI stream integration showing tokens typing live inside the active agent node.
  - [ ] **Stop / Cancel Run Button**: Prominent action to abort in-flight workflow runs.
- [ ] **5.3. Safe Sandbox / Test Run Drawer (`[workflowId]/page.tsx`)**
  - [ ] Drawer on canvas to configure mock trigger payload.
  - [ ] **Dry-Run Mode Toggle (Gap 7)**:
    - Pass `isDryRun: true` in run request.
    - Zero balance pre-flight exemption (allows testing even if credit balance is zero).
    - Intercept destructive tool calls (database writes, emails, external webhooks) and stub with mock success, preventing real external side effects and skipping billing deduction.
    - Live-stream the test execution on the canvas with "Dry-Run" watermarking.
    - **Stop / Cancel Test Button**: Immediate cancellation capability directly within test drawer.

### Phase 6: SDK Integration (`@personaai/sdk`)
- [ ] **6.1. Workflow Client (`sdk/typescript/src/workflows/`)**
  - [ ] `client.workflows.run(workflowId, input, options?: { dryRun?: boolean })` -> awaits final output.
  - [ ] `client.workflows.stream(workflowId, input, options?: { dryRun?: boolean })` -> async iterable of AG-UI events.
  - [ ] `client.workflows.resume(runId, sinceSeq?)` -> reattaches to running stream.
  - [ ] `client.workflows.cancel(runId)` -> aborts an in-flight workflow run.
  - [ ] `client.workflows.getRun(runId)` -> returns run metadata and node runs.
  - [ ] `client.workflows.getMermaid(workflowId)` -> returns Mermaid flowchart string.
- [ ] **6.2. Main Client Export**
  - [ ] Expose `workflows` client on `PersonaClient`.

### Phase 7: Verification & Testing
- [ ] **7.1. Backend Unit & Resilience Tests**
  - [ ] Unit tests for StateGraph compiler and template resolver.
  - [ ] Unit tests for node retry wrapper (transient failure retries up to maxRetries, exponential backoff timing).
  - [ ] Unit tests for `WorkflowRunDriver` buffering, reconnect logic, and abort cancellation.
- [ ] **7.2. High-Risk Architecture & Recovery Tests**
  - [ ] **Orphan Recovery Test**: Start a workflow run, kill the in-memory driver to simulate a backend process crash/restart, trigger the Agenda sweep job, and assert the run resumes from its last checkpoint and finishes.
  - [ ] **Concurrency Limit Test (v1 Manual Runs)**: Trigger `maxConcurrent + 1` manual runs simultaneously; verify that excess runs are rejected with `429 Too Many Requests` without race conditions (queueing assertions deferred to v2 when webhook/schedule triggers land).
  - [ ] **Dry-Run Interception & Zero-Balance Test**: Run a workflow with destructive tool steps in dry-run mode under a zero-balance project account; verify pre-flight passes, no real tool side effects execute, and usage credits remain undeducted.
  - [ ] **Mid-Flight Cancellation Test**: Start a workflow, issue a cancellation request, verify that current node aborts immediately, status becomes `cancelled`, and resources are released.
- [ ] **7.3. Frontend Build Verification**
  - [ ] `tsc --noEmit` and lint checks in `platform/`.
- [ ] **7.4. End-to-End Live Workflow Verification**
  - [ ] Build a 2-agent sequential workflow on canvas, export Mermaid diagram, test live execution, test live cancellation, and test stream re-attachment.
