# Workflows SDK — Backend Architecture Analysis & Implementation Research

> **Target:** TypeScript SDK (`sdk/typescript`) & Python SDK (`sdk/python`)  
> **Backend Baseline:** 18 commits on `feat/ai` (`730a7662` to `e643b13d`)  
> **Status:** Complete Technical Research & Architectural Specification  
> **Date:** September 2026  

---

## 1. Executive Summary

The persona.hasanraiyan.me platform introduces **Workflows**: a multi-agent orchestration engine compiling visual DAGs into LangGraph `StateGraph` workflows executed on Node.js 22, persisted to MongoDB (`MongoDBSaver`), and monitored via the **AG-UI protocol** with real-time Server-Sent Events (SSE).

This document analyzes the 18 commits implementing the workflow backend engine and provides the technical blueprint for the **Workflows SDK** across the **TypeScript SDK** (`@personaai/sdk`) and **Python SDK** (`persona-agent-sdk`).

### Key Constraints & Architecture Guardrails
* **Zero Redis:** All workflow state, checkpoints (`checkpoints`, `checkpoint_writes`), and background recovery queues (`agendaJobs`) operate exclusively on **MongoDB 9**.
* **Unified Telemetry:** Zero parallel streaming protocols. Streaming uses the established **AG-UI protocol** (`@ag-ui/core`) via `EventType.CUSTOM` events (`workflow_node_started`, `workflow_node_completed`, `workflow_node_failed`) and standard lifecycle events (`RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`).
* **Monotonic Sequence (`seq`) Framing:** Every SSE frame buffered by `WorkflowRunDriver` carries a strictly increasing integer sequence ID (`seq`), enabling reliable stream reconnection via `sinceSeq`.
* **Dual-Language Parity:** Complete feature parity between TypeScript (native `fetch`, async generators) and Python (`httpx`, sync `Iterator` and `AsyncIterator`).
* **Tenancy & Scoping:** Workflows support Project machine credentials (`Authorization: Bearer <keyId>.<secret>`) with optional end-user scoping via `x-persona-external-user-id`.

---

## 2. Deep Dive: Analysis of the 18 Backend Commits on `feat/ai`

