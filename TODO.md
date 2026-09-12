# Workflows SDK — Master Implementation Checklist

> **Target:** Workflows SDK (`sdk/typescript` & `sdk/python`)  
> **Directives:** [research.md](file:///D:/projects/agent-marketplace/research.md) and [plan.md](file:///D:/projects/agent-marketplace/plan.md)  
> **Status Legend:** 🔲 Not Started · 🚧 In Progress · ✅ Completed  

---

## Completed Foundations (Backend & Visual Builder)
- [x] **Phase 1: Backend Foundation & Data Architecture** (`workflow.model.js`, `workflowVersion.model.js`, `workflowRun.model.js`, repositories, validators).
- [x] **Phase 2: LangGraph Workflow Compiler & Execution Engine** (`workflow.factory.js`, `templateResolver.js`, `workflowUsage.service.js`, `workflowMermaid.js`).
- [x] **Phase 3: Resumable Execution & Background Recovery** (`WorkflowRunDriver`, `MongoDBSaver`, `recoverOrphanWorkflowRuns.job.js`).
- [x] **Phase 4: Developer Platform Visual Canvas UI** (`@xyflow/react`, nodes, configuration panels, Mermaid export).
- [x] **Phase 5: Workflow Runs & Live Playback Inspector** (runs history, live canvas telemetry, safe sandbox test drawer).

---

## SDK Implementation Roadmap

### Phase 1: Backend Route Parity & Abuse Protection (`agent-backend`)
- [ ] **1.1. Rate Limiting Protection on Machine Routes (`developerWorkflow.routes.js`)**
  - [ ] Import `rateLimiter, { RATE_LIMITS } from '../../rateLimiter/rateLimiter.middleware.js'`.
  - [ ] Initialize `mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE)`.
  - [ ] Wire `mutateLimiter` to all mutating routes: `create`, `update`, `remove`, `saveDraft`, `publish`, `run`, `cancel`.
- [ ] **1.2. Enhance Route Parity (`developerWorkflow.routes.js`)**
  - [ ] Add `GET /api/v1/developer/workflows/:workflowId/versions` -> `listVersions`.
  - [ ] Add `GET /api/v1/developer/workflows/:workflowId/versions/:version` -> `getVersion`.
  - [ ] Add `GET /api/v1/developer/workflows/:workflowId/mermaid` -> `getMermaid`.
  - [ ] Add `GET /api/v1/developer/workflows/runs/:runId` -> `getRun` (in addition to `/:workflowId/runs/:runId`).
  - [ ] Add `POST /api/v1/developer/workflows/runs/:runId/cancel` -> `mutateLimiter`, `cancel` (in addition to `/:workflowId/runs/:runId/cancel`).
  - [ ] Add `GET /api/v1/developer/workflows/runs/:runId/resume` -> `resume` (SSE stream re-attachment).
  - [ ] Add `POST /api/v1/developer/workflows/:workflowId/run` -> `mutateLimiter`, `run` (alias for `/:workflowId/runs` matching Studio routes).

---

### Phase 2: TypeScript SDK Types & Resource (`sdk/typescript`)
- [ ] **2.1. Define TypeScript Types (`sdk/typescript/src/types/workflow.ts`)**
  - [ ] Node, Edge, and Trigger types (`WorkflowNodeType`, `WorkflowNode`, `WorkflowEdge`, `WorkflowTrigger`, `WorkflowDraft`).
  - [ ] Node retry policy and error handling enums (`NodeRetryPolicy`, `NodeOnErrorAction`).
  - [ ] Workflow entity types (`Workflow`, `WorkflowVisibility`, `WorkflowOwnerType`).
  - [ ] Workflow version snapshot types (`WorkflowVersion`, `AgentSnapshot`).
  - [ ] Workflow run and execution types (`WorkflowRun`, `NodeRun`, `WorkflowRunStatus`, `NodeRunStatus`, `WorkflowUsage`).
  - [ ] Input and parameter types (`CreateWorkflowInput`, `UpdateWorkflowInput`, `DiscoverWorkflowsParams`, `ListWorkflowRunsParams`, `RunWorkflowOptions`).
  - [ ] Telemetry and stream event types (`WorkflowStreamEvent`, `WorkflowRunResult`).
- [ ] **2.2. Implement `WorkflowsResource` (`sdk/typescript/src/resources/workflows.ts`)**
  - [ ] CRUD operations: `create`, `list`, `get`, `update`, `delete`.
  - [ ] Draft & Version management: `saveDraft`, `publish`, `listVersions`, `getVersion`.
  - [ ] Diagram export: `getMermaid`.
  - [ ] Run management: `listRuns`, `getRun`, `cancel`.
- [ ] **2.3. Implement TypeScript Streaming & Execution**
  - [ ] Implement `stream(workflowId, options)` using native `parseAguiEventStream`.
  - [ ] Implement `resumeStream(runId, sinceSeq, signal)` for live re-attachment and frame replay.
  - [ ] Implement `run(workflowId, options)` convenience aggregator (drains stream and returns `WorkflowRunResult`).
- [ ] **2.4. Mount in `PersonaClient` (`sdk/typescript/src/client.ts` & `index.ts`)**
  - [ ] Instantiate `this.workflows = new WorkflowsResource(this.http, workflowsLogger)`.
  - [ ] Export resource and all types in `index.ts`.

---

### Phase 3: Python SDK Types & Resources (`sdk/python`)
- [ ] **3.1. Define Python Types (`sdk/python/src/personaai/types/workflow.py`)**
  - [ ] `WorkflowNodeType`, `WorkflowNodeData`, `WorkflowNode`, `WorkflowEdge`, `WorkflowDraft`.
  - [ ] `Workflow`, `WorkflowVersion`, `AgentSnapshot`.
  - [ ] `NodeRun`, `WorkflowUsage`, `WorkflowRun`, `WorkflowRunResult`.
  - [ ] Query and input parameter dicts (`CreateWorkflowInput`, `UpdateWorkflowInput`, `DiscoverWorkflowsParams`, `ListWorkflowRunsParams`).
- [ ] **3.2. Implement Sync & Async Resources (`sdk/python/src/personaai/resources/workflows.py`)**
  - [ ] Class `Workflows` (Sync):
    - [ ] `create`, `list`, `get`, `update`, `delete`, `save_draft`, `publish`.
    - [ ] `list_versions`, `get_version`, `get_mermaid`.
    - [ ] `list_runs`, `get_run`, `cancel`.
    - [ ] `stream(workflow_id, input=..., ...)` -> `Iterator[AguiEvent]`.
    - [ ] `resume_stream(run_id, since_seq=0)` -> `Iterator[AguiEvent]`.
    - [ ] `run(workflow_id, input=..., ...)` -> `WorkflowRunResult`.
  - [ ] Class `AsyncWorkflows` (Async):
    - [ ] Async equivalents for all CRUD methods.
    - [ ] `stream(workflow_id, input=..., ...)` -> `AsyncIterator[AguiEvent]`.
    - [ ] `resume_stream(run_id, since_seq=0)` -> `AsyncIterator[AguiEvent]`.
    - [ ] `run(workflow_id, input=..., ...)` -> `WorkflowRunResult`.
- [ ] **3.3. Mount in Python Clients (`client.py`, `async_client.py`, `__init__.py`)**
  - [ ] Add `self.workflows = Workflows(self._transport)` to `PersonaClient`.
  - [ ] Add `self.workflows = AsyncWorkflows(self._transport)` to `AsyncPersonaClient`.
  - [ ] Export types and resources in `__init__.py`.

---

### Phase 4: Automated Testing & Verification
- [ ] **4.1. TypeScript SDK Vitest Tests (`sdk/typescript/test/resources/workflows.test.ts`)**
  - [ ] Unit test: `create` with and without `Idempotency-Key`.
  - [ ] Unit test: `list` query parameter serialization.
  - [ ] Unit test: `saveDraft`, `publish`, `listVersions`, `getVersion`.
  - [ ] Unit test: `getMermaid` markdown extraction.
  - [ ] Unit test: `cancel` abort call.
  - [ ] Streaming test: `stream` yields SSE frames with monotonic `seq`.
  - [ ] Streaming test: `resumeStream` forwards `sinceSeq`.
  - [ ] Aggregator test: `run` accumulates events and returns `WorkflowRunResult`.
- [ ] **4.2. Python SDK Pytest Tests (`sdk/python/tests/resources/test_workflows.py`)**
  - [ ] Sync CRUD tests via `respx`.
  - [ ] Async CRUD tests via `respx`.
  - [ ] Sync and Async SSE stream decoding tests.
  - [ ] `resume_stream` re-attachment tests.
  - [ ] High-level `run` result aggregation test.
- [ ] **4.3. Build & CI Verification**
  - [ ] Run `pnpm run build` in `sdk/typescript` (tsup).
  - [ ] Run `pnpm test` in `sdk/typescript` (vitest).
  - [ ] Run `pytest` in `sdk/python`.
