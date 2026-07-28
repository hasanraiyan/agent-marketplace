# AG-UI Architecture & Reusable Blueprint

> **A complete reference for building AI agent chat interfaces using the AG-UI streaming protocol.**
> Based on the Persona.ai agent marketplace backend (Express 5 + MongoDB + LangGraph + Deep Agents) and its Next.js frontend.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The AG-UI Protocol](#2-the-ag-ui-protocol)
   - [Event Catalog](#event-catalog)
   - [SSE Transport](#sse-transport)
   - [Event Lifecycle](#event-lifecycle)
3. [Backend Architecture](#3-backend-architecture)
   - [Request Flow](#request-flow)
   - [Agent Factory Pattern](#agent-factory-pattern)
   - [LangGraph → AG-UI Translator](#langgraph--ag-ui-translator)
   - [Interrupt Handling (HITL)](#interrupt-handling-hitl)
   - [Subagent Tracing](#subagent-tracing)
4. [Frontend Architecture](#4-frontend-architecture)
   - [Component Tree](#component-tree)
   - [SSE Client Hook (useAguiChat)](#sse-client-hook-useaguichat)
   - [Message & Tool Rendering](#message--tool-rendering)
   - [Side Panels (Files, Plan)](#side-panels-files-plan)
   - [Approval & Clarification UI](#approval--clarification-ui)
5. [Reusable Blueprint](#5-reusable-blueprint)
   - [Backend Blueprint (Any Framework)](#backend-blueprint-any-framework)
   - [Frontend Blueprint (React)](#frontend-blueprint-react)
   - [Implementation Checklist](#implementation-checklist)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React / Next.js)                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  AguiAgentChat                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  │   │
│  │  │ Message  │  │  Tool    │  │  Approval  │  │  Files   │  │   │
│  │  │ Bubbles  │  │  Traces  │  │  /Clarify  │  │  Panel   │  │   │
│  │  └──────────┘  └──────────┘  └────────────┘  └──────────┘  │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │  useAguiChat (SSE Client + State Machine)               │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │ SSE (HTTP streaming)                     │
│                          ▼                                          │
│  POST /api/v1/agui  ──────────────────►  text/event-stream          │
└─────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────────────────────────────────────────────────┐
│  BACKEND (Express 5 / Node.js)                                       │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────────────────┐  │
│  │  Auth    │  │  Thread    │  │  Agent Factory                 │  │
│  │  (Clerk) │  │  Resolution│  │  ┌────────┐  ┌──────────────┐ │  │
│  └──────────┘  └────────────┘  │  │  LLM   │  │   Tools      │ │  │
│                                 │  │  (Lang │  │   (Built-in  │ │  │
│  ┌────────────────────────┐    │  │ Chain) │  │    + MCP)    │ │  │
│  │  AG-UI Controller      │    │  └────────┘  └──────────────┘ │  │
│  │  (SSE setup + stream)  │───►│  ┌──────────────────────────┐ │  │
│  └────────────────────────┘    │  │  createDeepAgent()       │ │  │
│                                 │  │  (LangGraph StateGraph)  │ │  │
│  ┌────────────────────────┐    │  │  + Backend (VFS)         │ │  │
│  │  AG-UI Translator      │    │  │  + Memory (/memories/)   │ │  │
│  │  (LangGraph → AG-UI)   │    │  │  + Skills (/skills/)     │ │  │
│  └────────────────────────┘    │  │  + Subagents               │ │  │
│                                 │  └──────────────────────────┘ │  │
│  ┌────────────────────────┐    └────────────────────────────────┘  │
│  │  Checkpoint Service    │──► MongoDB (persistent state)          │
│  │  (MongoDBSaver)        │                                        │
│  └────────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **SSE over WebSocket** | Simpler infrastructure (no upgrade, no sticky sessions); HTTP/2 multiplexing; works through all proxies; one-way server→client is sufficient |
| **AG-UI Protocol** | Standardized event types for AI chat (text chunks, tool calls, state snapshots, interrupts); auto-expansion of chunk events into START/CONTENT/END triads |
| **Chunk-based events** | Single event type (`TEXT_MESSAGE_CHUNK`, `TOOL_CALL_CHUNK`) reduces complexity vs managing open/close pairs |
| **LangGraph in-process** | Agents are built per-request (per user/model/tools) — no deployed LangGraph Platform needed |
| **rAF event batching** | SSE events arrive at token rate (~1000/token); React renders capped at 60fps via `requestAnimationFrame` |
| **Optimistic state mirroring** | Files/todos update mid-run from tool results, not just at `STATE_SNAPSHOT` end-of-turn |

---

## 2. The AG-UI Protocol

AG-UI is an SSE-based event protocol for streaming AI agent interactions. Events are JSON objects sent as Server-Sent Events `data:` lines.

### Event Catalog

Every event conforms to `{ type: string, ... }` where `type` comes from `@ag-ui/core`'s `EventType` enum.

#### 2.1 Run Lifecycle Events

```javascript
{ type: "RUN_STARTED", threadId: "uuid", runId: "uuid" }
{ type: "RUN_FINISHED", threadId: "uuid", runId: "uuid" }
{ type: "RUN_ERROR", threadId: "uuid", runId: "uuid", message: "error description" }
```

#### 2.2 Text Events

```javascript
// Streaming assistant text — one event per token
{ type: "TEXT_MESSAGE_CHUNK", messageId: "uuid", role: "assistant", delta: "Hello..." }

// Reasoning/thinking tokens — folded under a collapsible "Thoughts" section
{ type: "REASONING_MESSAGE_START", messageId: "uuid" }
{ type: "REASONING_MESSAGE_CONTENT", messageId: "uuid", delta: "reasoning text..." }
{ type: "REASONING_END" }
```

The frontend auto-expands `CHUNK` events into a single accumulated message. No `START`/`END` needed for text chunks — the `messageId` acts as the grouping key.

#### 2.3 Tool Call Events

```javascript
// Stream tool args live as the model generates them (pre-execution)
{ type: "TOOL_CALL_CHUNK", toolCallId: "uuid", toolCallName: "write_file", delta: `{"file_path":...}` }

// Full result once the tool finishes
{ type: "TOOL_CALL_RESULT", messageId: "uuid", toolCallId: "uuid", content: "result text", role: "tool" }
```

**Key rule**: `TOOL_CALL_CHUNK` can be emitted **before** the tool starts (live arg streaming from model's `tool_call_chunks`) **or** at `on_tool_start` (full args on first emit). The frontend handles both.

**MCP Structured Content**: When an MCP tool returns structured data (for MCP App widgets), a `structuredContent` field is included:
```javascript
{ type: "TOOL_CALL_RESULT", ..., content: "...", structuredContent: { ... } }
```

#### 2.4 Custom Events

```javascript
// HITL approval request — agent wants user to approve tool(s)
{ type: "CUSTOM", name: "hitl_request", value: {
    actionRequests: [{ name: "write_file", args: { file_path: "...", ... } }],
    reviewConfigs: []
  }
}

// Clarification request — agent needs info before proceeding
{ type: "CUSTOM", name: "clarification_request", value: {
    questions: [{ id: "q1", text: "What language?", options: ["JS", "Python"], required: true, allowCustom: true }],
    currentIndex: 0
  }
}

// Subagent activity — scoped events from a delegated sub-task
{ type: "CUSTOM", name: "subagent_activity", value: {
    toolCallId: "task-tool-call-id",
    kind: "text" | "tool_start" | "tool_result",
    delta?: "streamed text",
    toolName?: "search_web",
    args?: "{\"query\":...}",
    result?: "output"
  }
}

// MCP App widget metadata
{ type: "CUSTOM", name: "mcp_app", value: {
    toolCallId: "uuid",
    resourceUri: "mcp-server://widget/...",
    mcpId: "mcp-connection-id"
  }
}
```

#### 2.5 State Events

```javascript
// End-of-turn snapshot of the agent's virtual filesystem and plan
{ type: "STATE_SNAPSHOT", snapshot: {
    files: {
      "/workspace/outputs/main.js": { content: "...", size: 1234, created_at: "...", modified_at: "..." },
      ...
    },
    todos: [
      { content: "Refactor the API handler", status: "completed" },
      { content: "Write unit tests", status: "in_progress" },
      { content: "Deploy to staging", status: "pending" }
    ]
  }
}

// Auto-generated thread title (emitted once after the first turn)
{ type: "title", title: "Building a REST API with Express" }
```

### Package Dependencies

The AG-UI protocol is implemented via two npm packages:

| Package | Purpose | Used In |
|---|---|---|
| `@ag-ui/core` | Defines `EventType` enum and core event types | Backend translator (`aguiTranslator.js`) |
| `@ag-ui/client` | Provides `EventType` constants for the client-side | Frontend `useAguiChat.js` |

Install them:
```bash
npm install @ag-ui/core        # backend
npm install @ag-ui/client       # frontend
```

The `EventType` enum from either package exports the same string constants (`RUN_STARTED`, `TEXT_MESSAGE_CHUNK`, `TOOL_CALL_CHUNK`, `TOOL_CALL_RESULT`, `RUN_FINISHED`, `STATE_SNAPSHOT`, `CUSTOM`, `TITLE`, etc.). The backend also emits custom event names like `"title"`, `"subagent_activity"`, `"hitl_request"`, `"clarification_request"`, and `"mcp_app"` as `CUSTOM` events with distinct `name` fields.

### SSE Transport

```
-> POST /api/v1/agui
-> Headers:
->   Authorization: Bearer <clerk-jwt-token>
->   X-Agent-Id: <agent-id>
->   X-Thread-Id: <thread-db-id>
->   Content-Type: application/json
->
-> Body: {
->   "messages": [
->     { "id": "user-1", "role": "user", "content": "Hello!" }
->   ],
->   "threadId": "langgraph-thread-id",
->   "runId": "uuid",
->   "agentId": "agent-mongo-id",
->   "resume": { "decisions": [...] } | { "answers": [...], "text": "..." }
-> }

<- HTTP 200
<- Content-Type: text/event-stream; charset=utf-8
<- Cache-Control: no-cache, no-transform
<- Connection: keep-alive
<-
<- data: {"type":"RUN_STARTED","threadId":"...","runId":"..."}
<- data: {"type":"TEXT_MESSAGE_CHUNK","messageId":"...","role":"assistant","delta":"Hello"}
<- data: {"type":"TOOL_CALL_CHUNK","toolCallId":"...","toolCallName":"...","delta":"..."}
<- data: {"type":"TOOL_CALL_RESULT","messageId":"...","toolCallId":"...","content":"..."}
<- data: {"type":"STATE_SNAPSHOT","snapshot":{...}}
<- data: {"type":"RUN_FINISHED","threadId":"...","runId":"..."}
```

### Event Lifecycle

```
RUN_STARTED
  │
  ├── TEXT_MESSAGE_CHUNK*   (model generating text)
  ├── REASONING_MESSAGE_START → REASONING_MESSAGE_CONTENT* → REASONING_END  (reasoning tokens)
  ├── TOOL_CALL_CHUNK*      (streaming tool args or full args at start)
  ├── TOOL_CALL_RESULT*     (tool execution completed)
  ├── CUSTOM:subagent_activity*  (subagent events — nested during a task tool)
  ├── CUSTOM:hitl_request   (agent paused for approval — stream stops)
  ├── CUSTOM:clarification_request  (agent paused for questions — stream stops)
  ├── STATE_SNAPSHOT        (end-of-turn state)
  │
RUN_FINISHED
```

**Interrupt flow**: When the agent hits an `interrupt()` (HITL or clarification), the stream **pauses** — it doesn't close. The client receives the custom event + a text notice. The next user message calls `POST` again with `resume: { decisions: [...] }` or `resume: { answers: [...] }`, and the agent continues from where it paused.

---

## 3. Backend Architecture

### Request Flow

```
HTTP POST /api/v1/agui
  │
  ├── authMiddleware       → Clerk JWT verification → req.user
  ├── Thread Resolution    → X-Thread-Id → fetch MongoDB Thread → resolve langGraphThreadId
  ├── Rate Limiting        → Concurrency check (max 2 concurrent per user)
  │
  ├── aguiController.runAgent()
  │   ├── Set SSE headers (Content-Type: text/event-stream)
  │   ├── Create AbortController (aborts on client disconnect)
  │   ├── RunScopeTracker (records run ancestry for subagent attribution)
  │   │
  │   ├── Send RUN_STARTED
  │   ├── For each event from runAgentAsAguiEvents():
  │   │   └── res.write(`data: ${JSON.stringify(event)}\n\n`)
  │   ├── Send RUN_FINISHED
  │   │
  │   └── Persist subagent traces (fire-and-forget to MongoDB)
  │
  └── Error handling → next(err) → global error handler
```

### Agent Factory Pattern

The `agent.factory.js` is the most important backend file. It builds a compiled LangGraph agent graph for every request. The pattern is:

```javascript
// Simplified blueprint
async function buildAgent(agentId, userId, checkpointer) {
  // 1. Resolve agent config (from DB or built-in)
  const agent = await findAgent(agentId);
  const provider = await findProvider(agent.providerId);

  // 2. Create LLM with streaming
  const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
  const llm = new ChatOpenAI({
    apiKey,
    modelName: agent.modelName,
    streaming: true,
    configuration: { baseURL: provider.baseURL }
  });

  // 3. Resolve dynamic tools
  const { tools } = await resolveAgentTools(agent, userId);

  // 4. Build the virtual filesystem backend
  const backend = new CompositeBackend(
    new VersionedStateBackend(),   // ephemeral workspace
    {
      '/skills/': readonlyBackend(storeBackend),
      '/memories/user/': gracefulBackend(storeBackend),
      '/memories/agent/': gracefulBackend(storeBackend),
    }
  );

  // 5. Compile the agent graph with Deep Agents
  const agentInstance = await createDeepAgent({
    model: llm,
    systemPrompt: personalizePrompt(agent),
    checkpointer: safeCheckpointer,
    tools,
    backend,
    memory: ['/memories/user/index.md', '/memories/agent/index.md'],
    subagents: [{ name: 'general-purpose', description: '...', systemPrompt: '...' }],
  });

  return { agentInstance, agentConfig, llm, providerConfig, mcpAppMap };
}
```

**Key concepts**:
- **LRU Cache**: Compiled agents cached by `agentId:userId` (50 max). Invalidated on config change.
- **Per-user MCP tools**: User-specific MCP connectors mean the same agent has different tools for different users → cache key includes userId.
- **Safe checkpointer**: Proxy around MongoDB checkpointer to guard against empty batch writes.
- **VersionedStateBackend**: Every file write creates a version (`/.versions/<path>.v1`, `.v2`, ...) for the Files panel's version history.

### LangGraph → AG-UI Translator

The `aguiTranslator.js` is an **async generator** that consumes LangGraph's `streamEvents(version='v2')` iterator and yields AG-UI events.

**Core translation table**:

| LangGraph Event | → AG-UI Event(s) | Logic |
|---|---|---|
| `on_chat_model_stream` (text) | `TEXT_MESSAGE_CHUNK` | Extract text delta from content blocks |
| `on_chat_model_stream` (reasoning) | `REASONING_MESSAGE_START/CONTENT/END` | Detect `additional_kwargs.reasoning_content` or `{ type: 'reasoning' }` blocks |
| `on_chat_model_stream` (tool_call_chunks) | `TOOL_CALL_CHUNK` (pre-stream) | Accumulate streaming args, emit when id + name known |
| `on_chat_model_start` | (internal) | Reset arg streams for new model turn |
| `on_tool_start` | `TOOL_CALL_CHUNK` (fallback) | Only if args weren't pre-streamed |
| `on_tool_end` | `TOOL_CALL_RESULT` | Extract tool output (unwrap ToolMessage.content) |
| `on_tool_error` | `TOOL_CALL_RESULT` (error) | `{ status: 'error', message: '...' }` |
| Interrupt (thrown) | `CUSTOM:hitl_request` / `CUSTOM:clarification_request` + text notice | Detect `GraphInterrupt`, classify as HITL or clarification |
| End of stream | `STATE_SNAPSHOT` | Get graph state, build files + todos snapshot |
| Subagent events (nested namespaces) | `CUSTOM:subagent_activity` | Route to owning `task` tool via `RunScopeTracker` |

**Key detail — MCP structured content**: When an MCP tool returns `structuredContent` (for App widgets), it's extracted from `ToolMessage.artifact` and forwarded as `TOOL_CALL_RESULT.structuredContent`.

### Interrupt Handling (HITL)

The backend supports two types of interrupts:

**1. HITL (Human-in-the-Loop) — Tool Approval**
- The agent has `interruptOn: { write_file: true, edit_file: true }`
- Before executing the guarded tool, LangGraph `interrupt()`s with `actionRequests` + `reviewConfigs`
- Backend emits `CUSTOM:hitl_request` with the pending actions
- Client sends `{ decisions: [{ type: 'approve' } | { type: 'reject', message: '...' }] }`
- Backend calls `Command({ resume: { decisions: [...] } })`

**2. Clarification — Asking Questions**
- The agent calls `ask_clarification` tool (built-in)
- Tool interrupts with `{ questions: [{ text: 'What color?', options: ['Red', 'Blue'] }] }`
- Backend emits `CUSTOM:clarification_request`
- Client renders a multi-step question wizard
- Client sends `{ answers: [{ questionId, question, answer, optionIndex, freeform, skipped }], text: '...' }`
- Backend calls `Command({ resume: { answers: [...], text: '...' } })`

### Subagent Tracing

When the main agent delegates to a subagent via the `task` tool:

1. **RunScopeTracker** (`agent-backend/src/modules/agui/RunScopeTracker.js`) — A LangGraph **callback** attached to the stream via `callbacks: [runScopeTracker]` in `streamEvents()`. It intercepts every `run_id` and its `parent_run_id` to build an ancestry tree as the graph executes. This is essential because LangGraph runs subagents in parallel — without ancestry tracking, nested events from two parallel subagents would be indistinguishable.

2. **In the translator** — Events from nested checkpoint namespaces (`checkpoint_ns` containing `|`) are captured as `subagent_activity` custom events. The ancestry tree is authoritative; the task-stack fallback handles cases where namespace metadata is absent.

3. **Attribution** — `RunScopeTracker.findAncestor(runId, predicate)` walks the ancestry chain upward until `predicate(id)` returns `true`. This maps any nested run to its owning `task` tool call, even across parallel subagents where events interleave.

4. **Persistence** — Subagent traces are folded into a compact format via `settleTrace()` (from `subagentTrace.js`) and stored on the MongoDB Thread doc as `subagentTraces.<toolCallId>` — an array of timeline entries that survives thread reload.

5. **Subagent trace folding** (`subagentTrace.js`): Raw `subagent_activity` events arrive interleaved. `foldSubagentEvent()` assembles them into a coherent timeline per `task` call. `settleTrace()` closes any running items and snapshots the final array for DB storage.

---

## 4. Frontend Architecture

### Component Tree

```
RunAgentPage (page.jsx)
  ├── McpConnectBanner
  ├── AguiAgentChat
  │   ├── [Empty State] → Agent profile + suggested prompts + share button
  │   ├── [Chat State]
  │   │   ├── Conversation → iterates over conversation entries
  │   │   │   ├── MessageBubble (user | assistant | reasoning)
  │   │   │   ├── CollapsibleToolGroup (cluster of related tools)
  │   │   │   │   └── ToolTrace (individual tool card) × N
  │   │   │   │       ├── FileDiffCard / ReadFileCard / LsDirectoryCard
  │   │   │   │       ├── GrepResultsView / SearchResultLinks
  │   │   │   │       ├── TodoChecklist / SkillSaveCard / AgentSaveCard
  │   │   │   │       ├── SubAgentTimeline (inline subagent activity)
  │   │   │   │       └── SubagentActivityDialog (modal)
  │   │   │   ├── ToolTrace (present_file — inline file card)
  │   │   │   └── MCPAppRenderer (interactive widget)
  │   │   ├── ApprovalCard (HITL — approve/reject buttons)
  │   │   └── ThinkingText (bouncing dots)
  │   └── ChatComposer (textarea + send/stop button)
  │       └── ClarificationCard (multi-question wizard, when pending)
  │
  └── AguiFilesPanel
      ├── [Tab: Plan] → Progress bar + TodoChecklist
      └── [Tab: Files] → File explorer → Code viewer / Preview
          ├── Code editor (react-simple-code-editor + Prism)
          ├── Markdown preview (react-markdown)
          └── HTML preview (iframe)
```

### SSE Client Hook (useAguiChat)

This is the **single most important frontend file** — the state machine that manages the entire agent interaction lifecycle.

**Inputs:**
- `url` — SSE endpoint URL
- `agentId` — Agent identifier
- `threadId` — Thread identifier (from URL or "new")
- `headers` — Auth + context headers
- `initialMessages` / `initialState` — Hydration from checkpoint
- `onCreateThread`, `onRunFinished`, `onTitleGenerated` — Callbacks

**State managed:**
- `messages[]` — `{ id, role: 'user'|'assistant'|'reasoning', content }`
- `conversation[]` — Ordered list of entries (`{ type: 'message'|'tool', refId }`)
- `toolCalls[]` — `{ id, name, argumentsText, resultText, status, subEvents, mcpApp }`
- `agentState` — `{ files: {}, todos: [] }` (from STATE_SNAPSHOT + optimistic updates)
- `isRunning`, `isReasoning`, `error`
- `pendingApproval` / `pendingClarification` — Interrupt state
- `abortRef` — AbortController for stopping the stream

**Key methods:**

| Method | Purpose |
|---|---|
| `send(text)` | Append user message → open SSE stream |
| `stop()` | Abort the current SSE stream |
| `respondToApproval(decisions, displayText?)` | Resolve HITL interrupt |
| `respondToClarification({ answer?, optionIndex?, skipped? })` | Step through or submit clarification |
| `clear()` | Reset all state for new chat |

**Event batching mechanism:**
```javascript
// Events queue up and flush once per animation frame
const eventQueueRef = useRef([]);
const flushScheduledRef = useRef(false);

const enqueueEvent = (event) => {
  eventQueueRef.current.push(event);
  if (flushScheduledRef.current) return;
  flushScheduledRef.current = true;
  requestAnimationFrame(flushEvents);  // ~60 renders/sec cap
};

const flushEvents = () => {
  flushScheduledRef.current = false;
  const queue = eventQueueRef.current;
  eventQueueRef.current = [];
  for (const event of queue) applyEventRef.current(event);
  // React batches all state updates into one render
};
```

**Optimistic state mirroring**: When a `TOOL_CALL_RESULT` arrives for `write_todos`, the todo list is immediately updated in `agentState` without waiting for `STATE_SNAPSHOT`. Same for `write_file`/`edit_file` — the files panel updates mid-run.

### Message & Tool Rendering

**MessageBubble.jsx** (memoized — won't re-render on every token):

| Message Role | Visual |
|---|---|
| `user` | Blue rounded bubble, right-aligned, white text, Markdown rendered |
| `assistant` | Plain prose, left-aligned, Markdown + code blocks with Prism highlighting |
| `reasoning` | Collapsible "Thoughts" button → expand to see Markdown-rendered reasoning |

**ToolTrace.jsx** (memoized by tool ID — only re-renders when its specific tool object changes):

Tool type detection → icon selection → human-readable title → expandable content panel.

**Tool clustering logic** (`CollapsibleToolGroup`):
Adjacent tool calls are grouped by semantic family:
- `file` — write_file, edit_file, read_file, ls, grep, glob
- `search` — search_web, tavily_*
- `memory` — anything touching /memories/ paths
- `task` — subagent delegation
- `plan` — write_todos
- `mixed` — everything else

Each cluster shows a header like "Working with files (3 steps)" and collapses into an accordion. Single-tool clusters render directly as a `ToolTrace`.

### Side Panels (Files, Plan)

**AguiFilesPanel.jsx** — Fixed sidebar, two tabs:

**Plan tab:**
- Progress bar (`completedCount / total`)
- Dostify-style todo checklist with status icons:
  - ✅ Filled blue circle-check for completed
  - 🕐 Clock for in-progress
  - ○ Empty circle for pending
- Strikethrough for completed items

**Files tab:**
- File explorer — tree-like list with icons per extension
- Click to open → Code viewer with:
  - `react-simple-code-editor` + Prism syntax highlighting
  - Markdown preview mode (react-markdown)
  - HTML preview mode (iframe with sandbox)
  - Version history selector (dropdown showing `.v1`, `.v2`, ...)
  - Copy button

### Approval & Clarification UI

**ApprovalCard.jsx:**
- Amber border card with shield icon
- Lists the pending tool actions (with inline FileSystemActionCard previews for file writes)
- Approve / Reject buttons
- "Or reply below with feedback" — user types → treated as reject-with-feedback

**ClarificationCard.jsx:**
- Sleek dark/light theme card
- Shows question text + numbered option buttons (like a poll)
- "Something else" option for freeform input
- Multi-question wizard — navigates through questions one at a time
- Dismiss (X) button to skip

---

## 5. Reusable Blueprint

This section tells you how to **recreate this architecture in a different tech stack**.

### Backend Blueprint (Any Framework)

#### File Structure

```
project/
├── src/
│   ├── routes/
│   │   └── agui.js            # SSE endpoint + auth + thread resolution
│   ├── services/
│   │   ├── agent-factory.js   # Build agent graph from config
│   │   ├── agui-service.js    # Orchestrate run + translate stream
│   │   └── thread-service.js  # Thread CRUD + checkpointing
│   ├── translators/
│   │   └── agui-translator.js # LangGraph → AG-UI event translation
│   ├── utils/
│   │   ├── encryption.js      # AES-256-GCM for API keys
│   │   ├── errors.js          # Error classes (NotFound, RateLimit, etc.)
│   │   └── logger.js          # Structured logger
│   └── models/
│       ├── agent.js           # Agent config schema
│       ├── thread.js          # Thread schema (with subagentTraces)
│       └── provider.js        # LLM provider credentials
└── tests/
```

#### Required AG-UI Events (Minimal Set)

For a minimal working agent chat, you need only these events:

| Event | Required | Purpose |
|---|---|---|
| `RUN_STARTED` | ✅ | Signals stream start |
| `TEXT_MESSAGE_CHUNK` | ✅ | Model's text output |
| `TOOL_CALL_CHUNK` | Only if tools | Tool call display |
| `TOOL_CALL_RESULT` | Only if tools | Tool output display |
| `STATE_SNAPSHOT` | Only if VFS | Files/plan panel |
| `RUN_FINISHED` | ✅ | Signals stream end |
| `CUSTOM:hitl_request` | Only if HITL | Approval UI |
| `CUSTOM:clarification_request` | Only if HITL | Question wizard |
| `CUSTOM:subagent_activity` | Only if subagents | Subagent timeline |

#### Minimal Backend Implementation (Pseudocode)

```javascript
// agui-translator.js — The core translation layer
async function* translateStream(langGraphStream, opts) {
  yield { type: 'RUN_STARTED', threadId, runId };

  for await (const event of langGraphStream) {
    if (event.event === 'on_chat_model_stream') {
      const delta = extractTextDelta(event.data.chunk);
      if (delta) yield { type: 'TEXT_MESSAGE_CHUNK', messageId, role: 'assistant', delta };
    }
    else if (event.event === 'on_tool_start') {
      yield { type: 'TOOL_CALL_CHUNK', toolCallId, toolCallName, delta: JSON.stringify(args) };
    }
    else if (event.event === 'on_tool_end') {
      yield { type: 'TOOL_CALL_RESULT', messageId, toolCallId, content: extractContent(event.data.output), role: 'tool' };
    }
  }

  yield { type: 'STATE_SNAPSHOT', snapshot: buildSnapshot(graphState) };
  yield { type: 'RUN_FINISHED', threadId, runId };
}
```

**Handling interrupts in your translator**: When a `GraphInterrupt` is thrown (the agent's `interrupt()` is called), catch it in your stream loop:
```javascript
try {
  for await (const event of stream) { /* translate */ }
} catch (err) {
  const interrupts = extractGraphInterrupts(err);
  if (interrupts) {
    yield { type: 'CUSTOM', name: 'hitl_request', value: {
      actionRequests: interrupts[0].value.actionRequests,
      reviewConfigs: interrupts[0].value.reviewConfigs || [],
    }};
    yield { type: 'TEXT_MESSAGE_CHUNK', messageId, role: 'assistant',
      delta: buildInterruptNotice(interrupts) };
    return; // stream pauses — next request will resume
  }
  // Genuine error
  yield { type: 'TEXT_MESSAGE_CHUNK', messageId, role: 'assistant',
    delta: `Error: ${err.message}` };
}
```

### Frontend Blueprint (React)

#### File Structure

```
src/
├── lib/
│   └── agui/
│       └── use-agui-chat.js    # SSE client hook (THE core file)
├── components/
│   ├── agui/
│   │   ├── AguiAgentChat.jsx   # Main chat container
│   │   ├── MessageBubble.jsx   # User/assistant/reasoning messages
│   │   ├── ToolTrace.jsx       # Tool call cards (expandable)
│   │   ├── ChatComposer.jsx    # Textarea + send/stop
│   │   ├── ApprovalCard.jsx    # HITL approve/reject
│   │   ├── AguiFilesPanel.jsx  # Side panel (files + plan)
│   │   └── utils.js            # Helper functions
│   └── ui/                     # shadcn or custom primitives
│       ├── button.jsx
│       ├── avatar.jsx
│       └── dialog.jsx
└── app/
    ├── dashboard/agents/[id]/run/page.jsx  # Run page (wire everything)
    └── layout.js
```

#### Dependencies

```json
{
  "dependencies": {
    "@ag-ui/client": "^0.x",
    "react-markdown": "^9.x",
    "remark-gfm": "^4.x",
    "rehype-sanitize": "^6.x",
    "lucide-react": "^0.x",
    "prismjs": "^1.x",
    "react-simple-code-editor": "^0.x",
    "sonner": "^1.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  }
}
```

#### Environment Variable

```env
# Frontend runtime URL for the AG-UI SSE endpoint
NEXT_PUBLIC_AGUI_RUNTIME_URL=https://api.example.com/api/v1/agui
# Falls back to: {NEXT_PUBLIC_API_URL}/agui
```

#### Minimal Frontend Integration

```jsx
function AgentChatPage({ agentId, threadId }) {
  const chat = useAguiChat({
    url: '/api/v1/agui',
    agentId,
    threadId,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Agent-Id': agentId,
      'X-Thread-Id': threadId,
    },
    onTitleGenerated: (title) => updateThreadTitle(threadId, title),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {chat.conversation.length === 0 ? (
          <EmptyState onSend={chat.send} />
        ) : (
          <>
            {chat.conversation.map((entry) => {
              if (entry.type === 'message') {
                const msg = chat.messages.find(m => m.id === entry.refId);
                return msg ? <MessageBubble key={entry.id} message={msg} /> : null;
              }
              if (entry.type === 'tool') {
                const tool = chat.toolCalls.find(t => t.id === entry.refId);
                return tool ? <ToolTrace key={entry.id} tool={tool} /> : null;
              }
              return null;
            })}
            {chat.isRunning && <ThinkingDots />}
          </>
        )}
      </div>
      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={() => chat.send(input)}
        onStop={chat.stop}
        isRunning={chat.isRunning}
      />
    </div>
  );
}
```

### Implementation Checklist

#### Phase 1: Core Streaming (Week 1)

- [ ] Set up backend SSE endpoint (`POST /api/v1/agui`)
- [ ] Implement auth middleware (Clerk / your auth provider)
- [ ] Implement thread resolution (MongoDB or your DB)
- [ ] Integrate LangGraph agent (or any streaming AI framework)
- [ ] Build AG-UI translator: `on_chat_model_stream` → `TEXT_MESSAGE_CHUNK`
- [ ] Build frontend SSE client (`useAguiChat`)
- [ ] Build `MessageBubble` component (user + assistant roles)
- [ ] Build `ChatComposer` component
- [ ] Handle `RUN_STARTED` / `RUN_FINISHED` lifecycle
- [ ] Handle streaming errors gracefully

#### Phase 2: Tool Calls (Week 2)

- [ ] Add tool resolution to agent factory
- [ ] Translate `on_tool_start` → `TOOL_CALL_CHUNK`
- [ ] Translate `on_tool_end` → `TOOL_CALL_RESULT`
- [ ] Build `ToolTrace` component with expandable content
- [ ] Implement tool clustering (`CollapsibleToolGroup`)
- [ ] Handle tool errors (`on_tool_error` → error result)
- [ ] Optimistic state mirroring from tool results

#### Phase 3: Interrupt Handling (Week 2-3)

- [ ] Implement `interruptOn` guarded tools in agent config
- [ ] Handle `GraphInterrupt` in translator → `CUSTOM:hitl_request`
- [ ] Build `ApprovalCard` with approve/reject buttons
- [ ] Implement `Command({ resume })` for resuming
- [ ] Build `ClarificationCard` multi-question wizard
- [ ] Handle `ask_clarification` tool
- [ ] Handle both HITL and clarification resume in `useAguiChat`

#### Phase 4: State & Persistence (Week 3)

- [ ] Implement `STATE_SNAPSHOT` with files + todos
- [ ] Build `AguiFilesPanel` (code viewer + plan)
- [ ] Implement checkpointing (MongoDB or your DB)
- [ ] Implement thread history loading (resume from checkpoint)
- [ ] Normalize LangGraph serialized messages on load
- [ ] Implement auto-titling (LLM generates thread title)

#### Phase 5: Advanced Features (Week 4)

- [ ] Subagent delegation + `subagent_activity` events
- [ ] Build `SubagentActivityDialog` modal
- [ ] MCP App widget support (`mcp_app` event)
- [ ] Build `MCPAppRenderer`
- [ ] Virtual filesystem with version history
- [ ] Reasoning token display (collapsible "Thoughts")
- [ ] Subagent trace persistence
- [ ] ✅ Write integration tests (SSE stream parsing, event types, interrupt flows)
- [ ] ✅ Write component tests (MessageBubble, ToolTrace, ApprovalCard)

---

## Appendix A: Key Files Reference

| File | Purpose | Lines | Complexity |
|---|---|---|---|
| `agent-backend/src/modules/agui/aguiTranslator.js` | LangGraph → AG-UI translation | ~660 | 🔴🔴🔴 |
| `agent-backend/src/modules/agui/agui.service.js` | Agent orchestration | ~160 | 🔴🔴 |
| `agent-backend/src/modules/agui/agui.controller.js` | SSE setup + stream | ~110 | 🔴🔴 |
| `agent-backend/src/modules/agui/RunScopeTracker.js` | Run ancestry callback for subagent attribution | ~40 | 🟡 |
| `agent-backend/src/modules/agui/subagentTrace.js` | Subagent timeline folding & persistence | ~80 | 🟡 |
| `agent-backend/src/modules/agents/agent.factory.js` | Agent graph compilation | ~310 | 🔴🔴🔴 |
| `agent-backend/src/modules/agents/agent.service.js` | Agent CRUD + search | ~200 | 🟡 |
| `frontend/src/lib/agui/use-agui-chat.js` | SSE client + state machine | ~470 | 🔴🔴🔴 |
| `frontend/src/components/agents/agui/AguiAgentChat.jsx` | Main chat container | ~370 | 🔴🔴 |
| `frontend/src/components/agents/agui/MessageBubble.jsx` | Message rendering | ~180 | 🟡 |
| `frontend/src/components/agents/agui/ToolTrace.jsx` | Tool card rendering | ~330 | 🔴🔴 |
| `frontend/src/components/agents/agui/AguiFilesPanel.jsx` | Files/plan side panel | ~300 | 🔴🔴 |
| `frontend/src/components/agents/agui/ApprovalCard.jsx` | HITL + clarification UI | ~130 | 🟡 |
| `frontend/src/components/agents/agui/ChatComposer.jsx` | Input composer | ~85 | 🟢 |

## Appendix B: State Shape Reference

```typescript
// Messages stored in useAguiChat
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'reasoning' | 'system';
  content: string;
}

// Tool calls stored in useAguiChat
interface ToolCall {
  id: string;
  name: string;
  argumentsText: string;
  resultText: string;
  status: 'running' | 'completed';
  subEvents?: SubEvent[];
  mcpApp?: { resourceUri: string; mcpId: string };
  structuredResult?: any;
}

// Subagent timeline entries
interface SubEvent {
  type: 'text' | 'tool';
  text?: string;        // for text events
  name?: string;        // for tool events
  argsText?: string;
  resultText?: string;
  status?: 'running' | 'completed';
}

// Virtual filesystem state (from STATE_SNAPSHOT)
interface AgentState {
  files: Record<string, {
    content: string;
    size: number;
    created_at: string | null;
    modified_at: string | null;
  }>;
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}

// HITL approval request
interface ApprovalRequest {
  actionRequests: Array<{
    name: string;
    args: Record<string, any>;
    [key: string]: any;
  }>;
  reviewConfigs: Array<any>;
}

// Clarification request
interface ClarificationRequest {
  questions: Array<{
    id: string;
    text: string;
    options: string[];
    required: boolean;
    allowCustom: boolean;
  }>;
  currentIndex: number;
  answers: ClarificationAnswer[];
}

interface ClarificationAnswer {
  questionId: string;
  question: string;
  answer: string;
  optionIndex: number | null;
  freeform: boolean;
  skipped: boolean;
}
```

## Appendix C: Python / FastAPI Blueprint

If you're implementing this with Python (FastAPI + LangChain/LangGraph):

```python
# backend/agui/translator.py
async def translate_langgraph_stream(stream: AsyncIterator, agent_instance):
    yield {"type": "RUN_STARTED", "threadId": thread_id, "runId": run_id}

    async for event in stream:
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if "content" in chunk and chunk["content"]:
                yield {
                    "type": "TEXT_MESSAGE_CHUNK",
                    "messageId": str(uuid.uuid4()),
                    "role": "assistant",
                    "delta": chunk["content"],
                }
        elif event["event"] == "on_tool_start":
            yield {
                "type": "TOOL_CALL_CHUNK",
                "toolCallId": event["run_id"],
                "toolCallName": event["name"],
                "delta": json.dumps(event["data"]["input"]),
            }
        elif event["event"] == "on_tool_end":
            yield {
                "type": "TOOL_CALL_RESULT",
                "messageId": str(uuid.uuid4()),
                "toolCallId": event["run_id"],
                "content": str(event["data"]["output"]),
                "role": "tool",
            }

    yield {"type": "RUN_FINISHED", "threadId": thread_id, "runId": run_id}


# backend/routes/agui.py
@router.post("/agui")
async def run_agent(request: Request):
    body = await request.json()
    langgraph_thread_id = resolve_thread(body.get("threadId"))

    agent = build_agent(body["agentId"], request.user.id)
    stream = agent.astream_events(
        {"messages": [HumanMessage(content=body["messages"][-1]["content"])]},
        {"configurable": {"thread_id": langgraph_thread_id}},
        version="v2",
    )

    async def event_generator():
        async for event in translate_langgraph_stream(stream, agent):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

```python
# The frontend useAguiChat hook works identically — it's framework-agnostic
# and only cares about the SSE event shape, not the backend language.
```

---

> **This document is a living reference**. When you add new event types, UI components, or backend patterns, update it here so other projects can benefit.

---

## Appendix D: Real-World Implementation — BeyondCampus

BeyondCampus (study abroad consultancy platform at `D:\projects\BeyondCampus`) is actively integrating the AG-UI protocol. See the migration plan at `specs/AGUI-MIGRATION-PLAN.md` on the `discovery-intern-memory` branch.

### Key Differences in BeyondCampus's Implementation

| Aspect | AG-UI Standard | BeyondCampus Adaption |
|---|---|---|
| **Agent engine** | `deepagents` (`createDeepAgent`) | Dual-engine: `createAgent` (LangChain) for Maya chat, `createDeepAgent` for specialists (`src/lib/harness/core/factory.ts`) |
| **Checkpointer** | MongoDB `MongoDBSaver` | Postgres via `@langchain/langgraph-checkpoint-postgres` |
| **Interactive UI** | `CUSTOM:hitl_request` / `CUSTOM:clarification_request` | `{ type: 'ui', block, props }` with a **block registry** (`src/components/chat/blocks/registry.tsx`) — agents return `{ ui: { block, props } }` from tool output |
| **Reasoning display** | `REASONING_MESSAGE_START/CONTENT/END` | Not yet implemented (planned for Phase 1.4) |
| **Thread management** | Manual thread CRUD via REST API | Postgres `ChatThread` + `ChatMessage` models with auto-creation on first send |
| **Frontend hook** | `useAguiChat` (`@ag-ui/client`) | Inline SSE parsing in `ChatInterface.tsx` (to be extracted in Phase 2) |

### Block Registry Pattern (Notable Innovation)

BeyondCampus introduces a **block registry** that's worth standardizing into AG-UI:

```typescript
// Agent tool returns structured data with a block name + props
return JSON.stringify({
  ui: {
    block: "approval",
    props: { title: "Approve this plan?", summary: "..." }
  }
});

// Backend detects `ui.block` → emits { type: "ui", block, id, props }
// Frontend registry maps block name → React component
const BLOCKS = {
  approval: Approval,
  feedback: FeedbackBlock,
  form: FormBlock,
  questions: QuestionsBlock,
};
```

This pattern is cleaner than sending raw JSX or markdown — agents emit structured data, the frontend owns the rendering. Consider adopting it as an alternative to `CUSTOM` events for interactive components.

### Implementation Status

| Phase | Description | Status |
|---|---|---|
| 1.1 | Add `RUN_STARTED` / `RUN_FINISHED` lifecycle | ✅ Done |
| 1.2 | Add `toolCallId` + full args to tool events | ✅ Done |
| 1.3 | Full tool result content (remove 200-char truncation) | ✅ Done |
| 1.4 | Add reasoning token streaming | ✅ Done |
| 2 | Extract `useUniversityChat` hook (`useAguiChat` universal hook) | ✅ Done |
| 3 | Build `ToolTrace` + `ToolGroup` components | ✅ Done |
| 4 | State snapshot + side panel | 🟡 Snapshot + plan checklist done; files panel future |
| 5 | Translator parity port (`src/lib/harness/agui/`): subagent scoping + `RunScopeTracker`, interrupt pause/resume, auto-titling | ✅ Done (July 2026) |