The workflow feature was developed across 18 sequential commits on `feat/ai`. Below is the architectural audit of each commit and its implications for the SDK:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           18-COMMIT WORKFLOW ENGINE PROGRESSION                                │
├────┬──────────┬───────────────────────────────────────────┬────────────────────────────────────┤
│ #  │ Commit   │ Summary                                   │ SDK Impact / Surface               │
├────┼──────────┼───────────────────────────────────────────┼────────────────────────────────────┤
│ 1  │ 730a7662 │ Draft feature spec for Studio Workflows   │ Defines Core Entities & UX goals   │
│ 2  │ 33aafdcb │ Workflows engine research & Mermaid spec  │ Identifies Mermaid Export & DAG    │
│ 3  │ 9c6a448c │ Source citations & file links             │ Grounding in existing codebase     │
│ 4  │ 54de95c2 │ AG-UI events & Mongo concurrency notes    │ Sequence IDs & Mongo concurrency   │
│ 5  │ b0ce5f39 │ Rewrite TODO as Engine & Builder plan     │ Master delivery phases             │
│ 6  │ de93c405 │ Expand roadmap: resilience, metering      │ Retry policies, credit deductions  │
│ 7  │ 2d606275 │ Clarify dry-run API shape & cancellation  │ `isDryRun` flag & cancel endpoint  │
│ 8  │ 7e0198ce │ Mark Phase 1 backend tasks as completed   │ Initial models & controller        │
│ 9  │ bc621e94 │ External user scoping & machine routes    │ Mounts /api/v1/developer/workflows │
│ 10 │ e39cdf0e │ Auth fix, dry-run MCP stripping, tools    │ Direct tool steps without LLM turn │
│ 11 │ df7f2270 │ Resume orphaned runs from checkpoints     │ `resume` endpoint & sinceSeq       │
│ 12 │ 9f1234d0 │ Pass 'MUTATE' key to rateLimiter          │ 429 Retry handling on mutations    │
│ 13 │ 7704cb52 │ Platform: React 310 hook fix              │ Platform UI only                   │
│ 14 │ 6f2dd177 │ Platform: shadcn/ui Select component      │ Platform UI only                   │
│ 15 │ 12679b65 │ Platform: prevent trigger node deletion   │ Visual canvas constraint           │
│ 16 │ 004471d7 │ Platform: extract shared node styles      │ Visual canvas styling              │
│ 17 │ 7b343840 │ Structured logging to controller/service  │ Diagnostic log correlation         │
│ 18 │ e643b13d │ Fix agent output loss in nested checkpoints│ AgentStep final text aggregation   │
└────┴──────────┴───────────────────────────────────────────┴────────────────────────────────────┘
```

### Key Commit Highlights & Technical Takeaways

1. **Commit `bc621e94` (External User Scoping & Developer Machine Routes):**
   - Introduced `agent-backend/src/modules/developer/developerWorkflow.routes.js`.
   - Authenticated via `developerMachineAuthMiddleware` using Project key/secret bearer token.
   - Added `ownerType: 'Project' | 'ExternalUser'` and `externalOwnerId`.
   - Endpoints accept `x-persona-external-user-id` to run or manage workflows on behalf of end users.
   - **Critical Finding:** The initial `developerWorkflow.routes.js` mounted at `/api/v1/developer/workflows` implemented core CRUD and run, but lacked explicit routes for `versions`, `mermaid`, and `resume` that were present on the admin `workflow.routes.js`. The SDK plan must align these routes so developer machine credentials have full access.

2. **Commit `e39cdf0e` (Tool Step Execution & Dry-Run Interception):**
   - Implemented direct tool execution (`ToolStepNode`) without requiring an LLM turn.
   - In dry-run mode (`dryRun: true` or `isDryRun: true`), destructive tool calls (database mutations, external HTTP requests, emails) are automatically intercepted and replaced with mock responses.
   - Pre-flight credit checks and balance deductions are bypassed when `dryRun` is enabled.

3. **Commit `df7f2270` (Checkpoint Resume & Orphan Recovery):**
   - Established MongoDB checkpointing via `MongoDBSaver`.
   - Created `WorkflowRunDriver` for in-memory SSE frame buffering with sequence IDs (`seq`).
   - Added `GET /runs/:runId/resume?sinceSeq=<N>` enabling callers to re-attach to disconnected runs and replay missed telemetry.

4. **Commit `e643b13d` (Agent Output Preservation):**
   - Solved a LangGraph checkpoint namespace bug where nested subagent execution states could mask the main agent step output.
   - Guaranteed that `workflow_node_completed` and `RUN_FINISHED` always deliver the final accumulated text and tool outputs.

---

## 3. Backend REST & Streaming API Specification

The Workflows SDK interacts with the backend through the Developer Machine API (`/api/v1/developer/workflows`).

### 3.1. Authentication & Common Headers
- `Authorization`: `Bearer <keyId>.<secret>` (Required for all developer endpoints).
- `x-persona-external-user-id`: Optional string asserting the end-user identity.
- `Content-Type`: `application/json` (for mutation requests).
- `Accept`: `application/json` (standard) or `text/event-stream` (for SSE streaming).
- `Idempotency-Key`: Optional string header for idempotent workflow creation.

### 3.2. Route Matrix

| Method | Path | Query / Body Params | Response Shape | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/developer/workflows` | `page`, `limit`, `search`, `scope`, `visibility`, `isEnabled` | `{ success: true, data: { items: Workflow[], pagination } }` | List visible workflows |
| `POST` | `/api/v1/developer/workflows` | `{ name, description?, visibility?, draft?, isEnabled? }` | `{ success: true, data: Workflow }` (201) | Create a new workflow |
| `GET` | `/api/v1/developer/workflows/:workflowId` | — | `{ success: true, data: Workflow }` | Get workflow definition & draft |
| `PATCH` | `/api/v1/developer/workflows/:workflowId` | `{ name?, description?, visibility?, draft?, isEnabled? }` | `{ success: true, data: Workflow }` | Partially update metadata/draft |
| `DELETE` | `/api/v1/developer/workflows/:workflowId` | — | `{ success: true, message: string }` | Soft/hard delete workflow |
| `PUT` | `/api/v1/developer/workflows/:workflowId/draft` | `{ draft: { nodes, edges, trigger } }` | `{ success: true, data: Workflow }` | Save visual canvas draft |
| `POST` | `/api/v1/developer/workflows/:workflowId/publish` | — | `{ success: true, data: WorkflowVersion }` (201) | Publish immutable version snapshot |
| `GET` | `/api/v1/developer/workflows/:workflowId/versions` | `page`, `limit` | `{ success: true, data: { items: WorkflowVersion[], pagination } }` | List published versions |
| `GET` | `/api/v1/developer/workflows/:workflowId/versions/:version` | — | `{ success: true, data: WorkflowVersion }` | Get version snapshot details |
| `GET` | `/api/v1/developer/workflows/:workflowId/mermaid` | — | `{ success: true, data: { mermaid: string } }` | Export DAG as Mermaid flowchart |
| `POST` | `/api/v1/developer/workflows/:workflowId/runs` | `{ input?, dryRun?, isDryRun?, version?, stream? }` | JSON `{ runId, status, ... }` (201) OR `text/event-stream` (200) | Trigger workflow execution (canonical REST path) |
| `POST` | `/api/v1/developer/workflows/:workflowId/run` | `{ input?, dryRun?, isDryRun?, version?, stream? }` | JSON `{ runId, status, ... }` (201) OR `text/event-stream` (200) | Compatibility alias matching Studio `workflow.routes.js` |
| `GET` | `/api/v1/developer/workflows/:workflowId/runs` | `page`, `limit`, `status`, `isDryRun` | `{ success: true, data: { items: WorkflowRun[], pagination } }` | List historical runs |
| `GET` | `/api/v1/developer/workflows/runs/:runId` | — | `{ success: true, data: WorkflowRun }` | Get run trace and node metrics |
| `POST` | `/api/v1/developer/workflows/runs/:runId/cancel` | — | `{ success: true, data: WorkflowRun }` | Abort an in-flight workflow run |
| `GET` | `/api/v1/developer/workflows/runs/:runId/resume` | `sinceSeq` (integer, default 0) | `text/event-stream` | Re-attach to running stream |

