# Workflows SDK — Master Technical Implementation Plan

> **Target:** TypeScript SDK (`sdk/typescript`) & Python SDK (`sdk/python`)  
> **Backend Baseline:** 18 commits on `feat/ai` (`730a7662` to `e643b13d`)  
> **Directives:** [research.md](file:///D:/projects/agent-marketplace/research.md)  
> **Status:** Ready for Implementation  
> **Date:** September 2026  

---

## 1. Architectural Architecture & Goals

The goal of this implementation is to provide first-class, fully typed, resilient SDK support for **Persona Workflows** in both TypeScript and Python.

### Core Capabilities Delivered:
1. **Full Workflow Lifecycle CRUD:**
   - Create, list, retrieve, update, and delete workflow graphs.
   - Save in-progress canvas drafts (`nodes`, `edges`, `trigger`).
   - Publish immutable version snapshots.
   - Inspect version history and retrieve specific historical version snapshots.
   - Export visual workflow topologies as standard **Mermaid flowchart markdown**.
2. **Execution & Sandboxing:**
   - Run workflows synchronously with accumulated final output.
   - Stream real-time execution events via SSE (typed AG-UI telemetry).
   - Safe dry-run mode (`dryRun: true`) intercepting destructive tools with zero-balance credit bypass.
3. **Resilience & Reconnection:**
   - Re-attach to live runs and replay missed frames via `resumeStream(runId, sinceSeq)`.
   - Mid-flight run cancellation via `cancel(runId)` aborting active LLM/tool steps.
   - Run trace inspection (`getRun`, `listRuns`) with per-node duration, retries, and token metrics.
4. **Multi-Tenancy & Auth:**
   - Native integration with Project machine credentials (`Authorization: Bearer <keyId>.<secret>`).
   - Optional external user scoping (`x-persona-external-user-id`).

---

## 2. Phase 0: Backend Route Alignment & Rate Limiting (`agent-backend`)

To ensure developer machine credentials (`developerMachineAuthMiddleware`) have 100% parity with project admin endpoints and proper abuse protections, we will update `agent-backend/src/modules/developer/developerWorkflow.routes.js`:

### 2.1. Rate Limiting Protection (Missing Gap)
- Import `rateLimiter, { RATE_LIMITS } from '../../rateLimiter/rateLimiter.middleware.js'`.
- Initialize `const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE)`.
- Attach `mutateLimiter` to all mutating operations in `developerWorkflow.routes.js`:
  - `POST /` (`create`)
  - `PATCH /:workflowId` (`update`)
  - `DELETE /:workflowId` (`remove`)
  - `PUT /:workflowId/draft` (`saveDraft`)
  - `POST /:workflowId/publish` (`publish`)
  - `POST /:workflowId/runs` and `POST /:workflowId/run` (`run`)
  - `POST /runs/:runId/cancel` and `POST /:workflowId/runs/:runId/cancel` (`cancel`)

### 2.2. Route Endpoints Added to `developerWorkflow.routes.js`:
- `GET /api/v1/developer/workflows/:workflowId/versions` -> `workflowController.listVersions`
- `GET /api/v1/developer/workflows/:workflowId/versions/:version` -> `workflowController.getVersion`
- `GET /api/v1/developer/workflows/:workflowId/mermaid` -> `workflowController.getMermaid`
- `GET /api/v1/developer/workflows/runs/:runId` -> `workflowController.getRun` (in addition to `/:workflowId/runs/:runId`)
- `GET /api/v1/developer/workflows/runs/:runId/resume` -> `workflowController.resume` (SSE stream re-attachment)
- `POST /api/v1/developer/workflows/runs/:runId/cancel` -> `mutateLimiter`, `workflowController.cancel`
- `POST /api/v1/developer/workflows/:workflowId/run` -> Compatibility alias alongside `POST /:workflowId/runs` (the canonical REST collection endpoint). This ensures both callers using the Studio convention (`/:workflowId/run`) and callers using RESTful resource collection convention (`/:workflowId/runs`) work interchangeably.


---

## 3. TypeScript SDK Implementation (`sdk/typescript`)

### 3.1. Type Definitions (`sdk/typescript/src/types/workflow.ts`)

```typescript
import type { AguiEvent } from './chat.js';
import type { PaginatedResult } from './pagination.js';

export type WorkflowNodeType =
  | 'trigger'
  | 'agentStep'
  | 'knowledgeStep'
  | 'toolStep'
  | 'condition'
  | 'approval'
  | 'parallel'
  | 'join'
  | 'output';

export type WorkflowTriggerType = 'manual' | 'api' | 'webhook' | 'schedule' | 'chat';
export type WorkflowVisibility = 'private' | 'unlisted' | 'public';
export type WorkflowOwnerType = 'Project' | 'ExternalUser';
export type NodeOnErrorAction = 'fail' | 'continue' | 'routeError';

export interface NodeRetryPolicy {
  maxRetries?: number;
  backoffMs?: number;
  exponential?: boolean;
}

export interface WorkflowNodeData {
  label: string;
  description?: string;
  config?: Record<string, unknown>;
  retryPolicy?: NodeRetryPolicy;
  onError?: NodeOnErrorAction;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position?: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: unknown;
  conditionValue?: string;
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config?: Record<string, unknown>;
}

export interface WorkflowDraft {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  trigger?: WorkflowTrigger;
}

export interface Workflow {
  _id: string;
  domain: string;
  projectId?: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  visibility: WorkflowVisibility;
  ownerType: WorkflowOwnerType;
  externalOwnerId?: string | null;
  draft: WorkflowDraft;
  publishedVersion: number;
  activeRuns: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSnapshot {
  modelName: string;
  systemPrompt: string;
  tools?: string[];
}

export interface WorkflowVersion {
  _id: string;
  workflowId: string;
  projectId: string;
  version: number;
  definition: WorkflowDraft;
  agentSnapshots?: Record<string, AgentSnapshot>;
  publishedBy?: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type NodeRunStatus = 'running' | 'completed' | 'failed' | 'skipped' | 'paused';

export interface NodeRun {
  nodeId: string;
  nodeType: string;
  status: NodeRunStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  retriesTaken: number;
  durationMs: number;
  tokens: number;
  startedAt: string;
  endedAt?: string;
}

export interface WorkflowUsage {
  totalTokens: number;
  agentTurns: number;
  toolCalls: number;
  creditsDeducted: number;
}

export interface WorkflowRun {
  _id: string;
  workflowId: string;
  workflowVersion: number;
  projectId: string;
  triggeredBy: {
    type: WorkflowTriggerType;
    userId?: string;
    details?: unknown;
  };
  status: WorkflowRunStatus;
  isDryRun: boolean;
  nodeRuns: NodeRun[];
  output?: unknown;
  usage?: WorkflowUsage;
  threadId: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  visibility?: WorkflowVisibility;
  isEnabled?: boolean;
  draft?: WorkflowDraft;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  visibility?: WorkflowVisibility;
  isEnabled?: boolean;
  draft?: WorkflowDraft;
}

export interface DiscoverWorkflowsParams {
  page?: number;
  limit?: number;
  search?: string;
  scope?: 'mine' | 'public' | 'all';
  visibility?: WorkflowVisibility;
  isEnabled?: boolean;
}

export interface ListWorkflowRunsParams {
  page?: number;
  limit?: number;
  status?: WorkflowRunStatus;
  isDryRun?: boolean;
}

export interface ListWorkflowVersionsParams {
  page?: number;
  limit?: number;
}

export interface RunWorkflowOptions {
  input?: unknown;
  dryRun?: boolean;
  version?: number;
  signal?: AbortSignal;
}

export interface WorkflowRunResult {
  runId: string;
  threadId: string;
  status: WorkflowRunStatus;
  isDryRun: boolean;
  output: unknown;
  usage?: WorkflowUsage;
  nodeRuns: Record<string, NodeRun>;
  events: AguiEvent[];
}

export interface WorkflowStreamEvent extends AguiEvent {
  seq?: number;
  parentStepId?: string;
}
```

### 3.2. Workflows Resource (`sdk/typescript/src/resources/workflows.ts`)

```typescript
export class WorkflowsResource {
  constructor(private readonly http: HttpClient, private readonly logger: Logger) {}

  async create(input: CreateWorkflowInput, idempotencyKey?: string): Promise<Workflow>;
  async list(params?: DiscoverWorkflowsParams): Promise<PaginatedResult<Workflow>>;
  async get(workflowId: string): Promise<Workflow>;
  async update(workflowId: string, input: UpdateWorkflowInput): Promise<Workflow>;
  async delete(workflowId: string): Promise<{ success: boolean; message?: string }>;
  async saveDraft(workflowId: string, draft: WorkflowDraft): Promise<Workflow>;
  async publish(workflowId: string): Promise<WorkflowVersion>;
  async listVersions(workflowId: string, params?: ListWorkflowVersionsParams): Promise<PaginatedResult<WorkflowVersion>>;
  async getVersion(workflowId: string, version: number): Promise<WorkflowVersion>;
  async getMermaid(workflowId: string): Promise<{ mermaid: string }>;
  async listRuns(workflowId: string, params?: ListWorkflowRunsParams): Promise<PaginatedResult<WorkflowRun>>;
  async getRun(runId: string): Promise<WorkflowRun>;
  async cancel(runId: string): Promise<WorkflowRun>;

  // Streaming & Execution Methods:
  async *stream(workflowId: string, options?: RunWorkflowOptions): AsyncGenerator<WorkflowStreamEvent>;
  async *resumeStream(runId: string, sinceSeq?: number, signal?: AbortSignal): AsyncGenerator<WorkflowStreamEvent>;
  async run(workflowId: string, options?: RunWorkflowOptions): Promise<WorkflowRunResult>;
}
```

### 3.3. Integration into `PersonaClient`
- In `sdk/typescript/src/client.ts`:
  - Instantiate `this.workflows = new WorkflowsResource(this.http, workflowsLogger)`.
- In `sdk/typescript/src/index.ts`:
  - Re-export `WorkflowsResource` and all types from `types/workflow.js`.

---

## 4. Python SDK Implementation (`sdk/python`)

### 4.1. Type Definitions (`sdk/python/src/personaai/types/workflow.py`)

Using `typing.TypedDict` and `typing.Literal` to mirror TypeScript definitions with snake_case conventions:

- `WorkflowNodeType`: Literal strings (`'trigger'`, `'agentStep'`, etc.).
- `WorkflowNodeData`, `WorkflowNode`, `WorkflowEdge`, `WorkflowDraft`.
- `Workflow`: Dictionary containing raw MongoDB fields (`_id`, `name`, `draft`, `visibility`, etc.).
- `WorkflowVersion`: Snapshot shape.
- `NodeRun`, `WorkflowUsage`, `WorkflowRun`.
- `WorkflowRunResult`: Result container (`run_id`, `thread_id`, `status`, `is_dry_run`, `output`, `usage`, `events`).

### 4.2. Workflows & AsyncWorkflows (`sdk/python/src/personaai/resources/workflows.py`)

```python
class Workflows:
    def __init__(self, transport: SyncTransport) -> None: ...
    def create(self, input: CreateWorkflowInput, idempotency_key: str | None = None) -> Workflow: ...
    def list(self, params: DiscoverWorkflowsParams | None = None) -> PaginatedResult[Workflow]: ...
    def get(self, workflow_id: str) -> Workflow: ...
    def update(self, workflow_id: str, input: UpdateWorkflowInput) -> Workflow: ...
    def delete(self, workflow_id: str) -> dict[str, Any]: ...
    def save_draft(self, workflow_id: str, draft: WorkflowDraft) -> Workflow: ...
    def publish(self, workflow_id: str) -> WorkflowVersion: ...
    def list_versions(self, workflow_id: str, params: ListWorkflowVersionsParams | None = None) -> PaginatedResult[WorkflowVersion]: ...
    def get_version(self, workflow_id: str, version: int) -> WorkflowVersion: ...
    def get_mermaid(self, workflow_id: str) -> dict[str, str]: ...
    def list_runs(self, workflow_id: str, params: ListWorkflowRunsParams | None = None) -> PaginatedResult[WorkflowRun]: ...
    def get_run(self, run_id: str) -> WorkflowRun: ...
    def cancel(self, run_id: str) -> WorkflowRun: ...
    
    # Streaming & Run helpers:
    def stream(self, workflow_id: str, input: Any = None, *, dry_run: bool = False, version: int | None = None) -> Iterator[AguiEvent]: ...
    def resume_stream(self, run_id: str, since_seq: int = 0) -> Iterator[AguiEvent]: ...
    def run(self, workflow_id: str, input: Any = None, *, dry_run: bool = False, version: int | None = None) -> WorkflowRunResult: ...


class AsyncWorkflows:
    def __init__(self, transport: AsyncTransport) -> None: ...
    async def create(self, input: CreateWorkflowInput, idempotency_key: str | None = None) -> Workflow: ...
    # ... async versions of all above methods ...
    async def stream(self, workflow_id: str, input: Any = None, *, dry_run: bool = False, version: int | None = None) -> AsyncIterator[AguiEvent]: ...
    async def resume_stream(self, run_id: str, since_seq: int = 0) -> AsyncIterator[AguiEvent]: ...
    async def run(self, workflow_id: str, input: Any = None, *, dry_run: bool = False, version: int | None = None) -> WorkflowRunResult: ...
```

### 4.3. Integration into PersonaClient & AsyncPersonaClient
- `PersonaClient.workflows` in `sdk/python/src/personaai/client.py`.
- `AsyncPersonaClient.workflows` in `sdk/python/src/personaai/async_client.py`.
- Barrel re-exports in `sdk/python/src/personaai/__init__.py`.

---

## 5. Testing & Verification Strategy

### 5.1. TypeScript SDK Test Suite (`sdk/typescript/test/resources/workflows.test.ts`)
- Mock `fetch` responses using `vi.fn()`:
  1. `create()` sends POST to `/api/v1/developer/workflows` with body and optional `Idempotency-Key`.
  2. `list()` forwards pagination & filter query params.
  3. `saveDraft()` and `publish()` verify payload and return shape.
  4. `getMermaid()` retrieves diagram markdown.
  5. `cancel()` POSTs to `/api/v1/developer/workflows/runs/:runId/cancel`.
  6. `stream()` yields parsed AG-UI events with monotonic `seq` and `parentStepId`.
  7. `resumeStream()` sends query `sinceSeq` and streams replayed frames.
  8. `run()` drains stream and accumulates node runs and final output.

### 5.2. Python SDK Test Suite (`sdk/python/tests/resources/test_workflows.py`)
- Sync and Async testing via `respx` and `pytest`:
  1. CRUD test assertions for `client.workflows.*` and `async_client.workflows.*`.
  2. Streaming test asserting `decode_frame` yields AG-UI events correctly.
  3. `resume_stream` re-attachment test.
  4. High-level `run` aggregation test.

### 5.3. Build & Typecheck
- TypeScript: `pnpm run build` (tsup) and `pnpm test` (vitest).
- Python: `pytest` with `pytest-asyncio`.
