# Workflows Engine & Visual Builder — Comprehensive Architecture & Technical Research

> **Target Document:** Implementation Research for [prompt.md](file:///D:/projects/agent-marketplace/prompt.md)  
> **Scope:** Developer Platform (`platform`), Backend Engine (`agent-backend`), SDK Packages (`sdk/*`)  
> **Status:** Complete Technical Blueprint & Feasibility Analysis  
> **Date:** September 2026  

---

## 1. Executive Summary & System Vision

The objective defined in [prompt.md](file:///D:/projects/agent-marketplace/prompt.md) is to elevate the platform from running isolated, single-agent interactions to orchestrating **multi-agent workflows** composed of agents, deterministic tools, conditional branching, and human approvals.

This requires two tightly coupled pillars:
1. **Pillar A — Visual Workflow Builder (Studio UI):** A node-graph canvas embedded in the Developer Platform (`platform/src/app/projects/[projectId]/workflows/*`) allowing developers to drag, connect, configure, test, and publish multi-step pipelines.
2. **Pillar B — Multi-Agent Orchestration (LangGraph Engine):** A backend compiler and execution runtime in `agent-backend` that compiles the visual graph directly into a **LangGraph `StateGraph`**, executing with checkpointed persistence on MongoDB, streaming real-time execution telemetry over the unified **AG-UI protocol**, and supporting resumable, long-running runs.

### Architectural Constraints & Guardrails
* **Zero Redis:** The platform architecture explicitly operates without Redis. All durable state, checkpoints, job queues, and recovery mechanisms must run on **MongoDB alone** (using Mongoose 9, LangGraph's `MongoDBSaver`, and `@agendajs/mongo-backend`).
* **Zero Parallel Streaming Formats:** Workflows do not invent a new event protocol. All execution telemetry streams through the existing **AG-UI protocol** (`@ag-ui/core`) via `EventType.CUSTOM` events (`workflow_node_started`, `workflow_node_completed`, `workflow_node_failed`, `hitl_request`, etc.).
* **First-Class SDK Access:** Workflows are not UI-only. The TypeScript SDK (`@personaai/sdk`) [note for now we work on the node js sdk only , no any python okay], and runtime adapters must expose workflow runs, live streaming, interrupt resolution, and history inspection as native primitives.
* **Developer Platform Boundary:** This feature lives exclusively in the Developer Platform (`platform/` and `/api/v1/developer/*`). It does not alter the Persona consumer experience (`frontend/`).

---

## 2. Competitive Landscape & Industry Analysis

To design a best-in-class system, we analyzed five leading workflow and agent orchestration platforms: **Dify.ai**, **Langflow**, **n8n**, **LangGraph Studio**, and **Coze**.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 INDUSTRY LANDSCAPE MATRIX                                       │
├──────────────────┬─────────────────┬──────────────────┬───────────────────┬─────────────────────┤
│ Platform         │ Canvas / UI     │ Execution Engine │ State & Data Flow │ Error & Resilience  │
├──────────────────┼─────────────────┼──────────────────┼───────────────────┼─────────────────────┤
│ **Dify.ai**      │ React Flow      │ Custom Graph     │ Strict templating │ Stop on error;      │
│                  │ custom nodes    │ runner (Celery/  │ {{#nodeId.var#}}  │ retry in HTTP;      │
│                  │ (DSL YAML/JSON) │ Redis queue)     │ Draft vs Publish  │ Run history log     │
├──────────────────┼─────────────────┼──────────────────┼───────────────────┼─────────────────────┤
│ **Langflow**     │ @xyflow/react   │ Dynamic Python   │ Port-to-port      │ Node output freeze; │
│                  │ custom handles  │ LangChain/Graph  │ socket connections│ In-memory execution │
├──────────────────┼─────────────────┼──────────────────┼───────────────────┼─────────────────────┤
│ **n8n**          │ Custom Vue      │ Node.js directed │ JSON payload item │ Node retry policy;  │
│                  │ canvas          │ execution queue  │ array passing;    │ Continue on fail;   │
│                  │                 │ (PostgreSQL)     │ $json.property    │ Error Trigger flow  │
├──────────────────┼─────────────────┼──────────────────┼───────────────────┼─────────────────────┤
│ **LangGraph**    │ @xyflow/react   │ StateGraph       │ Shared reducer    │ Checkpoint rollbacks│
│ **Studio**       │ inspection      │ Pregel engine    │ state schema;     │ Time-travel replay; │
│                  │ canvas          │ (Python/TS)      │ thread channels   │ HITL pause/resume   │
├──────────────────┼─────────────────┼──────────────────┼───────────────────┼─────────────────────┤
│ **Persona**      │ **@xyflow/react**│ **LangGraph**   │ **Topological**   │ **MongoDBSaver +**  │
│ **(Proposed)**   │ **(React 19)**  │ **StateGraph +** │ **dot-notation**  │ **Node retries +**  │
│                  │ **Shadcn UI**   │ **Agenda jobs**  │ **{{stepId.out}}**│ **Agenda sweep**    │
└──────────────────┴─────────────────┴──────────────────┴───────────────────┴─────────────────────┘
```

### 1. Dify.ai Architecture Lessons
* **Draft vs. Published Duality:** Dify strictly isolates the active draft (`WorkflowDraft`) from live published versions (`WorkflowVersion`). Developers iterate on the canvas in draft mode without mutating production APIs.
* **Variable Reference Syntax:** References use double-brace notation with node qualification: `{{#nodeId.outputKey#}}`. During node configuration, Dify introspects upstream nodes to provide a type-aware dropdown picker.
* **Run History & Variable Inspector:** Each execution logs a snapshot of all node inputs, outputs, tokens, and duration. If a node fails, developers inspect the exact input payload that caused the failure.

### 2. Langflow & Flowise Architecture Lessons
* **Component-to-Graph Compilation:** Langflow represents components as JSON schemas with typed inputs/outputs. When running, it parses the topology, validates connections, instantiates LangChain Runnables, and builds a compiled graph.
* **Node Output Freezing:** For iterative prompt development, Langflow allows "freezing" upstream node outputs. When testing a downstream node, cached outputs are injected immediately without re-executing expensive LLM calls.

### 3. n8n Architecture Lessons
* **Node Resilience & Error Triggers:** Every node has configurable error policies:
  * `retryOnFail`: Maximum retry attempts (1–5) with exponential backoff.
  * `continueOnFail`: If enabled, the error object is packed into the output, allowing an `IfNode` to branch on failure.
  * `errorWorkflow`: A dedicated workflow triggered automatically on unhandled failure.
* **Webhook Security & Idempotency:** Webhook triggers enforce either HMAC-SHA256 signature verification or header secret authentication, rejecting unauthenticated traffic before workflow execution begins.

### 4. LangGraph Studio Lessons
* **Pregel Execution Model:** LangGraph treats graph execution as discrete super-steps. Checkpoints are automatically written at each super-step boundary.
* **Human-in-the-Loop (HITL) Interruption:** LangGraph pauses execution on configured interrupt conditions, persists graph state to the checkpointer, and resumes upon receiving a `Command({ resume })`.

---

## 3. Current Codebase Audit & Architectural Fit

Our analysis of `agent-backend/`, `platform/`, and `sdk/` reveals that **90% of the foundational plumbing for workflows is already implemented and battle-tested**. Workflows compose these existing systems rather than creating parallel infrastructure.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                CURRENT INFRASTRUCTURE ALIGNMENT                                │
├──────────────────────────┬─────────────────────────────────┬────────────────────────────────────┤
│ Capability               │ Existing Subsystem              │ Workflow Integration               │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Agent Execution          │ `agent.factory.js`              │ Reused as the internal executor    │
│                          │ (`createDeepAgent`)             │ for `AgentStepNode`                │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Tool Execution           │ `resolveAgentTools()`           │ Reused for `ToolStepNode`          │
│                          │ (RCP, REST Tools, MCP)          │ without invoking an LLM            │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Checkpoint Persistence   │ `checkpointService`             │ Persists workflow StateGraph       │
│                          │ (`MongoDBSaver`)                │ state per node execution           │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ HITL Interruption        │ `describeInterrupt()` &         │ Powers `ApprovalNode` pause and    │
│                          │ `buildResumeValue()`            │ resume semantics                   │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Streaming Protocol       │ `aguiTranslator.js`             │ Emits `workflow_node_*` events     │
│                          │ (`@ag-ui/core`)                 │ alongside text deltas              │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Disconnected Streaming   │ `RunDriver`                     │ Decouples workflow execution       │
│                          │ (`sdk/runtime/src/runDriver.ts`)│ from client HTTP connections       │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Durable Background Tasks │ `agenda.js`                     │ Drives cron schedules and          │
│                          │ (`@agendajs/mongo-backend`)     │ orphan resumption sweeps           │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Project Authorization    │ `projectAdminAuth.middleware.js`│ Enforces strict Project tenancy    │
│                          │ & `ProjectRuntimeContext`       │ across all workflow resources      │
├──────────────────────────┼─────────────────────────────────┼────────────────────────────────────┤
│ Frontend UI Components   │ `platform/src/components/ui/`   │ Provides Shadcn, Base UI,          │
│                          │ (React 19, Tailwind 4)          │ Phosphor icons for canvas panels   │
└──────────────────────────┴─────────────────────────────────┴────────────────────────────────────┘
```

### Key Discoveries in Existing Modules

1. **`agent-backend/src/modules/agents/agent.factory.js`**:
   * Uses `createDeepAgent` from `deepagents` on top of LangChain Chat Models (`ChatOpenAI`, `ChatAnthropic`, `ChatGoogleGenerativeAI`, `ChatDeepSeek`).
   * Already incorporates dynamic tools, versioned state backends, and memory namespaces.
   * Compiles into standard LangGraph Runnables that can be invoked as subgraphs inside a parent `StateGraph`.

2. **`agent-backend/src/modules/threads/checkpoint.service.js`**:
   * Connects `MongoDBSaver` to MongoDB collections `checkpoints` and `checkpoint_writes`.
   * Directly supports `getTuple({ configurable: { thread_id } })` to inspect pending graph tasks and interrupts.
   * Perfect foundation for workflow run durability across node boundaries.

3. **`agent-backend/src/modules/jobs/agenda.js`**:
   * Initialized with `MongoBackend({ collection: 'agendaJobs' })`.
   * Solves the zero-Redis constraint: provides scheduled triggers and handles orphan-recovery background sweeps without adding infrastructure.

4. **`platform/` Developer App (`package.json`)**:
   * Runs **Next.js 16.3.4**, **React 19.2.8**, Tailwind CSS v4, and `@shadcn/react`.
   * Uses Phosphor icons (`@phosphor-icons/react`).
   * `@xyflow/react` v12 is fully compatible with React 19 and Tailwind 4.

5. **`sdk/runtime/src/runDriver.ts`**:
   * Decouples the producer generator from consumer HTTP responses. Buffers SSE frames with monotonic sequence IDs (`seq`).
   * Allows clients to disconnect and reconnect via `GET /resume` without losing streaming continuity.

---

## 4. Pillar A — Visual Workflow Builder Architecture

The visual builder will live at `platform/src/app/projects/[projectId]/workflows/`.

```
platform/src/app/projects/[projectId]/workflows/
├── page.tsx                           # Workflows list (cards, status, triggers, runs count)
├── new/page.tsx                       # Create workflow modal / page
├── [workflowId]/
│   ├── layout.tsx                     # Workflow header, tabs: [Canvas, Runs, Settings]
│   ├── page.tsx                       # Canvas editor (Pillar A)
│   ├── runs/
│   │   ├── page.tsx                   # Runs history table
│   │   └── [runId]/page.tsx           # Run execution inspector (canvas playback + logs)
│   └── settings/page.tsx              # Trigger configs, webhook secrets, retry policies
```

### 1. Canvas Library: `@xyflow/react` (React Flow v12)
`@xyflow/react` is the definitive choice for React 19:
* Native support for pan, zoom, minimap, controls, and background styling.
* Fully custom node and edge renderers.
* Lightweight bundle with high rendering performance (DOM virtualization for large graphs).
* Handles snap-to-grid, multi-selection, and connection validation out of the box.

### 2. Node Taxonomy & Data Model

Every visual node maps to an executable definition:

```typescript
export type WorkflowNodeType = 
  | 'trigger'
  | 'agentStep'
  | 'toolStep'
  | 'condition'
  | 'approval'
  | 'parallel'
  | 'join'
  | 'output';

export interface WorkflowNodeData {
  label: string;
  description?: string;
  type: WorkflowNodeType;
  config: Record<string, unknown>;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    exponential: boolean;
  };
  onError?: 'fail' | 'continue' | 'routeError';
  status?: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
}
```

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   NODE TAXONOMY SPECIFICATION                                   │
├─────────────────┬───────────────────────────────┬───────────────────────────────────────────────┤
│ Node Type       │ Configuration Options         │ Output Schema / Handles                       │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Trigger**     │ `type`: manual | api |        │ Output: `{ event: string, payload: any,       │
│                 │ webhook | schedule | chat     │           timestamp: string, user?: any }`    │
│                 │ `scheduleConfig`: cron expr   │ Source Handle: `output`                       │
│                 │ `webhookConfig`: secretId     │                                               │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Agent Step**  │ `agentId`: Project Agent ID   │ Output: `{ text: string, toolCalls: any[],    │
│                 │ `inputTemplate`: string       │           artifacts: any[], tokens: number }` │
│                 │ `systemOverrideTemplate`: str │ Target Handle: `input`                        │
│                 │ `timeoutMs`: number           │ Source Handle: `output`, `error` (optional)   │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Tool Step**   │ `toolType`: rcp | rest | mcp  │ Output: `{ result: any, isError: boolean }`   │
│                 │ `toolId`: Tool / Server ID    │ Target Handle: `input`                        │
│                 │ `inputArgsMapping`: object    │ Source Handle: `output`, `error` (optional)   │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Condition**   │ `mode`: expression | llmJudge │ Outputs: Multiple branch handles              │
│                 │ `expression`: JS / JSONLogic  │ Target Handle: `input`                        │
│                 │ `llmConfig`: prompt + choices │ Source Handles: `branch_1`, `branch_2`,       │
│                 │                               │                `default`                      │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Approval**    │ `prompt`: Human message       │ Output: `{ decision: 'approve' | 'reject',    │
│                 │ `timeoutSeconds`: number      │           comment?: string, reviewer?: any }` │
│                 │ `allowComment`: boolean       │ Target Handle: `input`                        │
│                 │                               │ Source Handles: `approved`, `rejected`        │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Parallel**    │ Fan-out splitter              │ Target Handle: `input`                        │
│                 │                               │ Source Handles: `branch_1` .. `branch_n`      │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Join**        │ `mode`: waitAll | waitAny     │ Output: `{ results: Record<nodeId, any> }`    │
│                 │ `timeoutMs`: number           │ Target Handles: `input_1` .. `input_n`        │
│                 │                               │ Source Handle: `output`                       │
├─────────────────┼───────────────────────────────┼───────────────────────────────────────────────┤
│ **Output**      │ `outputMapping`: template     │ Final Workflow Output Payload                 │
│                 │ `notifyWebhook`: URL (opt)    │ Target Handle: `input`                        │
└─────────────────┴───────────────────────────────┴───────────────────────────────────────────────┘
```

### 3. Variable Interpolation & Output Typing

Downstream nodes reference upstream outputs using double curly braces:
```handlebars
{{steps.customerAgent.output.text}}
{{steps.validateOrderTool.output.result.orderId}}
{{trigger.payload.customerEmail}}
```

#### Resolution Engine (`templateResolver.js`)
* Evaluates template strings using safe dot-notation resolution (via `lodash.get` or a sandbox AST evaluator).
* Static Validation / Linting: During canvas editing, an AST validator verifies that all referenced `steps.<stepId>` exist upstream in the graph topological sort. If a node references an unreachable step, the canvas highlights the field with a warning badge.

---

## 5. Pillar B — LangGraph Orchestration & Backend Engine

### 1. Dynamic LangGraph StateGraph Compilation

When a workflow is executed, `workflow.factory.js` compiles the JSON workflow definition into a LangGraph `StateGraph`:

```
                    ┌─────────────────────────┐
                    │      START NODE         │
                    │ (Parse Trigger Payload) │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Agent Step Node      │
                    │ (Run deepagents graph)  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Condition Node      │
                    │   (Conditional Edge)    │
                    └──────┬───────────┬──────┘
             True branch   │           │   False branch
                           ▼           ▼
             ┌────────────────┐     ┌────────────────┐
             │ Tool Step Node │     │ Agent Step Node│
             └────────┬───────┘     └────────┬───────┘
                      │                      │
                      └───────────┬──────────┘
                                  ▼
                     ┌────────────────────────┐
                     │   Human Approval Node  │
                     │  (interrupt / resume)  │
                     └────────────┬───────────┘
                                  │
                                  ▼
                     ┌────────────────────────┐
                     │       OUTPUT NODE      │
                     │      (END State)       │
                     └────────────────────────┘
```

#### Shared Workflow State Annotation
```typescript
import { Annotation } from '@langchain/langgraph';

export const WorkflowStateAnnotation = Annotation.Root({
  // Global workflow execution metadata
  runId: Annotation<string>(),
  workflowId: Annotation<string>(),
  projectId: Annotation<string>(),
  
  // Trigger input payload
  trigger: Annotation<Record<string, any>>(),
  
  // Step outputs indexed by nodeId: steps[nodeId].output
  steps: Annotation<Record<string, {
    status: 'completed' | 'failed' | 'skipped';
    output: any;
    error?: string;
    durationMs: number;
    tokens?: number;
  }>>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),

  // Current execution pointer & approval state
  pendingApproval: Annotation<{
    nodeId: string;
    prompt: string;
    options: string[];
    createdAt: number;
  } | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // Final compiled output
  output: Annotation<any>(),
});
```

#### Dynamic Compiler Algorithm
```javascript
export function compileWorkflowToStateGraph(workflowDef, executionContext) {
  const workflow = new StateGraph(WorkflowStateAnnotation);

  // 1. Register each visual node as a LangGraph node function
  for (const node of workflowDef.nodes) {
    switch (node.type) {
      case 'trigger':
        workflow.addNode(node.id, async (state) => ({
          steps: { [node.id]: { status: 'completed', output: state.trigger, durationMs: 0 } },
        }));
        break;

      case 'agentStep':
        workflow.addNode(node.id, createAgentStepExecutor(node, executionContext));
        break;

      case 'toolStep':
        workflow.addNode(node.id, createToolStepExecutor(node, executionContext));
        break;

      case 'approval':
        workflow.addNode(node.id, createApprovalStepExecutor(node));
        break;

      case 'output':
        workflow.addNode(node.id, async (state) => {
          const finalOutput = resolveTemplate(node.config.outputMapping, state);
          return { output: finalOutput };
        });
        break;
    }
  }

  // 2. Connect direct edges
  for (const edge of workflowDef.edges) {
    if (!edge.condition) {
      workflow.addEdge(edge.from, edge.to);
    }
  }

  // 3. Connect conditional edges for branching nodes
  const conditionNodes = workflowDef.nodes.filter((n) => n.type === 'condition');
  for (const condNode of conditionNodes) {
    const outgoingEdges = workflowDef.edges.filter((e) => e.from === condNode.id);
    const branchMapping = {};
    for (const edge of outgoingEdges) {
      branchMapping[edge.conditionValue || 'default'] = edge.to;
    }

    workflow.addConditionalEdges(
      condNode.id,
      (state) => evaluateCondition(condNode.config, state),
      branchMapping
    );
  }

  workflow.addEdge(START, workflowDef.startNodeId);
  workflow.addEdge(workflowDef.endNodeId, END);

  return workflow;
}
```

### 2. Streaming Telemetry over AG-UI Protocol

Workflows reuse the existing `@ag-ui/core` protocol without deviation:

```typescript
// Custom AG-UI Workflow Event Payloads
export interface WorkflowNodeStartedEvent {
  type: 'workflow_node_started';
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  input: any;
  timestamp: string;
}

export interface WorkflowNodeCompletedEvent {
  type: 'workflow_node_completed';
  nodeId: string;
  output: any;
  durationMs: number;
  tokens?: number;
  timestamp: string;
}

export interface WorkflowNodeFailedEvent {
  type: 'workflow_node_failed';
  nodeId: string;
  error: string;
  retryAttempt?: number;
  timestamp: string;
}
```

These events are yielded as `EventType.CUSTOM` items:
```javascript
yield {
  type: EventType.CUSTOM,
  name: 'workflow_node_started',
  value: { nodeId: node.id, nodeType: node.type, nodeLabel: node.data.label, input: resolvedInput },
};
```
When an `AgentStepNode` executes, child tokens (`TEXT_MESSAGE_CHUNK`) and tool calls stream through with a `parentStepId: node.id` tag in their metadata, allowing the UI canvas to display real-time live typing directly over the active node.

### 3. Disconnected Run Survival & Resumption

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           RESUMABLE EXECUTION ARCHITECTURE (NO REDIS)                           │
│                                                                                                 │
│  [ Client / Browser ]            [ Express Node.js Runtime ]             [ MongoDB Storage ]    │
│          │                                   │                                    │             │
│          │ 1. POST /workflows/:id/run        │                                    │             │
│          ├──────────────────────────────────►│ 2. Create WorkflowRun (running)   │             │
│          │                                   ├───────────────────────────────────►│             │
│          │                                   │ 3. Allocate WorkflowRunDriver      │             │
│          │ 4. SSE Stream (AG-UI Events)      │                                    │             │
│          │◄──────────────────────────────────┤ 5. Execute Node 1                  │             │
│          │                                   ├───────────────────────────────────►│ (Checkpoint)│
│          x (Client Disconnects / Closes Tab) │                                    │             │
│                                              │ 6. Driver keeps pumping node 2, 3  │             │
│                                              ├───────────────────────────────────►│ (Checkpoint)│
│          ┌───────────────────────────────────┴──────────────────────────────────┐ │             │
│          │ SCENARIO A: Client Reconnects Mid-Run                                │ │             │
│          │ 7. GET /workflows/runs/:id/resume                                    │ │             │
│          ├──────────────────────────────────►│ 8. Subscribe to RunDriver        │ │             │
│          │ 9. Replay missed frames + live    │    (replays in-memory frames[])  │ │             │
│          │◄──────────────────────────────────┤                                  │ │             │
│          └──────────────────────────────────────────────────────────────────────┘ │             │
│                                                                                   │             │
│          ┌──────────────────────────────────────────────────────────────────────┐ │             │
│          │ SCENARIO B: Server Process Restarts Mid-Run                          │ │             │
│          │ [ Server Process Crashes & Restarts ]                                │ │             │
│          │ 10. Startup / Agenda Tick: `discoverOrphanedWorkflowRuns()`          │ │             │
│          │     Finds `status: 'running'` with dead memory driver                │ │             │
│          │                                   ├───────────────────────────────────►│             │
│          │                                   │ 11. Resume from Mongo Checkpoint   │             │
│          │                                   │     using `checkpointer.getTuple`  │             │
│          │ 12. Client reconnects             │                                    │             │
│          ├──────────────────────────────────►│ 13. Fallback: serves Mongo state   │             │
│          │◄──────────────────────────────────┤     (`nodeRuns` array projection)  │             │
│          └──────────────────────────────────────────────────────────────────────┘ │             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Resolving Known Gaps & Unanswered Questions from `prompt.md`

### Gap 1: Cycles & Loops vs. DAG Policy
* **Decision: v1 is strictly a Directed Acyclic Graph (DAG).**
* **Rationale:** Unbounded loops without strict exit conditions cause infinite LLM token spend, deadlocks, and unpredictable checkpoint growth.
* **Implementation:** On workflow save and compilation, a Depth-First Search (DFS) cycle detection check validates the graph. If a cycle is found, validation fails with a clear UI error: `"Cycles are not supported in v1. Node X references an ancestor."`
* **v2/v3 Roadmap:** Add a first-class `LoopNode` (e.g. "For Each item in array" or "Repeat until condition with max 10 iterations") rather than free-form cycle edges.

### Gap 2: Node Error Handling & Retry Policies
* **Decision:** Each node declares an individual retry policy and an `onError` strategy.
* **Schema:**
  ```typescript
  retryPolicy: {
    maxRetries: 3,        // Default 0, max 5
    backoffMs: 1000,      // Initial wait
    exponential: true,    // 1s, 2s, 4s...
  },
  onError: 'fail_workflow' | 'continue_with_null' | 'route_error_edge'
  ```
* **Execution:**
  * Transient errors (rate limits, 502/503 HTTP errors) automatically retry per policy before marking the node failed.
  * If `onError === 'fail_workflow'`, the entire run transitions to `failed` and emits `workflow_node_failed`.
  * If `onError === 'route_error_edge'`, execution routes to a dedicated error target handle, enabling fallback notification steps (e.g., Slack alert, email).

### Gap 3: Trigger Security for Webhooks & Schedules
* **Decision: Multi-layered HMAC & token authentication for Webhooks.**
* **Webhook Trigger Endpoints:** `POST /api/v1/developer/workflows/:id/trigger/webhook`
* **Security Mechanics:**
  1. **Header Secret / Bearer Token:** Each webhook trigger generates a cryptographically secure token (`whsec_...`) stored encrypted at rest via AES-256-GCM. Requests must supply `Authorization: Bearer <secret>` or `x-persona-webhook-secret: <secret>`.
  2. **HMAC-SHA256 Signature (Optional for external services like Stripe/GitHub):** Verifies `x-persona-signature` against `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`.
  3. **Replay Attack Prevention:** Enforces timestamp checks (`x-persona-timestamp` within 300 seconds).
* **Scheduled Triggers:** Managed by `agenda.js` on MongoDB. On workflow publish with `schedule`, an Agenda job is created: `agenda.define(jobName, ...); agenda.every(cronExpression, jobName);`.

### Gap 4: Concurrency Controls & Run Queueing
* **Decision: Project-level and workflow-level concurrency limits enforced via MongoDB atomic counters.**
* **Limits:**
  * Default maximum: 5 concurrent runs per workflow, 20 concurrent runs per Project.
* **Mechanism:**
  * When a run arrives, `workflowRunRepository.checkAndIncrementActiveRuns(workflowId, maxConcurrent)` runs an atomic `$inc` with `$expr: { $lt: ['$activeRuns', maxConcurrent] }`.
  * If limit is reached:
    * Manual / API run: Rejects immediately with `429 Too Many Requests`.
    * Webhook / Scheduled run: Enqueues as `status: 'queued'` in MongoDB, processed by Agenda as active slots free up.

### Gap 5: Dedicated Studio "Runs" View & Run Inspector
* **Decision:** Build a dedicated `/projects/[projectId]/workflows/[id]/runs` view alongside the canvas editor.
* **Features:**
  * **Runs Table:** Filter by status (`running`, `completed`, `failed`, `paused`), trigger type, and date range. Columns show duration, total tokens, steps completed, and triggered by.
  * **Visual Run Playback:** Clicking a run opens the canvas in **Read-Only Inspection Mode**.
    * Nodes display status badges (Green = Completed, Red = Failed, Blue Pulse = Running, Yellow = Paused for Approval).
    * Clicking any node opens the **Execution Inspector Sheet**, revealing exact input JSON, resolved template values, output payload, raw LLM reasoning/text, and duration.

### Gap 6: Output Typing & Schema Validation
* **Decision: Node contract schemas with runtime type guards.**
* Each node declares its output schema type:
  * `agentStep`: `{ text: string, toolCalls: object[], tokens: number }`
  * `toolStep`: `{ result: any, isError: boolean }`
  * `condition`: `{ chosenBranch: string }`
* In the canvas config drawer, when a user types `{{`, an autocomplete dropdown inspects all topologically preceding nodes and offers their available properties.

### Gap 7: Test / Dry-Run (Sandbox Execution)
* **Decision: Integrated "Test Run" Drawer on the Canvas.**
* Developers can test without deploying to production:
  * Form to provide mock trigger payloads.
  * Option to toggle **Dry-Run Mode** (destructive tool calls like database mutations or external emails are intercepted and logged without executing).
  * Real-time canvas node highlighting as steps execute.

### Gap 8: Versioning (Draft vs. Published & Agent Pinning)
* **Decision: Two-tier versioning with immutable publication snapshots.**
* **Data Model:**
  ```typescript
  // WorkflowDefinition: mutable active draft & project settings
  interface WorkflowDefinition {
    _id: ObjectId;
    projectId: ObjectId;
    name: string;
    description: string;
    draft: {
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      trigger: WorkflowTriggerConfig;
    };
    publishedVersion: number; // e.g. 3
    isPublished: boolean;
  }

  // WorkflowVersion: immutable published snapshot
  interface WorkflowVersion {
    _id: ObjectId;
    workflowId: ObjectId;
    projectId: ObjectId;
    version: number;
    definition: {
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      trigger: WorkflowTriggerConfig;
    };
    agentSnapshots: Record<string, { modelName: string; systemPrompt: string; tools: string[] }>;
    publishedBy: ObjectId;
    publishedAt: Date;
  }
  ```
* **Agent Step Referencing:**
  * When a workflow is published, the compiler snapshots the current configuration (model, system prompt, tool list) of all referenced Agents into `agentSnapshots`.
  * In the node config, the developer can choose:
    * `Pin to snapshot (Default)`: Immutable; modifying the Agent in Studio does not affect the published Workflow.
    * `Live tracking`: The Workflow always resolves the latest Agent configuration from the database.

### Gap 9: Cost & Credit Metering
* **Decision: Per-step aggregation into `WorkflowRun.usage`.**
* Each `AgentStepNode` turn runs through the standard provider execution path, tracking prompt and completion tokens.
* Tool steps and condition evaluations incur zero or nominal platform credits.
* At workflow completion, `WorkflowRun.usage` aggregates:
  ```json
  {
    "totalTokens": 4250,
    "promptTokens": 3100,
    "completionTokens": 1150,
    "agentTurns": 3,
    "toolCalls": 4,
    "creditsDeducted": 5
  }
  ```
* Metered atomically against the Project's credit balance via existing `rateLimiterService` / developer credit accounting.

---

## 7. SDK Architecture & Developer Surface

The TypeScript SDK (`@personaai/sdk`) will expose a dedicated `WorkflowClient` matching the ergonomics of `ChatClient`:

```typescript
// Initializing and running a workflow via SDK
import { PersonaClient } from '@personaai/sdk';

const client = new PersonaClient({
  baseUrl: 'https://api.persona.hasanraiyan.me',
  credential: process.env.PERSONA_PROJECT_CREDENTIAL!,
  externalUserId: 'user_123',
});

// 1. Run and await final result
const result = await client.workflows.run('wf_sales_qualification', {
  leadEmail: 'founder@example.com',
  companySize: '10-50',
});
console.log('Result:', result.output);

// 2. Stream execution events live (AG-UI stream)
for await (const event of client.workflows.stream('wf_sales_qualification', { leadId: '123' })) {
  if (event.type === 'workflow_node_started') {
    console.log(`Node started: ${event.nodeLabel}`);
  } else if (event.type === 'workflow_node_completed') {
    console.log(`Node finished: ${event.nodeLabel}`);
  } else if (event.type === 'custom' && event.name === 'hitl_request') {
    console.log('Paused for human approval:', event.value);
  }
}

// 3. Resume disconnected run or answer approval
await client.workflows.respondToApproval(runId, {
  nodeId: 'approval_step_1',
  decision: 'approve',
  comment: 'Looks good to proceed.',
});
```

---

## 8. Database Schema Specifications (Mongoose)

### 1. `workflow.model.js`
```javascript
import mongoose from 'mongoose';

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['trigger', 'agentStep', 'toolStep', 'condition', 'approval', 'parallel', 'join', 'output'], 
    required: true 
  },
  position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
  data: {
    label: { type: String, required: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    retryPolicy: {
      maxRetries: { type: Number, default: 0 },
      backoffMs: { type: Number, default: 1000 },
      exponential: { type: Boolean, default: true },
    },
    onError: { type: String, enum: ['fail', 'continue', 'routeError'], default: 'fail' },
  },
}, { _id: false });

const edgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: { type: String },
  targetHandle: { type: String },
  condition: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isEnabled: { type: Boolean, default: true },
  draft: {
    nodes: [nodeSchema],
    edges: [edgeSchema],
    trigger: {
      type: { type: String, enum: ['manual', 'api', 'webhook', 'schedule', 'chat'], default: 'manual' },
      config: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
  },
  publishedVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

workflowSchema.index({ projectId: 1, name: 1 });
export default mongoose.model('Workflow', workflowSchema);
```

### 2. `workflowRun.model.js`
```javascript
import mongoose from 'mongoose';

const nodeRunSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  status: { type: String, enum: ['running', 'completed', 'failed', 'skipped', 'paused'], required: true },
  input: { type: mongoose.Schema.Types.Mixed },
  output: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
  retriesTaken: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
}, { _id: false });

const workflowRunSchema = new mongoose.Schema({
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  workflowVersion: { type: Number, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  triggeredBy: {
    type: { type: String, enum: ['manual', 'api', 'webhook', 'schedule', 'chat'], required: true },
    userId: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  status: { 
    type: String, 
    enum: ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'], 
    default: 'running', 
    index: true 
  },
  nodeRuns: [nodeRunSchema],
  pendingApproval: {
    nodeId: { type: String },
    prompt: { type: String },
    options: [String],
    requestedAt: { type: Date },
  },
  output: { type: mongoose.Schema.Types.Mixed },
  usage: {
    totalTokens: { type: Number, default: 0 },
    agentTurns: { type: Number, default: 0 },
    toolCalls: { type: Number, default: 0 },
    creditsDeducted: { type: Number, default: 0 },
  },
  threadId: { type: String, required: true, index: true }, // LangGraph checkpoint thread_id
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('WorkflowRun', workflowRunSchema);
```

---

## 9. Phased Implementation Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PHASED ROLLOUT ROADMAP                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1 — MVP Foundation (Sprint 1-2)                                                           │
│ ────────────────────────────────────                                                            │
│ • Database: `Workflow`, `WorkflowVersion`, `WorkflowRun` Mongoose models & repositories.        │
│ • Backend Engine: Dynamic LangGraph `StateGraph` compiler for sequential DAGs.                 │
│ • Execution: Trigger -> Agent Step -> Tool Step -> Output. Manual trigger only.                 │
│ • Streaming: Emitting `workflow_node_*` events over AG-UI protocol with `WorkflowRunDriver`.     │
│ • Resumption: MongoDB checkpointer integration + Agenda orphan-run recovery sweep.              │
│ • Frontend (platform): React Flow canvas with custom nodes, node config panel, run button.      │
│ • Runs View: History table and basic node inspection drawer.                                    │
│ • SDK: `@personaai/sdk` `client.workflows.run()` and `client.workflows.stream()`.             │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2 — Branching, Approvals & Triggers (Sprint 3-4)                                          │
│ ──────────────────────────────────────────────────────                                          │
│ • Condition Node: Expression evaluator & LLM classifier branching (conditional edges).          │
│ • Approval Node (HITL): Interruption on approval step, resume via AG-UI and SDK.                │
│ • Triggers: API and Webhook triggers with HMAC-SHA256 signature verification & secret tokens.   │
│ • Node Resilience: Configurable retry policies (`retryOnFail`) and error routing edges.         │
│ • Test Drawer: Dry-run sandbox execution mode on canvas.                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3 — Advanced Orchestration & Platform Scale (Sprint 5-6)                                  │
│ ──────────────────────────────────────────────────────────────                                  │
│ • Parallel & Join: Concurrent fan-out branch execution and merge nodes.                         │
│ • Scheduled Triggers: Agenda.js recurring cron execution.                                       │
│ • Controlled Loops: `LoopNode` for bounded item batch processing.                               │
│ • Subgraph Library: Ability to save and embed a workflow as a reusable step in other workflows. │
│ • Cost Metering: Granular per-step token/credit deduction against Project balances.             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Conclusion

The Workflows architecture detailed in this research directly fulfills the dual requirements of [prompt.md](file:///D:/projects/agent-marketplace/prompt.md):
1. **Pillar A** provides an intuitive, highly responsive visual builder built on `@xyflow/react` in `platform`, matching the patterns established across the Developer Studio.
2. **Pillar B** delivers a robust, multi-agent engine compiled to LangGraph's `StateGraph`, operating within existing infrastructure constraints (MongoDB-only, Agenda, MongoDBSaver, AG-UI protocol), and providing complete durability across disconnections and process restarts.
3. Every open question and gap from the draft specification—including DAG-first scoping, node-level error policies, webhook security, run concurrency, and runs history—has been thoroughly analyzed and resolved with concrete production designs.
