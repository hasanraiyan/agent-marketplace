# TODO: Agent Architecture Toggle (DeepAgent vs ReAct Agent)

Track the implementation and verification of the per-Agent architecture toggle (`agentType: 'deepagent' | 'react'`, default: `'deepagent'`).

---

## 1. Backend: Data Model & Validation

- [ ] **1.1 Agent Mongoose Schema**
  - **File:** `agent-backend/src/modules/agents/agent.model.js`
  - Add `agentType` next to `sandboxEnabled`:
    ```js
    agentType: {
      type: String,
      enum: ['deepagent', 'react'],
      default: 'deepagent',
    },
    ```

- [ ] **1.2 Agent Validation Schemas**
  - **File:** `agent-backend/src/modules/agents/agent.validator.js`
  - Update `createAgentSchema`:
    ```js
    agentType: z.enum(['deepagent', 'react']).default('deepagent'),
    ```
  - Update `updateAgentSchema`:
    ```js
    agentType: z.enum(['deepagent', 'react']).optional(),
    ```

---

## 2. Backend: Agent Factory (`agent.factory.js`)

- [ ] **2.1 Imports & Dependencies**
  - **File:** `agent-backend/src/modules/agents/agent.factory.js`
  - Import `createAgent` from `'langchain'` (alongside existing `createMiddleware`).

- [ ] **2.2 Agent Type Resolution**
  - Compute `const agentType = agent.agentType === 'react' ? 'react' : 'deepagent';` after `agent` is resolved.
  - Note: Hardcoded synthetic agents (`ARCHITECT_AGENT_ID`, `PROJECT_ARCHITECT_AGENT_ID`, `DEVELOPER_ARCHITECT_AGENT_ID`) lack `agentType` and safely default to `'deepagent'`.

- [ ] **2.3 System Prompt Customization**
  - Split `personalizedPrompt`:
    - Always include `agent.systemPrompt`.
    - **For `deepagent`:** Append full `### PRESENT FILE RULES`, `### PERSISTENT MEMORY RULES (file-based)`, and `### SUB-AGENT WORKSPACE RULES`.
    - **For `react`:** Append only a trimmed `### PRESENT FILE RULES` section; omit persistent memory and sub-agent workspace rules to prevent model confusion.

- [ ] **2.4 Gated DeepAgent Subsystems**
  - Gate deepagents-only assembly under `if (agentType === 'deepagent')`:
    - `backendRoutes` setup (virtual filesystem mounts for `/skills/`, `/memories/user/`, `/memories/agent/`, `/workspace/`)
    - `storeMounts` iteration
    - `/skill-library/` mounts for Architect agents
    - `sandboxBackend` resolution via `getSandboxBackend` (set `sandboxBackend = null` for `react` mode)
    - `interruptOnConfig` computation

- [ ] **2.5 Agent Construction Branching**
  - Branch instantiation:
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
  - Add `agentType` to:
    - `'[AgentFactory] building agent'` log payload.
    - `'[AgentFactory] agent built'` log payload.

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
  - In `createAgentStepExecutor`, include `agentType: snapshot.agentType || 'deepagent'` in the synthetic `agentDoc` generated when `config.pinSnapshot` is true.

---

## 4. Frontend: Agent Form (`platform/src/components/agents/agent-form.tsx`)

- [ ] **4.1 TypeScript Types & State**
  - **File:** `platform/src/components/agents/agent-form.tsx`
  - Update `AgentDoc`: add `agentType?: "deepagent" | "react";`.
  - Update `AgentFormState`: add `agentType: "deepagent" | "react";`.
  - Update `EMPTY_FORM`: set `agentType: "deepagent"`.
  - In `useEffect` (loading existing agent): populate `agentType: (found.agentType as "deepagent" | "react") || "deepagent"`.
  - In `handleSubmit`: include `agentType: form.agentType` in `payload`.

- [ ] **4.2 Architecture Selector UI**
  - In the Configuration card (below Category/Visibility row), render a `Select` component for Architecture:
    - Options:
      - **Deep Agent (full features):** Includes virtual filesystem, memory, skills, and subagent delegation.
      - **ReAct Agent (lightweight):** Direct model + tools execution for lower latency and token usage.
    - Informative helper text describing unsupported features in ReAct mode.

- [ ] **4.3 Conditional Field Gating**
  - Wrap Sandbox `Switch` block in `{form.agentType === "deepagent" && (...)}`.
  - Wrap Skills `AttachPicker` in `{form.agentType === "deepagent" && (...)}`.
  - Keep Knowledge, MCP, REST Tools, RCP Sources, and Stores pickers visible for both modes.

---

## 5. Automated Tests & Verification

- [ ] **5.1 Unit / Integration Tests**
  - Update `agent-backend/tests/` suites:
    - Test validation for `agentType` (`createAgentSchema` and `updateAgentSchema`).
    - Verify `agent.factory.js` building `agentType: 'react'` with `createAgent` vs `agentType: 'deepagent'` with `createDeepAgent`.
    - Verify workflow publishing preserves `agentType` in snapshots and synthetic `agentDoc`.

- [ ] **5.2 Manual Verification Scenarios**
  - **Scenario 1: Regression (deepagent, unchanged agents)**
    - Run an existing agent without explicit `agentType` through Playground; verify identical behavior.
  - **Scenario 2: ReAct mode in Playground**
    - Set an agent to `agentType: 'react'`.
    - Run queries (e.g. sales summary or tool execution) and verify no `ls`/`grep` tool calls in trace, lower latency, and proper streaming.
    - Test `ask_clarification` to verify `interrupt()` works under `createAgent`.
  - **Scenario 3: Unpinned Workflow Agent Step**
    - Create/run workflow with an unpinned ReAct agent step; verify it uses `agentType: 'react'`.
  - **Scenario 4: Pinned Workflow Agent Step**
    - Publish workflow with `pinSnapshot: true`; verify pinned step executes as `react` mode.
    - Test streaming text attribution to workflow node (`checkpoint_ns: ''` regression check).
  - **Scenario 5: Cache Invalidation Toggle Round-Trip**
    - Toggle `deepagent` -> `react` -> `deepagent` and verify immediate pickup on each subsequent run without stale cache.
