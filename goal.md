# Goal: Unified Implementation Plan - Multi-Agent Support, Clerk Sync, and Premium Chat Bot UI Upgrade

This document outlines the detailed roadmap for upgrading our platform. It includes:
2. **Premium Chat UI & Tool Views (Inspired by Dostify)**: Transforming the chat interface, adding sub-agent activity modal dialogs, syntax-highlighted file viewers, diff views, and advanced event translation on the backend.

---

Premium Chat UI & Tool Cards (Inspired by Dostify)

To match the rich user experience of the Dostify chat, we will build specialized components and extend backend streaming events to correlate sub-agent runs.

### 1. Frontend Chat Interface Upgrades (`frontend/src/components/agents/agui/`)

#### A. Interactive Sub-Agent Activity Dialog (`SubagentActivityDialog.jsx`)
When the main agent delegates a task to a sub-agent (the `task` tool is called), it should not clutter the main feed. Instead:
- The sub-agent's internal reasoning, messages, and tools are hidden from the main transcript.
- Tapping the `task` tool card opens a detailed modal (`SubagentActivityDialog`) displaying:
  - The sub-agent's goal/title in a distinct banner.
  - Live status badges (`Running`, `Completed`, `Denied`, `Canceled`).
  - A dedicated list of sub-agent bubbles (text, reasoning, and child tool executions) tagged with that task's ID.

#### B. Collage/Diff Viewer for File Edits (`DiffView.jsx`)
- For `write_file` or `edit_file` tools, render an inline side-by-side or unified diff view.
- Highlight deleted lines in red (`-`) and added lines in green (`+`).

#### C. Collapsible & Line-Numbered File Viewer (`LargeTextFileView.jsx`)
- For `read_file` or `view_file` results, avoid dumping plain text.
- Render them with line numbers, code syntax highlighting, and a collapsible max-height panel.

#### D. Enhanced Search Results Card
- Update the web search rendering to show clean query cards, domain icons (using favicon service), and readable snippets.

---

## Part 3: Subagent Event Correlation & Streaming

### 1. LangChain Callback Tracker (`agent-backend/src/utils/RunScopeTracker.js`)
We will port Dostify's callbacks to record the run ancestry hierarchy (parent-child links) for parallel/nested tool and model invocations.

```javascript
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';

export class RunScopeTracker extends BaseCallbackHandler {
  name = 'persona-run-scope-tracker';
  parentOf = new Map(); // runId -> parentRunId

  record(runId, parentRunId) {
    if (parentRunId && !this.parentOf.has(runId)) {
      this.parentOf.set(runId, parentRunId);
    }
  }

  handleLLMStart(llm, prompts, runId, parentRunId) { this.record(runId, parentRunId); }
  handleChatModelStart(llm, messages, runId, parentRunId) { this.record(runId, parentRunId); }
  handleChainStart(chain, inputs, runId, parentRunId) { this.record(runId, parentRunId); }
  handleToolStart(tool, input, runId, parentRunId) { this.record(runId, parentRunId); }
}
```

### 2. Backend Stream Translation (`agent-backend/src/utils/aguiTranslator.js`)
- Integrate the `RunScopeTracker` in the AG-UI router.
- Update `translateLangGraphStream` to map model chunks and tool events to the enclosing `task` (subagent) tool:
  - Check if `ev.metadata?.lc_agent_name` is present to flag `isSubagentEvent`.
  - Resolve the subagent scope ID (`resolveTaskScope`) by walking up the parent-run ancestry chain.
  - Tag sub-events with `parentTaskCallId` and emit them as custom `subagent_activity` events to feed the frontend's timeline.

---

## Part 4: Advanced Engine Upgrades

### 1. Graceful Tool Failure Middleware
- Wrap tool executions with error-handling middleware so a failed tool returns an error payload inside the `ToolMessage` instead of throwing an unhandled exception and crashing the entire LangGraph run.

### 2. File-Based Long-Term Memory (Persistent across Threads)
- Build file-backed long-term memory support (StoreBackend on MongoDB) scoped by user ID.
- Automatically load the user's memory index `/memories/index.md` into the agent context on startup.

### 3. Usage & Cost Tracking
- Log token consumption (input/output) and tool execution counts.
- Add pricing rate configurations to calculate and expose dollar costs per chat run and thread in `/api/usage` endpoints.

---

## Reference File Paths

### A. Our Project Target Files
- **Backend Schemas & Middleware**:
  - [User Model](file:///D:/projects/agent-marketplace/agent-backend/src/models/User.js)
  - [Agent Model](file:///D:/projects/agent-marketplace/agent-backend/src/models/Agent.js)
  - [Clerk Webhook Router](file:///D:/projects/agent-marketplace/agent-backend/src/routes/webhook.routes.js)
  - [Auth Middleware](file:///D:/projects/agent-marketplace/agent-backend/src/middlewares/auth.middleware.js)
  - [Optional Auth Middleware](file:///D:/projects/agent-marketplace/agent-backend/src/middlewares/optionalAuthMiddleware.js)
- **Backend Services & Streaming**:
  - [Agent Service](file:///D:/projects/agent-marketplace/agent-backend/src/services/agent.service.js)
  - [Agent Factory](file:///D:/projects/agent-marketplace/agent-backend/src/factories/agentFactory.js)
  - [AG-UI Translator / Stream Formatter](file:///D:/projects/agent-marketplace/agent-backend/src/utils/aguiTranslator.js)
  - [Tool Registry Index](file:///D:/projects/agent-marketplace/agent-backend/src/tools/index.js)
- **Frontend Pages & Components**:
  - [My Agents Page (Dashboard)](file:///D:/projects/agent-marketplace/frontend/src/app/dashboard/agents/page.jsx)
  - [Agent Builder Workspace Page](file:///D:/projects/agent-marketplace/frontend/src/components/agents/agent-builder-page.jsx)
  - [Agent Config Form](file:///D:/projects/agent-marketplace/frontend/src/components/agents/agent-form.jsx)
  - [Chat Stream Hook Handler](file:///D:/projects/agent-marketplace/frontend/src/lib/agui/use-agui-chat.js)
  - [Main Chat Interface Component](file:///D:/projects/agent-marketplace/frontend/src/components/agents/agui/AguiAgentChat.jsx)
  - [Collapsible Tool Trace Card](file:///D:/projects/agent-marketplace/frontend/src/components/agents/agui/ToolTrace.jsx)
  - [Message Bubbles (Reasoning & Text)](file:///D:/projects/agent-marketplace/frontend/src/components/agents/agui/MessageBubble.jsx)

### B. Dostify Reference Source Files (Aesthetics & Architecture)
- **Dostify Backend (NestJS)**:
  - [Dostify Core Agent Service](file:///d:/projects/dostify/backend/src/agent/agent.service.ts)
  - [Dostify Run Ancestry Tracker Callback](file:///d:/projects/dostify/backend/src/agent/run-scope-tracker.ts)
- **Dostify Frontend (Flutter)**:
  - [Dostify Subagent Activity Live Modal](file:///d:/projects/dostify/dostify/lib/features/chat/presentation/chat_subagent_activity_dialog.dart)
  - [Dostify Custom Tool Trace Renderer](file:///d:/projects/dostify/dostify/lib/features/chat/presentation/chat_tool_trace.dart)
  - [Dostify Main Messages Panel](file:///d:/projects/dostify/dostify/lib/features/chat/presentation/chat_messages_panel.dart)
 