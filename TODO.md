# Workflows Engine & Visual Builder — Master Implementation Plan

> **Target:** Workflows Engine (LangGraph Multi-Agent Orchestration) + Visual Builder (React Flow in Studio)  
> **Directives:** [prompt.md](file:///D:/projects/agent-marketplace/prompt.md) and [research.md](file:///D:/projects/agent-marketplace/research.md)  
> **Architecture Guardrails:** Zero Redis (MongoDB only), Standard AG-UI protocol streaming, Resumable runs via RunDriver, Strict DAG in v1.

Status Legend: 🔲 Not Started · 🚧 In Progress · ✅ Completed

---

## Architecture Overview & Core Decisions
1. **Pillar A (Visual Builder):** `@xyflow/react` v12 embedded in Developer Platform at `platform/src/app/projects/[projectId]/workflows/`.
2. **Pillar B (Orchestration Engine):** Dynamic compilation to LangGraph `StateGraph` in `agent-backend/src/modules/developer/workflows/`.
3. **Durability & Reconnect:** In-memory `WorkflowRunDriver` with monotonic `seq` buffering for live re-attachment + `MongoDBSaver` checkpoints + `agenda.js` orphan-recovery sweep.
4. **Zero Redis:** MongoDB exclusively for state, checkpoints (`checkpoints`, `checkpoint_writes`), and queues (`agendaJobs`).
5. **Streaming Protocol:** Standard AG-UI protocol (`@ag-ui/core`) via `EventType.CUSTOM` events (`workflow_node_started`, `workflow_node_completed`, `workflow_node_failed`).

---

## Master Checklist

### Phase 1: Backend Foundation & Data Architecture (`agent-backend`)
- [ ] **1.1. Mongoose Models (`src/modules/developer/workflows/`)**
  - [ ] Create `workflow.model.js` (Project scoping, name, description, draft nodes & edges, publishedVersion).
  - [ ] Create `workflowVersion.model.js` (Immutable version snapshot, `agentSnapshots` map, publishedBy).
  - [ ] Create `workflowRun.model.js` (Run status, trigger metadata, `nodeRuns` step traces, pendingApproval, usage tokens).
- [ ] **1.2. Database Repositories**
  - [ ] Create `workflow.repository.js` (CRUD, project-scoped queries, draft save).
  - [ ] Create `workflowVersion.repository.js` (Snapshot creation, version queries).
  - [ ] Create `workflowRun.repository.js` (Run creation, step updates, atomic concurrency lock).
- [ ] **1.3. Zod Validators & Cycle Detection**
  - [ ] Create `workflow.validator.js` (Validate node schemas, edge schemas, DFS cycle detection check).
- [ ] **1.4. Routes & Controllers**
  - [ ] Create `workflow.controller.js` (Draft CRUD, publish action, manual run trigger, run history inspection).
  - [ ] Create `workflow.routes.js` with complete `@openapi` JSDoc annotations.
  - [ ] Register routes in `agent-backend/src/index.js` or `project.routes.js`.

### Phase 2: LangGraph Workflow Compiler & Execution Engine (`agent-backend`)
- [ ] **2.1. Dynamic Compiler (`workflow.factory.js`)**
  - [ ] Implement `compileWorkflowToStateGraph(workflowDef, executionContext)`:
    - [ ] `trigger` node runner.
    - [ ] `agentStep` runner (executing `createDeepAgent` / `runAgentAsAguiEvents` with context injection).
    - [ ] `toolStep` runner (direct execution of RCP, REST, or MCP tools without LLM turn).
    - [ ] `knowledgeStep` runner (direct vector search via `knowledgeService`).
    - [ ] `output` node runner (resolves output template mapping).
    - [ ] Wire LangGraph `START` and `END` with topological edges.
- [ ] **2.2. Template Resolver (`templateResolver.js`)**
  - [ ] Safe dot-path resolver supporting `{{steps.<nodeId>.output.<prop>}}` and `{{trigger.payload.<prop>}}`.
- [ ] **2.3. AG-UI Telemetry Extension (`aguiEventSchemas.js`)**
  - [ ] Declare new custom events: `workflow_node_started`, `workflow_node_completed`, `workflow_node_failed`.
  - [ ] Bump `AGUI_SCHEMA_VERSION`.

### Phase 3: Resumable Execution & Background Recovery (`agent-backend`)
- [ ] **3.1. Workflow Run Driver (`WorkflowRunDriver`)**
  - [ ] Implement in-memory SSE frame buffering with monotonic sequence IDs (`seq`).
  - [ ] Decouple execution lifetime from client HTTP connection.
  - [ ] Implement `subscribe(sinceSeq)` for replay of missed frames and live tail streaming.
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
  - [ ] Visual indicators for handles, validation warnings, and active execution states.
- [ ] **4.5. Node Configuration Sheet / Panel**
  - [ ] Slide-out config drawer for editing node details (model, agent selector, tool selector, prompt template).
  - [ ] Dynamic variable picker for `{{steps.<nodeId>.output}}`.
- [ ] **4.6. Canvas Actions & Validation**
  - [ ] "Save Draft", "Publish Version", and "Test Run" actions in toolbar.
  - [ ] Pre-flight graph validation (cycles, disconnected nodes, missing required inputs).

### Phase 5: Workflow Runs & Live Playback Inspector (`platform/`)
- [ ] **5.1. Runs History View (`[workflowId]/runs/page.tsx`)**
  - [ ] Filterable table of past runs (Status, Triggered By, Started At, Duration, Tokens, Version).
- [ ] **5.2. Live Run Inspector & Canvas Playback (`[workflowId]/runs/[runId]/page.tsx`)**
  - [ ] Read-only canvas highlighting active and executed node paths.
  - [ ] Node detail inspector sheet: input JSON, output JSON, error message, duration, and token usage.
  - [ ] Live AG-UI stream integration showing tokens typing live inside the active agent node.
- [ ] **5.3. Test Run Modal on Canvas**
  - [ ] Quick-test modal to supply mock input JSON and watch the graph execute live on the canvas.

### Phase 6: SDK Integration (`@personaai/sdk`)
- [ ] **6.1. Workflow Client (`sdk/typescript/src/workflows/`)**
  - [ ] `client.workflows.run(workflowId, input)` -> awaits final output.
  - [ ] `client.workflows.stream(workflowId, input)` -> async iterable of AG-UI events.
  - [ ] `client.workflows.resume(runId, sinceSeq?)` -> reattaches to running stream.
  - [ ] `client.workflows.getRun(runId)` -> returns run metadata and node runs.
- [ ] **6.2. Main Client Export**
  - [ ] Expose `workflows` client on `PersonaClient`.

### Phase 7: Verification & Testing
- [ ] **7.1. Backend Tests**: Unit tests for StateGraph compiler, template resolver, cycle detector, and `WorkflowRunDriver`.
- [ ] **7.2. Frontend Build Verification**: `tsc --noEmit` and lint checks in `platform/`.
- [ ] **7.3. End-to-End Workflow Execution**: Build a multi-agent workflow on canvas, execute live, test stream re-attachment, and verify database checkpoints.
