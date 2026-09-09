# Agent Architect — Threads, Memory, and Filesystem Tools Investigation

This document records the architectural findings on:
1. Why the **Agent Architect** has no threads in the Developer Platform Playground.
2. Why the Architect's **memory, workspace files, and filesystem tool operations** are invisible in the UI.

---

## 1. Why the Agent Architect Does Not Have Threads

### A. Frontend Exclusion in the Playground UI
- **Location:** [`platform/src/app/projects/[projectId]/playground/page.tsx`](file:///D:/projects/agent-marketplace/platform/src/app/projects/%5BprojectId%5D/playground/page.tsx#L281-L320)
- **Current Behavior:**
  The thread switcher button (`threadsOpen`) and the [`<AgentThreadsSidebar>`](file:///D:/projects/agent-marketplace/platform/src/components/playground/agent-threads-sidebar.tsx) component are conditionally wrapped inside:
  ```tsx
  {!showingArchitect && selectedAgent && (
    // Threads toggle button + AgentThreadsSidebar are ONLY rendered here
  )}
  ```
  When **Agent Architect** is selected, `showingArchitect` evaluates to `true`. As a result, the threads sidebar and the threads list button are completely omitted from the DOM.

### B. Backend Architecture Bypasses MongoDB Thread Documents
- **Location:** [`agent-backend/src/modules/projects/projectArchitect.controller.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/projects/projectArchitect.controller.js#L18-L23)
- **Current Behavior:**
  For standard project agents, each chat session creates or loads a persisted MongoDB `Thread` document (via `/api/v1/threads`), which tracks conversation IDs, titles, timestamps, and message history checkpoints.
  However, for the Architect, the backend controller explicitly omits `Thread` document creation:
  ```javascript
  // projectArchitect.controller.js:
  // "No Thread resume / subagent-trace persistence: this conversation has
  //  no DB-backed Thread document (Project Thread CRUD is scoped to
  //  ProjectRuntimeContext only, not Admins) — just a deterministic
  //  LangGraph thread id scoped to the Project, one shared conversation
  //  per Project regardless of which of its Admins is chatting..."
  const langGraphThreadId = `architect-${context.domain}`;
  ```
  The endpoint (`/api/v1/projects/:projectId/architect/agui`) sets `langGraphThreadId = architect-<projectId>`, but **never creates, updates, or indexes a record in the MongoDB `threads` collection**.

### C. Client Starts With Empty Transcript on Every Mount
- **Location:** [`platform/src/components/playground/architect-chat.tsx`](file:///D:/projects/agent-marketplace/platform/src/components/playground/architect-chat.tsx#L55-L66)
- **Current Behavior:**
  Because no `Thread` document exists in the database, the `/threads` query never returns threads for the Architect sentinel (`000000000000000000000001`).
  `ArchitectChat` initializes `useAguiChat` without an existing `threadId` and with empty `messages: []`. When the user refreshes the page or navigates away and back, the chat UI resets to an empty state.

---

## 2. Why Memory & Filesystem Tools Are Invisible for the Architect

### A. The Playground "Files" Button Ignores the Architect
- **Location:** [`platform/src/app/projects/[projectId]/playground/page.tsx`](file:///D:/projects/agent-marketplace/platform/src/app/projects/%5BprojectId%5D/playground/page.tsx#L406-L417)
- **Current Behavior:**
  The Playground header renders a "Files" button that opens `<MemoryWorkspaceDialog>`:
  ```tsx
  <MemoryWorkspaceDialog
    open={memoryOpen}
    projectId={projectId}
    activeAgentId={selectedAgent?.id}
    agents={agents}
    initialOpenPath={openFilePath}
    liveWorkspaceFiles={liveWorkspaceFiles}
  />
  ```
  When the Architect is active, `selectedAgent` is `null`, which causes `activeAgentId` to be `undefined`.
- **Impact in [`MemoryWorkspaceDialog`](file:///D:/projects/agent-marketplace/platform/src/components/playground/memory-workspace-dialog.tsx#L140-L175):**
  When `activeAgentId` is missing or undefined, `MemoryWorkspaceDialog` loads only shared project-level memories (`/memories/user/`), and **completely excludes agent-level memory (`/memories/agent/`) and workspace files (`/workspace/`)**.

### B. `ArchitectChat` Drops Filesystem State Updates
- **Location:** [`platform/src/components/playground/architect-chat.tsx`](file:///D:/projects/agent-marketplace/platform/src/components/playground/architect-chat.tsx#L42-L68)
- **Comparison with `AgentChat`:**
  In [`AgentChat`](file:///D:/projects/agent-marketplace/platform/src/components/playground/agent-chat.tsx#L198-L206), `chat.agentState.files` is actively monitored and forwarded to the parent via `onWorkspaceFilesChange`:
  ```tsx
  React.useEffect(() => {
    if (onWorkspaceFilesChange && chat.agentState?.files) {
      onWorkspaceFilesChange(chat.agentState.files);
    }
  }, [chat.agentState?.files, onWorkspaceFilesChange]);
  ```
  In [`ArchitectChat`](file:///D:/projects/agent-marketplace/platform/src/components/playground/architect-chat.tsx), there is **no `onWorkspaceFilesChange` prop**. While `useAguiChat` internally tracks state when file tools run (`applyFileToolToState`), `ArchitectChat` never bubbles these files up to `playground/page.tsx`.

### C. `ChatMessage` in `ArchitectChat` Has No File Interaction Handlers
- **Location:** [`platform/src/components/playground/architect-chat.tsx`](file:///D:/projects/agent-marketplace/platform/src/components/playground/architect-chat.tsx#L227)
- **Current Behavior:**
  ```tsx
  <ChatMessage message={a} />
  ```
  `ChatMessage` is invoked without `projectId`, `onOpenWorkspaceFile`, or `onOpenSubagent`. Consequently, if any tool references a file or interactive card, the "Open" actions are no-ops.

### D. The Backend Project Architect Toolbox Omits `present_file`
- **Location:** [`agent-backend/src/modules/tools/index.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/tools/index.js#L67-L85)
- **Current Behavior:**
  ```javascript
  if (agentConfig._id?.toString() === PROJECT_ARCHITECT_AGENT_ID) {
    return { tools: [clarificationTool, ...getProjectBuilderToolbox(context)], mcpAppMap: {} };
  }

  // Standard agents reach here:
  const presentTool = presentFileTool();
  const tools = [clarificationTool, presentTool];
  ```
  Standard agents get `present_file`, which triggers inline interactive file cards in the chat. The Architect returns early and is never given the `present_file` tool.

### E. The Architect Writes to `/skill-library/`, Which Has No Playground Viewer
- **Backend Setup:** In [`agent-backend/src/modules/agents/agent.factory.js`](file:///D:/projects/agent-marketplace/agent-backend/src/modules/agents/agent.factory.js#L801-L808), the Architect has `/skill-library/` mounted to `projectSkillLibraryStore`. When the Architect authors skills or instructions, it writes to `/skill-library/<name>/SKILL.md`.
- **Frontend Dialog:** [`MemoryWorkspaceDialog`](file:///D:/projects/agent-marketplace/platform/src/components/playground/memory-workspace-dialog.tsx#L161-L198) only mounts two explorer roots: `memories` and `workspace`. It has no knowledge of `/skill-library/`. Skills written by the Architect are invisible inside the Playground Files dialog and can only be seen by navigating to `/projects/[projectId]/skills`.

---

## 3. Recommended Remediation Plan

1. **Thread Support for Architect:**
   - Update `projectArchitect.controller.js` to create and query records using `threadRepository`, keyed by `agentId: PROJECT_ARCHITECT_AGENT_ID` and `domain: context.domain`.
   - Update `playground/page.tsx` to render the threads sidebar when `showingArchitect` is true, using `PROJECT_ARCHITECT_AGENT_ID`.
   - Pass `threadId` and `initialMessages` into `ArchitectChat` (mirroring `AgentChat`).

2. **Files & Memory Visibility:**
   - In `playground/page.tsx`, pass `activeAgentId={selectedAgent?.id || PROJECT_ARCHITECT_AGENT_ID}` to `MemoryWorkspaceDialog`.
   - Add `onWorkspaceFilesChange` and `onOpenFile` props to `ArchitectChat`, passing `chat.agentState.files` up to `setLiveWorkspaceFiles`.
   - In `ArchitectChat`, pass `projectId` and `onOpenWorkspaceFile={onOpenFile}` to `<ChatMessage />`.
   - In `agent-backend/src/modules/tools/index.js`, include `presentFileTool()` in the `PROJECT_ARCHITECT_AGENT_ID` toolbox.
   - Optionally add a `/skill-library/` root item to `MemoryWorkspaceDialog` so the Architect's skill authoring is visible directly in the Files modal.