> [!IMPORTANT]
> **Audit Finding (Rate Limiting on Developer Machine Routes):**  
> While the admin routes in `workflow.routes.js` wrap mutations in `mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE)`, the machine-credential routes in `developerWorkflow.routes.js` currently have **zero rate limiting middleware**. Because developer machine credentials represent automated external clients, wiring `mutateLimiter` into `developerWorkflow.routes.js` is an essential backend prerequisite in Phase 1 before public SDK release.

---

## 4. AG-UI Protocol & Workflow Event Streaming

When triggering a run with `Accept: text/event-stream` or resuming via `sinceSeq`, the backend streams standard AG-UI events.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW RUN SSE FRAME LIFECYCLE                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                     data: {"type": "RUN_STARTED", "seq": 1, ...}
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
data: {"type": "CUSTOM",                               data: {"type": "CUSTOM",
       "name": "workflow_node_started",                       "name": "workflow_node_started",
       "value": {"nodeId": "step1", ...},                     "value": {"nodeId": "step2", ...},
       "seq": 2}                                              "seq": 6}
        │                                                             │
        ▼                                                             ▼
data: {"type": "TEXT_MESSAGE_CHUNK",                   data: {"type": "TOOL_CALL_RESULT",
       "delta": "Hello ",                                     "parentStepId": "step2",
       "parentStepId": "step1",                               "seq": 7}
       "seq": 3}                                                      │
        │                                                             ▼
        ▼                                              data: {"type": "CUSTOM",
data: {"type": "CUSTOM",                                      "name": "workflow_node_completed",
       "name": "workflow_node_completed",                     "value": {"nodeId": "step2", ...},
       "value": {"nodeId": "step1", ...},                     "seq": 8}
       "seq": 5}                                                      │
        │                                                             │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
                     data: {"type": "RUN_FINISHED", "seq": 9, ...}
