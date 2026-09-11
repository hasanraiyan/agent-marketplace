# TODO: Agent Architecture Toggle (DeepAgent vs ReAct Agent)

Implementation and verification tracking for the per-Agent architecture toggle (`agentType: 'deepagent' | 'react'`, default: `'deepagent'`).

Incorporates all requirements from `prompt.md` and review feedback from `review.md`.

---

## 1. Backend: Data Model & Validation

- [ ] **1.1 Agent Mongoose Schema**
  - **File:** `agent-backend/src/modules/agents/agent.model.js`
  - Add `agentType` property next to `sandboxEnabled`:
    ```js
    agentType: {
      type: String,
      enum: ['deepagent', 'react'],
      default: 'deepagent',
    },
    ```

- [ ] **1.2 Agent Validation Schemas**
  - **File:** `agent-backend/src/modules/agents/agent.validator.js`
  - In `createAgentSchema`, add:
    ```js
    agentType: z.enum(['deepagent', 'react']).default('deepagent'),
    ```
  - In `updateAgentSchema`, add:
    ```js
    agentType: z.enum(['deepagent', 'react']).optional(),
    ```

---

## 2. Backend: Agent Factory (`agent.factory.js`)

- [ ] **2.1 Imports & Dependencies**
  - **File:** `agent-backend/src/modules/agents/agent.factory.js`
  - Update `langchain` import to include `createAgent`:
    ```js
    import { createMiddleware, createAgent } from 'langchain';
    ```

- [ ] **2.2 Agent Type Resolution**
  - Compute `const agentType = agent.agentType === 'react' ? 'react' : 'deepagent';` right after resolving `agent`.
  - Ensure synthetic architect agents (`ARCHITECT_AGENT_ID`, `PROJECT_ARCHITECT_AGENT_ID`, `DEVELOPER_ARCHITECT_AGENT_ID`) continue to default to `'deepagent'`.

- [ ] **2.3 System Prompt Customization**
  - Define prompt sections:
    - Base prompt: `${agent.systemPrompt}`
    - **`PRESENT_FILE_RULES`**:
      ```markdown
      ### PRESENT FILE RULES
      - When you want to showcase or highlight a file to the user, call the `present_file` tool.
      - The frontend will automatically display a clean inline card with an "Open" button on the user's screen.
      - Therefore, do NOT repeat the file path, location, or description in your text response. Keep your text response minimal to avoid duplicating the information on the user's screen.
      ```
    - **`MEMORY_RULES`** (Persistent Memory) & **`SUBAGENT_RULES`** (Sub-Agent Workspace).
  - For `deepagent`: append `PRESENT_FILE_RULES` + `MEMORY_RULES` + `SUBAGENT_RULES`.
  - For `react`: append only `PRESENT_FILE_RULES` (omit memory and subagent sections to avoid hallucinated tool expectations).

- [ ] **2.4 Gated DeepAgent Subsystems**
  - Gate deepagent-only subsystems under `if (agentType === 'deepagent')`:
    - `backendRoutes` setup (virtual filesystem mounts: `/skills/`, `/memories/user/`, `/memories/agent/`, `/workspace/`)
    - `storeMounts` iteration
    - `/skill-library/` mounts for Architect agents
    - `sandboxBackend` resolution (`sandboxBackend` remains `null` for `react` mode)
    - `interruptOnConfig` computation

- [ ] **2.5 Agent Construction Branching**
  - Instantiate via `createAgent` for `react` mode and `createDeepAgent` for `deepagent`:
    ```js
    const agentInstance = agentType === 'react'
      ? await createAgent({
          model: llm,
          systemPrompt: personalizedPrompt,
          checkpointer: safeCheckpointer,
          store: getGlobalStore(),
          tools: dynamicTools,
          middleware: [contextOverrideMiddleware],
        })
      : await createDeepAgent({
          model: llm,
          systemPrompt: personalizedPrompt,
          checkpointer: safeCheckpointer,
          store: getGlobalStore(),
          tools: dynamicTools,
          interruptOn: interruptOnConfig,
          middleware: [contextOverrideMiddleware],
          backend,
          skills: ['/skills/'],
          memory: ['/memories/user/index.md', '/memories/agent/index.md'],
          subagents: [ /* ... */ ],
        });
    ```

- [ ] **2.6 Factory Logging**
  - Add `agentType` to `'[AgentFactory] building agent'` log call.
  - Add `agentType` to `'[AgentFactory] agent built'` log call.

---

## 3. Workflow Snapshot-Pinning Gap Fix

