# AG-UI Streaming Protocol & Real-Time Agent Runtime FR/NFR Specification

## 1. System Overview & Purpose

The **AG-UI Streaming Protocol** is the real-time interaction layer connecting client applications (web chat interfaces, mobile clients, and SDK runtimes) with Persona's LangGraph agent execution graph. Using Server-Sent Events (SSE), AG-UI streams incremental text tokens, tool execution states, interactive Human-In-The-Loop (HITL) requests, and nested sub-agent activities with deterministic lifecycle boundaries and state persistence.

---

## 2. Functional Requirements (FR)

### FR-1: Streaming Protocol & Lifecycle Boundaries

- **FR-1.1**: The runtime must stream events using the `text/event-stream` MIME type with `Cache-Control: no-cache` and `Connection: keep-alive`.
- **FR-1.2**: Every agent run must emit an initial `RUN_STARTED` event containing the unique `runId`, `threadId`, and timestamp.
- **FR-1.3**: When an agent completes execution successfully, the runtime must emit a `RUN_FINISHED` event containing the `runId`, token usage statistics (prompt tokens, completion tokens, total tokens), and finish reason (`stop`, `length`, `tool_calls`).
- **FR-1.4**: If an unhandled exception occurs, the runtime must emit an `ERROR` event containing error code, classified error category, user-safe message, and run identifier before closing the stream.
- **FR-1.5**: Heartbeat keep-alive pings (`: ping\n\n` or periodic comment lines) must be dispatched at 15-second intervals during long-running tool operations to prevent proxy/load-balancer socket termination.

### FR-2: Incremental Token & Tool Streaming

- **FR-2.1**: LLM token chunks must be translated in real-time into `TEXT_DELTA` events containing the delta text and message identifier.
- **FR-2.2**: Tool invocations must emit:
  - `TOOL_CALL_STARTED`: Tool name, call ID, and initial argument chunk.
  - `TOOL_CALL_CHUNK`: Incremental tool input argument deltas (for streaming JSON arguments).
  - `TOOL_CALL_RESULT`: Formatted tool output (guaranteed non-empty string or JSON object) and execution status (`success` | `error`).
- **FR-2.3**: Tool execution outputs must be sanitized before emission. If a tool returns `undefined`, the runtime must normalize it to `{ status: 'ok' }` to prevent serialization crashes.

### FR-3: Hierarchical Sub-Agent Activity Streaming

- **FR-3.1**: When an agent delegates execution to a sub-agent (e.g. Architect decomposing tasks or an agent invoking child agents via tools), sub-agent actions must be tracked via `RunScopeTracker`.
- **FR-3.2**: Sub-agent progress must be emitted as custom `subagent_activity` events discriminated by `kind`:
  - `kind: "text"`: Sub-agent reasoning and text deltas.
  - `kind: "tool_start"`: Sub-agent tool initiation.
  - `kind: "tool_result"`: Sub-agent tool outputs.
- **FR-3.3**: Sub-agent state changes must emit `subagent_state` events with current lifecycle (`active` | `waiting` | `completed`).

### FR-4: Human-In-The-Loop (HITL) & Resumption

- **FR-4.1**: The runtime must support LangGraph interrupt checkpoints. When an agent enters an interrupt state, it yields a `CUSTOM` event with payload type:
  - `clarification_request`: Interactive multi-choice clarifying questions with index, question text, and selectable options.
  - `hitl_request`: Action requests requiring user approval (e.g., destructive operations, financial transactions, external emails).
- **FR-4.2**: Client responses must resume execution via `POST /api/v1/agui` (or `/api/v1/developer/agui`) supplying the pending `threadId` and structured `resume` payload.
- **FR-4.3**: The runtime must resume from the saved LangGraph MongoDB checkpoint without repeating previously executed nodes.

### FR-5: Interactive MCP UI Applications (`mcp_app`)

- **FR-5.1**: When a Model Context Protocol (MCP) tool declares a visual widget resource (via `_meta.ui.resourceUri`), the runtime must emit an `mcp_app` custom event containing `toolCallId`, `resourceUri`, and `mcpId`.
- **FR-5.2**: The frontend chat composer must render the corresponding embedded interactive iframe / component in sync with the agent's turn.

### FR-6: Automatic Thread Naming & Checkpoint State

- **FR-6.1**: Upon receiving the first user turn in a new thread, the runtime must invoke background LLM auto-titling to generate a concise thread title (<60 characters).
- **FR-6.2**: Thread state, message history, and LangGraph checkpoints must be persisted to MongoDB after every turn.

---

## 3. Non-Functional Requirements (NFR)

### NFR-1: Latency & Responsiveness

- **Time to First Token (TTFT)**: For non-tool turns, the initial `TEXT_DELTA` event must reach the client within 800ms of model invocation.
- **Event Serialization Overhead**: Translation from LangGraph stream events to AG-UI protocol events must incur <2ms processing latency per chunk.

### NFR-2: Backpressure & Socket Teardown

- **Write-Buffer Management**: In high-velocity streaming scenarios, writer utilities must monitor socket backpressure (`res.write() === false`) and pause upstream generation until `drain` emits.
- **Clean Disconnection Handling**: If the client aborts or closes the connection (`req.on('close')`), active LangGraph generator loops and pending abort controllers must be aborted immediately to conserve backend CPU and memory.

### NFR-3: Error Classification & Resilience

- **Error Classification**: Runtime errors must be classified into deterministic categories:
  - `PROVIDER_AUTH_ERROR`: Bad or expired API keys (HTTP 401).
  - `RATE_LIMIT_ERROR`: Provider quota exceeded (HTTP 429).
  - `TOOL_EXECUTION_ERROR`: Tool execution failure or timeout.
  - `CONTEXT_LENGTH_EXCEEDED`: Model token limit reached.
- **Graceful Termination**: In all failure modes, the runtime must emit an informative error notice event before terminating the SSE stream.

---

## 4. AG-UI Protocol Event Flow

```text
Client (Web / SDK)                             AG-UI Runtime (agui.service.js)
       │                                                      │
       │──────── POST /api/v1/agui (prompt / messages) ──────▶│
       │                                                      │
       │◀─────── event: RUN_STARTED ──────────────────────────│
       │◀─────── event: TEXT_DELTA ("Hello, ") ───────────────│
       │◀─────── event: TEXT_DELTA ("I am analyzing...") ─────│
       │                                                      │
       │◀─────── event: TOOL_CALL_STARTED (calc_tax) ─────────│
       │◀─────── event: TOOL_CALL_RESULT ({ tax: 15.5 }) ─────│
       │                                                      │
       │◀─────── event: CUSTOM (subagent_activity) ───────────│
       │                                                      │
       │◀─────── event: RUN_FINISHED (usage stats) ───────────│
       │                                                      │
```