```

### Event Definitions

1. **`RUN_STARTED`**:
   ```json
   {
     "type": "RUN_STARTED",
     "runId": "66e2c34a...",
     "threadId": "wf_thread_66e2c34a...",
     "isDryRun": false,
     "timestamp": "2026-09-12T10:00:00.000Z",
     "seq": 1
   }
   ```

2. **`CUSTOM` (`workflow_node_started`)**:
   ```json
   {
     "type": "CUSTOM",
     "name": "workflow_node_started",
     "value": {
       "nodeId": "agent_analyst",
       "nodeType": "agentStep",
       "nodeLabel": "Market Analyst",
       "input": { "topic": "AI Trends" },
       "timestamp": "2026-09-12T10:00:01.000Z"
     },
     "seq": 2
   }
   ```

3. **Child Telemetry Events** (`TEXT_MESSAGE_CHUNK`, `TOOL_CALL_START`, `TOOL_CALL_RESULT`, `REASONING`):
   - Emitted during agent step execution.
   - Tagged with `parentStepId: "<nodeId>"`.
   - Assigned the next monotonic `seq`.

4. **`CUSTOM` (`workflow_node_completed`)**:
   ```json
   {
     "type": "CUSTOM",
     "name": "workflow_node_completed",
     "value": {
       "nodeId": "agent_analyst",
       "output": { "analysis": "Strong growth in agent architectures..." },
       "retriesTaken": 0,
       "durationMs": 3420,
       "tokens": 850,
       "timestamp": "2026-09-12T10:00:04.420Z"
     },
     "seq": 15
   }
   ```

5. **`CUSTOM` (`workflow_node_failed`)**:
   ```json
   {
     "type": "CUSTOM",
     "name": "workflow_node_failed",
     "value": {
       "nodeId": "rest_fetch",
       "error": "HTTP 503 Service Unavailable",
       "timestamp": "2026-09-12T10:00:05.100Z"
     },
     "seq": 16
   }
   ```

6. **`RUN_FINISHED`**:
   ```json
   {
     "type": "RUN_FINISHED",
     "runId": "66e2c34a...",
     "output": { "finalSummary": "..." },
     "usage": {
       "totalTokens": 1420,
       "agentTurns": 2,
       "toolCalls": 3,
       "creditsDeducted": 14
     },
     "timestamp": "2026-09-12T10:00:06.000Z",
     "seq": 17
   }
   ```

7. **`RUN_ERROR`**:
   ```json
   {
     "type": "RUN_ERROR",
     "code": "EXECUTION_CANCELLED",
     "message": "Workflow execution cancelled by user",
     "seq": 18
   }
   ```

---

## 5. SDK Architecture Comparison & Patterns

The repository maintains strict conventions across both SDK packages:

### TypeScript SDK (`sdk/typescript`)
- **Package:** `@personaai/sdk`
- **Tooling:** TypeScript, `tsup`, Vitest. Zero heavy external dependencies (native `fetch`, Web Streams).
- **Client Mounting:** `client.workflows` on `PersonaClient` (`src/client.ts`).
- **Resource Pattern:** Class `WorkflowsResource` in `src/resources/workflows.ts`.
- **Options Bags:** Methods take typed option interfaces (`CreateWorkflowInput`, `RunWorkflowOptions`).
- **Streaming:** Returns `AsyncGenerator<AguiEvent | WorkflowStreamEvent>`.

### Python SDK (`sdk/python`)
- **Package:** `persona-agent-sdk` (PyPI)
- **Tooling:** Python 3.10+, `hatchling`, `httpx`, `pytest`, `respx`.
- **Client Mounting:**
  - `client.workflows` on `PersonaClient` (`personaai/client.py`) -> Sync `Workflows`.
  - `client.workflows` on `AsyncPersonaClient` (`personaai/async_client.py`) -> Async `AsyncWorkflows`.
- **Resource Pattern:** Classes `Workflows` and `AsyncWorkflows` co-located in `personaai/resources/workflows.py`.
- **Argument Pattern:** Direct positional and keyword arguments matching Python conventions.
- **Streaming:**
  - Sync: `Iterator[AguiEvent]`.
  - Async: `AsyncIterator[AguiEvent]`.

---

## 6. Edge Cases & Resilience Engineering

1. **Rate Limiting & Mutate Limits (Current Gap & SDK Requirement):**
   - **Backend Status:** Currently, `developerWorkflow.routes.js` lacks rate limiting middleware, unlike `workflow.routes.js` which uses `mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE)`. Phase 1 of the implementation adds `mutateLimiter` to all mutating machine endpoints (`create`, `update`, `remove`, `saveDraft`, `publish`, `run`, `cancel`).
   - **SDK Resilience:** Once active, the SDK HTTP transports (`HttpClient` in TS, `SyncTransport`/`AsyncTransport` in Python) automatically intercept `429 Too Many Requests` responses, parse the server's `Retry-After` header, and retry up to `maxRetries` (default: 2) with backoff before raising a typed `RateLimitError`.

2. **Network Drops Mid-Run:**
   - The backend `WorkflowRunDriver` retains buffered frames in memory for 5 minutes after completion.
   - If the client connection drops, the SDK caller can call `client.workflows.resumeStream(runId, sinceSeq)` to seamlessly replay missed frames without restarting the run.

3. **Mid-Flight Cancellation:**
   - `client.workflows.cancel(runId)` sends a POST request to `/api/v1/developer/workflows/runs/:runId/cancel`.
   - The backend triggers the driver's `AbortController`, which interrupts any in-progress LLM calls, emits `RUN_ERROR` with code `EXECUTION_CANCELLED`, and sets MongoDB status to `cancelled`.

4. **Dry-Run Sandbox Testing:**
   - Passing `dryRun: true` allows safe validation of complex workflows.
   - Destructive tool steps are stubbed with mock success values, and Project credit balances are untouched.