- [ ] **3.1 Workflow Version Schema**
  - **File:** `agent-backend/src/modules/developer/workflows/workflowVersion.model.js`
  - Add `agentType` to `agentSnapshotSchema`:
    ```js
    agentType: {
      type: String,
      enum: ['deepagent', 'react'],
      default: 'deepagent',
    },
    ```

- [ ] **3.2 Workflow Publishing Snapshot Capture**
  - **File:** `agent-backend/src/modules/developer/workflows/workflow.service.js`
  - In `publishWorkflow`, include `agentType: agentDoc.agentType || 'deepagent'` in the snapshot dictionary mapped per `node.id`.

- [ ] **3.3 Workflow Step Executor Instantiation**
  - **File:** `agent-backend/src/modules/developer/workflows/workflow.factory.js`
  - In `createAgentStepExecutor`, include `agentType: snapshot.agentType || 'deepagent'` in the synthetic `agentDoc` when `config.pinSnapshot` is true.

---

## 4. Frontend: Agent Form (`platform/src/components/agents/agent-form.tsx`)

- [ ] **4.1 TypeScript Types & State**
  - **File:** `platform/src/components/agents/agent-form.tsx`
  - Update `AgentDoc`: add `agentType?: "deepagent" | "react";`.
  - Update `AgentFormState`: add `agentType: "deepagent" | "react";`.
  - Update `EMPTY_FORM`: set `agentType: "deepagent"`.
  - In `useEffect` (agent data fetch): populate `agentType: (found.agentType as "deepagent" | "react") || "deepagent"`.
  - In `handleSubmit`: include `agentType: form.agentType` in `payload`.

- [ ] **4.2 Architecture Selector UI**
  - In the Configuration card (placed after Category/Visibility row), render a `Select` component for Architecture:
    - Options:
      - **Deep Agent (full features):** Includes virtual filesystem, memory, skills, and subagent delegation.
      - **ReAct Agent (lightweight):** Direct model + tools execution for lower latency and token usage.
    - Helper description explaining what is omitted in ReAct mode (filesystem, skills, memory, subagents, approval gates).

- [ ] **4.3 Conditional Field Gating**
  - Wrap Sandbox `Switch` block in `{form.agentType === "deepagent" && (...)}`.
  - Wrap Skills `AttachPicker` in `{form.agentType === "deepagent" && (...)}`.
  - Ensure Knowledge, MCP, REST Tools, RCP Sources, and Stores pickers remain visible for both modes.

---

## 5. Architectural Gap & Thread Compatibility Verification (from review.md)

- [ ] **5.1 Existing Thread Checkpoint Channel Compatibility Check**
  - **Context:** `deepagents`' graph declares channels like `files` and `todos`, while `createAgent` does not.
  - **Action:** Test resuming an existing thread that was initiated under `deepagent` after toggling the agent to `react`.
  - **Verification:** Verify that LangGraph loads `messages` and ignores the extra `files`/`todos` channels without deserialization or runtime errors. If an issue is found, add a channel sanitizer or compatibility handler to `safeCheckpointer`.

---

## 6. Automated & Manual Verification

- [ ] **6.1 Automated Unit Tests**
  - Add/update tests in `agent-backend/tests/`:
    - `agent.validator.test.js`: verify valid `agentType` enum values and default `'deepagent'`.
    - `agent.factory.test.js`: verify build parameters when `agentType` is `'react'` vs `'deepagent'`.
    - `workflow.service.test.js`: verify `agentType` persistence in workflow version snapshots.

- [ ] **6.2 Manual Verification Scenarios**
  - **Scenario 1: Regression (deepagent, unchanged agents)**
    - Run an existing agent without `agentType` set; verify identical behavior and toolset.
  - **Scenario 2: ReAct mode in Playground**
    - Set an agent to `agentType: 'react'`.
    - Run a query and verify absence of `ls`/`grep`/filesystem tool calls, lower latency, and clean response streaming.
    - Test `ask_clarification` to confirm `interrupt()` functions correctly under `createAgent`.
  - **Scenario 3: Unpinned Workflow Agent Step**
    - Run a workflow with an unpinned ReAct agent step; verify `agentType: 'react'` is used.
  - **Scenario 4: Pinned Workflow Agent Step**
    - Publish workflow with `pinSnapshot: true`; confirm pinned step builds as `react` mode and streams text correctly.
  - **Scenario 5: Cache Invalidation Toggle Round-Trip**
    - Toggle `deepagent` -> `react` -> `deepagent`, verifying that `updatedAt` triggers rebuild on the immediate next run.
  - **Scenario 6: Cross-Mode Thread Continuity**
    - Converse with an agent in `deepagent` mode, switch to `react` mode, and continue the conversation on the same thread to confirm checkpoint resumption stability.
