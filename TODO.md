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
- [x] **1.1. Rate Limiting Protection on Machine Routes (`developerWorkflow.routes.js`)**
  - [x] Import `rateLimiter, { RATE_LIMITS } from '../../rateLimiter/rateLimiter.middleware.js'`.
  - [x] Initialize `mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE)`.
  - [x] Wire `mutateLimiter` to all mutating routes: `create`, `update`, `remove`, `saveDraft`, `publish`, `run`, `cancel`.
- [x] **1.2. Enhance Route Parity (`developerWorkflow.routes.js`)**
  - [x] Add `GET /api/v1/developer/workflows/:workflowId/versions` -> `listVersions`.
  - [x] Add `GET /api/v1/developer/workflows/:workflowId/versions/:version` -> `getVersion`.
  - [x] Add `GET /api/v1/developer/workflows/:workflowId/mermaid` -> `getMermaid`.
  - [x] Add `GET /api/v1/developer/workflows/runs/:runId` -> `getRun` (in addition to `/:workflowId/runs/:runId`).
  - [x] Add `POST /api/v1/developer/workflows/runs/:runId/cancel` -> `mutateLimiter`, `cancel` (in addition to `/:workflowId/runs/:runId/cancel`).
  - [x] Add `GET /api/v1/developer/workflows/runs/:runId/resume` -> `resume` (SSE stream re-attachment).
  - [x] Add `POST /api/v1/developer/workflows/:workflowId/run` -> `mutateLimiter`, `run` (alias for `/:workflowId/runs` matching Studio routes).

---

### Phase 2: TypeScript SDK Types & Resource (`sdk/typescript`)
- [x] **2.1. Define TypeScript Types (`sdk/typescript/src/types/workflow.ts`)**
  - [x] Node, Edge, and Trigger types (`WorkflowNodeType`, `WorkflowNode`, `WorkflowEdge`, `WorkflowTrigger`, `WorkflowDraft`).
  - [x] Node retry policy and error handling enums (`NodeRetryPolicy`, `NodeOnErrorAction`).
  - [x] Workflow entity types (`Workflow`, `WorkflowVisibility`, `WorkflowOwnerType`).
  - [x] Workflow version snapshot types (`WorkflowVersion`, `AgentSnapshot`).
  - [x] Workflow run and execution types (`WorkflowRun`, `NodeRun`, `WorkflowRunStatus`, `NodeRunStatus`, `WorkflowUsage`).
  - [x] Input and parameter types (`CreateWorkflowInput`, `UpdateWorkflowInput`, `DiscoverWorkflowsParams`, `ListWorkflowRunsParams`, `RunWorkflowOptions`).
  - [x] Telemetry and stream event types (`WorkflowStreamEvent`, `WorkflowRunResult`).
- [x] **2.2. Implement `WorkflowsResource` (`sdk/typescript/src/resources/workflows.ts`)**
  - [x] CRUD operations: `create`, `list`, `get`, `update`, `delete`.
  - [x] Draft & Version management: `saveDraft`, `publish`, `listVersions`, `getVersion`.
  - [x] Diagram export: `getMermaid`.
  - [x] Run management: `listRuns`, `getRun`, `cancel`.
- [x] **2.3. Implement TypeScript Streaming & Execution**
  - [x] Implement `stream(workflowId, options)` using native `parseAguiEventStream`.
  - [x] Implement `resumeStream(runId, sinceSeq, signal)` for live re-attachment and frame replay.
  - [x] Implement `run(workflowId, options)` convenience aggregator (drains stream and returns `WorkflowRunResult`).
- [x] **2.4. Mount in `PersonaClient` (`sdk/typescript/src/client.ts` & `index.ts`)**
  - [x] Instantiate `this.workflows = new WorkflowsResource(this.http, workflowsLogger)`.
  - [x] Export resource and all types in `index.ts`.


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
- [x] **4.1. TypeScript SDK Vitest Tests (`sdk/typescript/test/resources/workflows.test.ts`)**
  - [x] Unit test: `create` with and without `Idempotency-Key`.
  - [x] Unit test: `list` query parameter serialization.
  - [x] Unit test: `saveDraft`, `publish`, `listVersions`, `getVersion`.
  - [x] Unit test: `getMermaid` markdown extraction.
  - [x] Unit test: `cancel` abort call.
  - [x] Streaming test: `stream` yields SSE frames with monotonic `seq`.
  - [x] Streaming test: `resumeStream` forwards `sinceSeq`.
  - [x] Aggregator test: `run` accumulates events and returns `WorkflowRunResult`.
- [ ] **4.2. Python SDK Pytest Tests (`sdk/python/tests/resources/test_workflows.py`)**

  - [ ] Sync CRUD tests via `respx`.
  - [ ] Async CRUD tests via `respx`.
  - [ ] Sync and Async SSE stream decoding tests.
  - [ ] `resume_stream` re-attachment tests.
  - [ ] High-level `run` result aggregation test.
- [x] **4.3. TypeScript Build, Docs & CI Verification**
  - [x] Run `pnpm run build` in `sdk/typescript` (tsup).
  - [x] Run `pnpm test` in `sdk/typescript` (vitest - 135 tests passing).
  - [x] Run `pnpm docs:check` in `sdk/typescript` (172 exports verified against `types.mdx`).
  - [x] Upgrade Platform documentation for `0.8.0` (`platform/content/docs/registry.json`, `_tracking.json`, `sdk/v0.8.0/`).
- [ ] **4.4. Python Build & Verification**
  - [ ] Run `pytest` in `sdk/python`.

