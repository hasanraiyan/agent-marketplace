# Runtime State Isolation Audit

> **Status:** Codebase research (2026-07-29)
> **Scope:** `agent-backend/src/modules/` — AG-UI, threads, memory, agents (factory, service, model), auth, MCP, tools, upload, knowledge
> **Purpose:** Determine current runtime isolation guarantees and identify what must change for the Developer Platform requirement of shared-agent-definition + isolated-per-runtime-user-state
> **Documents:** This audit of current Persona implementation; the requirements document is `01-developer-platform-requirements.md`

---

## 1. Executive Summary

Persona's current implementation assumes a **single-tenant model**: every authenticated user is a Persona user (Clerk-authenticated), and every resource — agent, thread, memory, MCP connection, file — is owned by or scoped to that Persona user ID.

The system has several strong isolation properties **within the Persona tenant**:
- Threads are scoped to `userId` (ownership check enforced in controller and repository)
- Memory is scoped to `['users', userId]` or `['users', userId, 'agents', agentId]`
- MCP user connections are scoped to `(mcpId, userId)` with a unique compound index
- Agent authorization (`canUserExecuteAgent`) enforces visibility and ownership rules
- AG-UI resolves the authenticated `userId` from Clerk, then constructs a deterministic LangGraph thread ID from `agentId + userId`

**However, none of these primitives are designed for multi-tenant (multi-Project) isolation.** Every storage key, namespace, and identity reference uses the Persona MongoDB `_id` as its sole tenant/user identifier. There is no `projectId` dimension anywhere.

The current system's isolation strengths become dangerous assumptions in a multi-Project future:
- Strong per-user isolation **within Persona** would become cross-Project leaks **without a tenant dimension**
- The deterministic `agui-${agentId}-${userId}` thread ID construction and memory namespace `['users', userId]` both embed only a Persona user ID with no Project context
- `(Project A, rahul)` and `(Project B, rahul)` would collide on every storage key

---

## 2. Current Execution Flow

### 2.1 Request Entry

```
HTTP POST /api/v1/agui
  ↓
agui.routes.js middleware:
  1. authMiddleware → Clerk authentication → syncUser → req.user (Persona User document)
  2. Read headers: x-agent-id, x-thread-id
  3. Compute langGraphThreadId:
     - If threadDbId provided: look up thread, verify thread.userId === userId,
       use thread.threadId as langGraphThreadId
     - If no threadDbId: langGraphThreadId = `agui-${agentId}-${userId}` (deterministic!)
  4. Set req.aguiContext = { userId, agentId, langGraphThreadId, threadDbId }
  ↓
agui.controller.js runAgent:
  1. Read concurrency key: `concurrency:CHAT:${userId || req.ip}`
  2. Call agentRepository.findById(agentId)
  3. Call agentService.canUserExecuteAgent(agent, userId) — authorization check
  4. Read body for messages, threadId, runId
  5. Set up SSE headers
  6. Call runAgentAsAguiEvents(context, messages, ...)
  ↓
agui.service.js runAgentAsAguiEvents:
  1. agentFactory.buildAgent(agentId, userId, checkpointer) — build the DeepAgent
  2. Check for pending interrupts (HITL) using agentInstance.getState({ configurable: { thread_id: langGraphThreadId } })
  3. Run streamEvents(inputArg, { configurable: { thread_id: langGraphThreadId }, ... })
  ↓
agent.factory.js buildAgent(agentId, userId, checkpointer):
  1. Fetch agent (+ populate skills, mcps, knowledgeBases)
  2. Fetch provider (for LLM config)
  3. Build LLM (ChatOpenAI with decrypted API key)
  4. Resolve tools (MCP, knowledge, search, builder, etc.) — passing userId for per-user MCP auth
  5. Build backend (virtual filesystem):
     - /skills/ → agents skillsStore (namespace: ['agents', agentIdStr, 'enabled'])
     - /memories/user/ → memoryFilesStore (namespace: ['users', userId])
     - /memories/agent/ → memoryFilesStore (namespace: ['users', userId, 'agents', agentIdStr])
  6. Create deepAgent with checkpointer, store, tools, backend, skills, memory
  7. Cache result by `${cacheKey}:${userId}`
```

### 2.2 Identity Flow Summary

| Identifier | Source | Where Used | Storage Key |
|---|---|---|---|
| `userId` | Clerk → auth service → syncUser → `req.user._id` (Persona MongoDB ObjectId) | AG-UI context, thread ownership, memory namespaces, MCP connections, tool resolution, concurrency rate limiting | Everywhere |
| `agentId` | HTTP header `x-agent-id` or `req.query.agentId` | Agent lookup, authorization, thread ID construction, agent factory, skill namespace | Agent model `_id` |
| `threadId` / `sessionId` | Auto-computed as `agui-${agentId}-${userId}`, or from `x-thread-id` header | LangGraph checkpointer, thread repository lookup | Conversation.threadId (UUID string), checkpointer thread_id |
| `clerkId` | Clerk JWT session | Auth middleware → syncUser lookup | User model `clerkId` field |

---

## 3. Identity Propagation

### 3.1 Where Each Identifier Enters

**`userId` enters at:**
1. `auth.middleware.js` — `getAuth(req)` → `clerkId` → `authService.syncUser(clerkId)` → returns Mongoose User document → `req.user = user`
2. `agui.routes.js` — reads `req.user._id` as `userId`
3. `agui.controller.js` — reads `context.userId` for concurrency key and auth checks
4. `agui.service.js` — passes `userId` to `agentFactory.buildAgent(agentId, userId, checkpointer)`
5. `agent.factory.js` — uses `userId` for:
   - Memory namespaces: `['users', userId]` and `['users', userId, 'agents', agentIdStr]`
   - Agent cache key: `${cacheKey}:${userId}`
   - MCP per-user token resolution in `resolveAgentTools(agent, userId)`
   - Builder tools for the Architect: `getBuilderToolbox(userId)`
   - Provider lookup: `providerRepository.findByUser(userId)`
6. `mcp.tools.js` — passes `userId` to `mcpTokenService.getUserAccessToken(mcp, userId)`
7. `mcp-user-connection.repository.js` — queries by `{ mcpId, userId }`

**`agentId` enters at:**
1. `agui.routes.js` — from HTTP header `x-agent-id`
2. `agui.controller.js` — `agentRepository.findById(context.agentId)` + `canUserExecuteAgent(agent, userId)`
3. `agui.service.js` — `agentFactory.buildAgent(agentId, userId, checkpointer)`
4. `agent.factory.js` — agent DB fetch, skill namespace `['agents', agentIdStr, 'enabled']`, memory namespace `['users', userId, 'agents', agentIdStr]`
5. Various REST endpoints — URL params

**`threadId` / `sessionId` enters at:**
1. `agui.routes.js` — computed deterministically or from `x-thread-id` header
2. `agui.controller.js` — passed as `langGraphThreadId` to event stream
3. `agui.service.js` — `agentInstance.streamEvents(inputArg, { configurable: { thread_id: langGraphThreadId } })`
4. `checkpoint.service.js` — `checkpointer.getTuple({ configurable: { thread_id: thread.threadId } })`

### 3.2 Where `userId` Is NOT Present But Might Matter

- **Qdrant vector store points** for knowledge bases: metadata stores `kbId` and `sourceName` but **not** `userId` or `ownerId`. Knowledge base ownership is enforced at the service layer (service checks `kb.ownerId.toString() !== userId.toString()`), but Qdrant points themselves have no user/tenant marker.
- **Checkpointer collections** (`checkpoints`, `checkpoint_writes`): keyed by `thread_id` only. No `userId` field on checkpoint documents.
- **Uploaded files**: saved to a flat `uploads/` directory with no user/thread scoping in filename. Only the filename pattern `avatar-${timestamp}-${random}${ext}` is used.

---

## 4. AG-UI Authorization

### 4.1 The `canUserExecuteAgent` Policy

Defined in `agent.service.js`:

```javascript
canUserExecuteAgent(agent, userId) {
  if (!agent) return false;
  // Virtual system agents (Architect) always executable
  if (agent.isVirtual === true || agent._id === '000000000000000000000000') return true;
  // Soft-deleted agents never executable
  if (agent.deletedAt) return false;
  const ownerIdStr = agent.ownerId ? agent.ownerId.toString() : null;
  const requestingIdStr = userId ? userId.toString() : null;
  const isOwner = Boolean(requestingIdStr && ownerIdStr === requestingIdStr);
  // Inactive agents only executable by owner
  if (agent.isActive === false && !isOwner) return false;
  // Private agents only executable by owner
  if (agent.visibility === 'private' && !isOwner) return false;
  // Public and unlisted active agents allowed
  return true;
}
```

### 4.2 Where Authorization Is Checked

1. **AG-UI POST (SSE stream start):** `agui.controller.js` — BEFORE SSE headers are sent, the controller fetches the agent and calls `canUserExecuteAgent`. If it fails, a 404 (not 403!) is returned.
2. **Agent factory (buildAgent):** `agent.factory.js` — SECOND check inside `buildAgent` for non-Architect agents. This is a belt-and-suspenders check since the controller already checked.
3. **Thread controller (getOne, delete, updateTitle, getMessages):** Each checks `thread.userId.toString() !== req.user.id` independently.
4. **Agent controller (getAgentById, getAgentBySlug):** Each calls `agentService.getAgentById` which internally calls `canUserExecuteAgent`.

### 4.3 Authorization Gap in AG-UI

The `x-thread-id` header bypasses agent authorization for **continuing an existing thread** if the thread was already authenticated:

In `agui.routes.js`:
```javascript
// The middleware looks up the thread, verifies ownership,
// and sets langGraphThreadId to the thread's threadId.
// The agentId from the header is still passed through to the controller.

// BUT in the controller:
try {
  agent = await agentRepository.findById(context.agentId);
} catch {
  agent = null;
}
if (!agent || !agentService.canUserExecuteAgent(agent, context.userId)) {
  throw new NotFoundError('Agent not found');
}
```

The controller **does** re-check agent authorization even when resuming a thread. However, the agent check is against the `x-agent-id` header, not against the agent the thread was originally created with. So a user could potentially resume a thread with a different `x-agent-id` than the original — the thread's `agentId` field is not verified against the requested agent.

**Risk level: Low-Medium.** The thread ownership check (`thread.userId === userId`) prevents cross-user access, but within the same user's threads the agent association could be changed.

---

## 5. Thread/Session Model

### 5.1 Thread Schema

```javascript
// thread.model.js
{
  agentId:    ObjectId (ref: Agent),     // required, indexed
  userId:     ObjectId (ref: User),       // required, indexed
  threadId:   String,                     // required, unique (UUID)
  title:      String,                     // default: 'New Conversation'
  lastMessageAt: Date,
  isArchived: Boolean,
  subagentTraces: Mixed,                  // per-task subagent timeline
  timestamps: true
}
```

### 5.2 Thread Scoping

**Question 1: What currently scopes a thread to a user?**

The `userId` field on the Conversation (thread) model. All thread operations enforce:

```javascript
// thread.repository.js
findByUser(userId) — filters by userId
// thread.controller.js
getOne: check thread.userId.toString() !== req.user.id → 404
delete: same check
updateTitle: same check
getMessages: checkpointService.getMessages checks thread.userId === userId
```

**Question 2: Can a user supply another user's thread ID? What prevents access?**

A user CAN supply another user's thread ID via the `x-thread-id` header or URL parameter. Access is prevented by:

1. **Thread lookup in agui.routes.js:**
   ```javascript
   const thread = await threadRepository.findById(threadDbId);
   if (thread && thread.userId.toString() === userId.toString()) {
     langGraphThreadId = thread.threadId;
   }
   ```
   If the thread doesn't belong to the user, `langGraphThreadId` falls back to the deterministic `agui-${agentId}-${userId}` — effectively starting a new thread.

2. **Thread controller operations** (getOne, delete, updateTitle, getMessages): all check `thread.userId.toString() !== req.user.id` and return 404.

3. **But checkpointer has no userId guard.** If someone obtained a valid `threadId` (UUID), they could potentially read checkpoint data through the checkpointer directly. There is no userId check on the checkpointer's `getTuple` call — but there's no API endpoint that exposes raw checkpointer access either. The only path is through `thread.controller.getMessages` which does the ownership check, and `checkpoint.service.getMessages` which also checks ownership.

---

## 6. Checkpoint Model

### 6.1 Checkpoint Storage

Checkpoints use `MongoDBSaver` from `@langchain/langgraph-checkpoint-mongodb`, storing in two MongoDB collections:
- `checkpoints` — checkpoint snapshots
- `checkpoint_writes` — pending writes/resumable state

### 6.2 Checkpoint Keying

**Question 7: How are checkpoints keyed?**

Checkpoints are keyed by `thread_id` only, stored in the `checkpoints` collection:

```javascript
// checkpoint.service.js
const snapshot = await this.checkpointer.getTuple({
  configurable: { thread_id: thread.threadId },
});
```

The `thread_id` used is:
- Either the Conversation document's `threadId` field (a UUID) — when a thread is being resumed
- Or the computed `agui-${agentId}-${userId}` string — when no thread is provided (first message)

### 6.3 Checkpoint Scoping Limitations

**Checkpoints are NOT scoped by userId or agentId in the storage layer.** The checkpointer collections only have a `thread_id` field. Any API key leak or administrative access to the MongoDB `checkpoints` collection would expose all conversations without user-level filtering.

However, the application layer enforces:
- Thread ownership check before `getTuple` is called (`checkpoint.service.getMessages` checks `thread.userId === userId`)
- Thread ownership check in `agui.routes.js` before resolving thread ID

---

## 7. Memory Model

### 7.1 Memory Storage

Memory uses a **file-based** approach with two stores:

1. **MemoryFilesStore** (primary, current) — MongoDB `memoryfiles` collection:
   ```javascript
   // memory-file.model.js
   {
     namespace: [String],    // e.g., ['users', userId] or ['users', userId, 'agents', agentId]
     key: String,            // e.g., '/index.md', '/preferences.md'
     content: String,
     mimeType: String,
     timestamps: true
   }
   // Unique compound index on { namespace: 1, key: 1 }
   ```

2. **MongoDBStore** (legacy, `agent_memories` collection) — still referenced in cleanup:
   ```javascript
   // mongoStore.js — used by agent factory's getGlobalStore()
   {
     namespace: [String],
     key: String,
     value: Object,
     timestamps: true
   }
   // Unique compound index on { namespace: 1, key: 1 }
   ```

### 7.2 Memory Namespace Structure

**Question 3, 4: What scopes memory? Is memory user-level, agent-level, thread-level?**

Memory has two scopes, both rooted in Persona userId:

```javascript
// memory-files-store.js
userMemoryNamespace(userId)  → ['users', String(userId)]          // user-global
agentMemoryNamespace(userId, agentId) → ['users', String(userId), 'agents', String(agentId)]  // per user+agent
```

In the agent factory, memory is mounted as:
```javascript
// agent.factory.js
'/memories/user/':  StoreBackend({ store: memoryFilesStore, namespace: ['users', userId] })
'/memories/agent/': StoreBackend({ store: memoryFilesStore, namespace: ['users', userId, 'agents', agentIdStr] })
```

**Memory is NOT thread-level.** It persists across all threads for the same `(userId, agentId)` pair. There is no `threadId` component in memory namespaces.

### 7.3 Memory Isolation

**Question 5: How does DeepAgent receive memory/user identity?**

DeepAgent receives memory through its `backend` configuration, which maps filesystem routes to StoreBackends with pre-computed namespaces:

```javascript
const backend = new CompositeBackend(..., {
  '/memories/user/': StoreBackend({ store: memoryFilesStore, namespace: userMemoryNamespace(userId) }),
  '/memories/agent/': StoreBackend({ store: memoryFilesStore, namespace: agentMemoryNamespace(userId, agentIdStr) }),
});
```

The `memory` option auto-loads specific files:
```javascript
memory: ['/memories/user/index.md', '/memories/agent/index.md']
```

The DeepAgent itself **does not receive userId or agentId as explicit parameters**. Instead, the namespaces are baked into the StoreBackend instances at construction time. The agent reads/writes files through virtual paths like `/memories/user/preferences.md`, which resolve to the pre-configured MongoDB documents.

### 7.4 Memory Isolation Strength

**Strong isolation within Persona:** Two different Persona users can never see each other's memory because their `userId` differs. Two different agents for the same user have separate agent-scoped memory.

**Weak isolation across future Projects:** There is no `projectId` dimension. If Persona introduces Projects, `(Project A, rahul)` and `(Project B, rahul)` would both use `['users', rahulsPersonaUserId]` — or if using external IDs, would collide.

---

## 8. File Model

### 8.1 Current File Upload

The upload module is minimal — only handles avatar images:

```javascript
// upload.routes.js
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});
```

**Question 8: How are uploaded/runtime files associated with users/threads/agents?**

- **Avatar uploads**: Saved to filesystem as `avatar-${timestamp}-${random}${ext}`. No userId in filename. Served statically at `/uploads/`. No DB record of the file. The returned URL is stored on the user/agent profile by the caller.
- **Runtime files (agent workspace)**: These are ephemeral in-memory StateBackend files (DeepAgent's virtual filesystem), scoped to the thread/language graph checkpoint. They survive only as long as the checkpoint exists. They are NOT persisted to disk or MongoDB as individual files.
- **Knowledge base files**: Processed and chunked into Qdrant + MongoDB chunks. Original files are not retained (text is extracted and then the buffer is discarded after chunking).
- **Memory files**: These are markdown virtual files stored in the `memoryfiles` collection, scoped by namespace. Not filesystem files.

---

## 9. DeepAgent / AgentFactory Identity Assumptions

### 9.1 AgentFactory Identity Flow

The `agentFactory.buildAgent(agentId, userId, checkpointer)` method makes several identity assumptions:

1. **userId is a Persona User ObjectId** — used in:
   - Cache key: `${cacheKey}:${userId}`
   - Memory namespaces: `userMemoryNamespace(userId)` and `agentMemoryNamespace(userId, agentIdStr)`
   - Provider lookup: `providerRepository.findByUser(userId)`
   - Tool resolution: `resolveAgentTools(agent, userId)` → `resolveMcpTools(agent, userId)` → `mcpTokenService.getUserAccessToken(mcp, userId)`
   - Builder tools: `getBuilderToolbox(userId)` — each tool closure captures userId

2. **agentId is a MongoDB ObjectId (or the Architect sentinel `'000000000000000000000000'`)** — used in:
   - Agent DB lookup
   - Skill namespace: `['agents', agentIdStr, 'enabled']`
   - Agent memory namespace suffix
   - Cache key

3. **The Agent Factory caches by `${agentId}:${userId}`** — This is the right shape for per-user isolation, but it compounds the multi-tenant problem because `userId` has no `projectId` prefix.

### 9.2 Per-User MCP Awareness

The factory is already aware that per-user MCP connectors require user-scoped caching:

```javascript
// agent.factory.js
usesPerUserMcp = (agent.mcps || []).some((mcp) => mcp.authMode === 'user');
// ... then cache key becomes ${cacheKey}:${userId}
const effectiveCacheKey = `${cacheKey}:${userId}`;
```

This is an existing pattern that could be extended.

---

## 10. Shared-Agent Multi-User Behavior

### 10.1 Current Scenario

When two users (Rahul and Aman) use the same public agent:

| Resource | Rahul | Aman | Shared? |
|---|---|---|---|
| Agent definition (system prompt, config) | Same agent lookup | Same agent lookup | ✅ Yes — correct |
| LangGraph thread ID | `agui-${agentId}-${rahulsUserId}` | `agui-${agentId}-${amansUserId}` | ❌ No — different, correct |
| Conversation threads DB | `{ userId: rahulsUserId }` | `{ userId: amansUserId }` | ❌ No — isolated by userId, correct |
| Checkpoints | Keyed by Rahul's threadId | Keyed by Aman's threadId | ❌ No — different thread IDs, correct |
| Memory (`/memories/user/`) | `['users', rahulsUserId]` | `['users', amansUserId]` | ❌ No — isolated by userId, correct |
| Memory (`/memories/agent/`) | `['users', rahulsUserId, 'agents', agentId]` | `['users', amansUserId, 'agents', agentId]` | ❌ No — isolated by userId, correct |
| MCP (owner mode) | Same shared token | Same shared token | ✅ Yes — correct for owner mode |
| MCP (user mode) | Rahul's OAuth token | Aman's OAuth token | ❌ No — isolated by (mcpId, userId), correct |
| Agent cache | `agentId:rahulsUserId` key | `agentId:amansUserId` key | ❌ No — separate cache entries, correct |

**Conclusion: Current shared-agent multi-user behavior is correctly isolated for Persona users.** Two Persona users sharing a public agent will never see each other's runtime state. The architecture already handles this case correctly.

### 10.2 The Multi-Project Gap

The isolation above works **only because Persona user IDs are unique** — `rahulsUserId` and `amansUserId` are different MongoDB ObjectIds. If we introduced Projects where:
- `(Beyond Campus, rahul) → someExternalUserId`
- `(Beyond Campus, aman) → anotherExternalUserId`
- `(Coursify, rahul) → sameExternalIdAsBeyondCampusRahul`

The current storage would NOT distinguish `(BC, rahul)` from `(Coursify, rahul)` because there's no `projectId` field anywhere.

---

## 11. Current Isolation Guarantees

### 11.1 What's Well-Isolated

| Resource | Isolation Mechanism | Strength |
|---|---|---|
| Conversation threads | `userId` field, ownership checks in controller + repository | ✅ Strong |
| Checkpoint access | Gated through thread ownership check | ✅ Strong (app layer) |
| Memory files | `['users', userId]` namespace prefix; unique compound index | ✅ Strong |
| MCP user connections | `(mcpId, userId)` compound unique index | ✅ Strong |
| Agent visibility | `canUserExecuteAgent` enforces ownership + visibility | ✅ Strong |
| Provider access | `providerRepository.findByUser(userId)` | ✅ Strong |
| Agent CRUD | Ownership check in controller + service | ✅ Strong |
| Skills | `ownerId` field on Skill model; user-scoped CRUD | ✅ Strong |

### 11.2 What's NOT Isolated (or Weakly Isolated)

| Resource | Issue | Risk |
|---|---|---|
| LangGraph thread ID | Deterministic: `agui-${agentId}-${userId}` — collision if userId is not unique | ❌ Weak — works only because Persona user IDs are unique |
| Checkpointer storage | No `userId` field on checkpoint documents; keyed only by `thread_id` | ⚠️ Weak — app-layer gating but no storage-layer isolation |
| Uploaded files | Flat `uploads/` directory, no user/tenant in filename | ⚠️ Weak — no isolation at filesystem level |
| Qdrant knowledge points | No `userId` or `ownerId` in point metadata | ⚠️ Weak — enforced only at service layer |
| Agent cache (LRU) | Keyed by `${agentId}:${userId}` — no project dimension | ⚠️ Weak — collision risk with external IDs |
| Concurrency rate limiting | Keyed by `concurrency:CHAT:${userId || req.ip}` — no project dimension | ⚠️ Weak |

---

## 12. Potential Cross-Project Risks

### 12.1 Direct Storage Collisions

If a future `projectId` field is added to schemas but existing records are not migrated:

| Scenario | Risk |
|---|---|
| Two Projects use the same LLM provider with same ID | Provider records would leak across Projects |
| Agent slug uniqueness is global | Two Projects cannot have agents with the same slug |
| Thread `_id` uniqueness is global | No collision (ObjectId is globally unique), but no project scoping for queries |
| Thread `threadId` (UUID) uniqueness is global | Same — globally unique but not project-scoped |

### 12.2 Key Collisions with External User IDs

If Projects map external user IDs (strings) to Persona storage:

```
// Hypothetical collision:
(Project: Beyond Campus, externalUserId: "rahul_123") 
(Project: Coursify, externalUserId: "rahul_123")

// Current storage would produce:
// Memory: ['users', "rahul_123"] ← COLLISION
// Thread: { userId: "rahul_123" } ← COLLISION
// MCP connection: { mcpId, userId: "rahul_123" } ← COLLISION
```

The **minimum safe key** for any future storage is `(projectId, externalUserId)`, and the current storage uses only `userId` (Persona ObjectId or hypothetical external ID).

### 12.3 The `(Project A, Rahul) ≠ (Project B, Rahul)` Invariant

**Analysis of current storage keys against this invariant:**

| Storage | Current Key | Would `(BC, rahul)` = `(Coursify, rahul)`? | Notes |
|---|---|---|---|
| Conversation (thread) | `{ userId, agentId, threadId }` | ✅ No — threadId (UUID) is unique | But querying by userId would mix Projects |
| Thread findByUser | `{ userId, isArchived: false }` | ❌ YES — would mix all threads for "rahul" from both Projects | Major query leak |
| Memory namespace | `['users', userId]` | ❌ YES — collides | Memory leak across Projects |
| Agent memory namespace | `['users', userId, 'agents', agentId]` | ❌ YES — collides | Memory leak across Projects |
| MCP user connection | `{ mcpId, userId }` | ❌ YES — if both Projects have MCP with same _id | Or just by userId alone |
| Provider ownership | `{ ownerId: userId }` | ❌ YES — providers leak across Projects | |
| Skill ownership | `{ ownerId: userId }` | ❌ YES — skills leak across Projects | |
| Agent ownership | `{ ownerId: userId }` | ❌ YES — agent definitions leak | |
| Agent visibility | `visibility: 'public'` | ❌ YES — public is global, not project-scoped | Marketplace agents visible to all |

**Bold (direct collision):** Memory namespaces, thread queries, MCP connections
**Medium (query-level leak):** Agent and provider ownership queries
**Low (already unique):** Thread UUIDs, ObjectIds

---

## 13. Potential Cross-User Risks

### 13.1 Within-Same-Project Risks

Even without multi-Project concerns, two users of the same agent could experience:

1. **MCP owner-mode token sharing** — By design. If the agent's MCP uses `authMode: 'owner'`, all users share the owner's authenticated token. This is a current product feature, not a bug, but it means all users execute MCP operations as the agent creator.

2. **Global memory stores** — The legacy `MongoDBStore` (`agent_memories` collection, reference `getGlobalStore()`) stores namespaced key-value pairs. Currently used as the DeepAgent's "store" parameter. Its namespace structure is the same (`['users', userId, ...]`), so it shares the same isolation guarantees as the file-based memory.

3. **Rate limiter concurrency** — Keyed by `userId || req.ip`. Under a future Developer Platform, rate limiting by Persona userId makes no sense for external Project users.

### 13.2 Within-Same-Agent Risks (LOW)

Already well-handled:

- Threads: Full isolation by `(userId, threadId)`
- Memory: Full isolation by `['users', userId, ..., agentId]`
- Checkpoints: Full isolation by deterministic thread ID including userId
- MCP user connections: Full isolation by `(mcpId, userId)` compound key

---

## 14. Reusable Runtime Primitives

### 14.1 What Could Stay Largely Unchanged

These pieces operate at the right level of abstraction and could likely remain **conceptually** unchanged, accepting a generalized execution identity:

| Component | Why Reusable | Potential Changes |
|---|---|---|
| `AgentFactory` | Already parametrizes identity via `buildAgent(agentId, userId)` | `userId` → `(projectId, externalUserId)`; namespace construction |
| `canUserExecuteAgent` | Visibility/ownership logic is generic | Add `projectId` to context; add project-scoped visibility |
| `agentSkillsStore` | Uses agent namespace `['agents', agentIdStr, 'enabled']` | No change if agentId remains unique; or add project prefix |
| `agentCache` LRU | Keyed by `agentId:userId` | `agentId:projectId:userId` |
| AG-UI event translator | Purely functional, no identity | No change needed |
| `RunScopeTracker` | Purely run-tracking, no identity | No change needed |
| `subagentTrace.js` | Purely event folding, no identity | No change needed |
| MCP tool resolution | Already distinguishes owner vs user auth | No change to auth model; identity propagation at call site |
| Knowledge tool resolution | Already parametrizes `userId` | No change to query logic; identity at construction |

### 14.2 What's Deeply Coupled to Persona User IDs

| Component | Coupling | Why Deep |
|---|---|---|
| `memory-files-store.js` / `MemoryFilesStore` | `['users', userId]` namespace hardcoded | Namespace prefix `'users'` is Persona-specific |
| `agent.factory.js` backend routes | `userMemoryNamespace(userId)`, `agentMemoryNamespace(userId, agentIdStr)` | Direct construction of namespace arrays with Persona userId |
| `userMemoryNamespace()` / `agentMemoryNamespace()` | Utility functions that return `['users', userId, ...]` | The `'users'` literal and single-userID pattern |
| `MongoDBStore` (legacy global store) | Namespace pattern assumption | Same as above — namespace prefixed with `'users'` |
| `auth.middleware.js` / `auth.service.js` | Clerk-specific auth flow | Entire auth pipeline assumes Persona Clerk users |
| `authService.syncUser()` | Creates Persona User documents | Auto-creates Persona users from Clerk |
| `userRepository.findByClerkId()` | Clerk-specific lookup | Entire user model is Persona-specific |
| `upload.routes.js` | Flat filesystem with no identity | No scoping at all — just a flat dir |
| `rateLimiter` concurrency key | `concurrency:CHAT:${userId}` | Persona userId in key |
| Thread `findByUser` query | `{ userId, isArchived: false }` | Queries by Persona userId |
| Agent repository `findByOwner` | `{ ownerId: userId }` | Queries by Persona userId |
| MCP repository `findByOwner` | `{ ownerId: userId }` | Queries by Persona userId |

---

## 15. Architecture Questions Raised

### 15.1 Critical Questions for Developer Platform Design

1. **Where does `projectId` enter the system?** Every component that currently receives `userId` will need to receive `(projectId, externalUserId)` or a composite identity object. The routing middleware (`agui.routes.js`) is the primary injection point — how does it authenticate the Project?

2. **Should the existing Persona product be modeled as a special Project?** If yes, existing Persona user IDs become `(projectId: "persona", externalUserId: personaUserId)`. This avoids branching code paths but requires migrating all existing data.

3. **Should existing storage gain `projectId` fields, or should Project resources use separate collections?** Separate collections give stronger physical isolation but more code overhead. Adding `projectId` fields means migrating existing records.

4. **How does the deterministic LangGraph thread ID change?** Currently `agui-${agentId}-${userId}`. Must become something like `agui-${projectId}-${agentId}-${externalUserId}`.

5. **How does memory namespace structure change?** Currently `['users', userId]`. Must become `['projects', projectId, 'users', externalUserId]` or similar.

6. **Does `canUserExecuteAgent` need a `projectId` parameter?** Agent visibility (PUBLIC/UNLISTED/PRIVATE) becomes project-scoped. A "public" agent in Project A should not be visible in Project B. The check needs to scope visibility to the requesting Project.

7. **How are checkpoint documents scoped?** They currently have no `userId` field at all. For a Developer Platform, they would need `projectId` and/or `externalUserId`.

8. **Does the rate limiter need project-scoped concurrency keys?** Yes — `concurrency:CHAT:${projectId}:${externalUserId}`.

### 15.2 Questions That Are [OPEN] (from Requirements)

These align with the existing [OPEN] questions in the requirements document:

9. **How does a Project backend authenticate with Persona?** API keys? JWT? Client certificates? This determines how `projectId` is established on each request.

10. **How does a Project backend assert external user identity?** The requirements explicitly warn against accepting an arbitrary `userId` header. The mechanism (signed tokens, server-to-server auth, etc.) is [OPEN].

11. **How do existing Persona users interact with Project agents (if at all)?** Can a Persona marketplace user chat with a Beyond Campus agent? The requirements say no, but the architecture must enforce this boundary.

12. **Is the existing Persona user model (`User` collection, Clerk auth) reused for Project external users?** The requirements say no (external users should not need Persona accounts), but this means an alternative identity model must be designed.

---

## 16. Detailed Flow Diagram

```
CLIENT                                                    PERSONA BACKEND
======                                                    ==============

┌─────────────────────────────────────────────────────────────────────────────────┐
│ AG-UI EXECUTION FLOW (POST /api/v1/agui)                                        │
│                                                                                  │
│ CLIENT                              agui.routes           agui.controller        │
│   │                                    │                       │                 │
│   │  POST /api/v1/agui                 │                       │                 │
│   │  Headers:                          │                       │                 │
│   │    Authorization: Bearer <JWT>     │                       │                 │
│   │    x-agent-id: <agentId>           │                       │                 │
│   │    x-thread-id: <threadId>         │                       │                 │
│   │  Body: { messages: [...],          │                       │                 │
│   │         resume: {...} }            │                       │                 │
│   │──────────────────────────────────► │                       │                 │
│   │                                    │                       │                 │
│   │                         authMiddleware (Clerk)            │                 │
│   │                         │  getAuth(req) → clerkId         │                 │
│   │                         │  syncUser(clerkId) → User doc   │                 │
│   │                         │  req.user = { _id, clerkId, ...}│                 │
│   │                         │◄────────────────────           │                 │
│   │                                    │                       │                 │
│   │                         Resolve thread:                    │                 │
│   │                         │  Read x-agent-id → agentId      │                 │
│   │                         │  Read x-thread-id → threadDbId  │                 │
│   │                         │  If threadDbId:                 │                 │
│   │                         │    findById(threadDbId)         │                 │
│   │                         │    if thread.userId === userId:  │                 │
│   │                         │      langGraphThreadId = thread.threadId          │
│   │                         │  Else:                           │                 │
│   │                         │    langGraphThreadId =           │                 │
│   │                         │      `agui-${agentId}-${userId}` │                 │
│   │                         │                                    │               │
│   │                         req.aguiContext =                    │               │
│   │                           { userId, agentId,                  │               │
│   │                             langGraphThreadId, threadDbId }   │               │
│   │                         │                       │           │               │
│   │                         │                       │           │               │
│   │                         │    POST / →           │           │               │
│   │                         │─────────────────────────────────► │               │
│   │                         │                       │           │               │
│   │                         │                       │ runAgent()│               │
│   │                         │                       │           │               │
│   │                         │                       │ Check concurrency:         │
│   │                         │                       │   concurrency:CHAT:${userId}│
│   │                         │                       │                            │
│   │                         │                       │ Find agent & authorize:   │
│   │                         │                       │   agentRepo.findById()     │
│   │                         │                       │   canUserExecuteAgent()    │
│   │                         │                       │   → throw 404 if denied   │
│   │                         │                       │                            │
│   │                         │                       │ Set SSE headers            │
│   │                         │                       │                            │
│   │                         │                       │ runAgentAsAguiEvents()     │
│   │                         │                       │──────────────────────┐     │
│   │                         │                       │                      │     │
│   │                         │                       ▼                      ▼     │
│   │                         │               agui.service.js         agent.factory │
│   │                         │               │                           │        │
│   │                         │               │ buildAgent(agentId,       │        │
│   │                         │               │   userId, checkpointer)   │        │
│   │                         │               │─────────────────────────► │        │
│   │                         │               │                           │        │
│   │                         │               │                Fetch agent + populate│
│   │                         │               │                Fetch provider         │
│   │                         │               │                Decrypt API key        │
│   │                         │               │                Build LLM              │
│   │                         │               │                Resolve tools:         │
│   │                         │               │                  resolveAgentTools   │
│   │                         │               │                  (agent, userId)     │
│   │                         │               │                  ├─ search_web        │
│   │                         │               │                  ├─ present_file      │
│   │                         │               │                  ├─ MCP tools         │
│   │                         │               │                  │  └─ per-user       │
│   │                         │               │                  │     MCP tokens     │
│   │                         │               │                  │     (userId!)      │
│   │                         │               │                  └─ knowledge tools   │
│   │                         │               │                                        │
│   │                         │               │                Build backend routes:  │
│   │                         │               │                  /skills/ →           │
│   │                         │               │                    ['agents',agentId] │
│   │                         │               │                  /memories/user/ →    │
│   │                         │               │                    ['users', userId]  │
│   │                         │               │                  /memories/agent/ →   │
│   │                         │               │                    ['users', userId,  │
│   │                         │               │                     'agents',agentId] │
│   │                         │               │                                        │
│   │                         │               │                createDeepAgent({...}) │
│   │                         │               │                Cache by                │
│   │                         │               │                  ${agentId}:${userId} │
│   │                         │               │◄────────────────────────────────     │
│   │                         │               │                                        │
│   │                         │               │ Check pending interrupts               │
│   │                         │               │   getState({thread_id:                 │
│   │                         │               │     langGraphThreadId})                │
│   │                         │               │                                        │
│   │                         │               │ streamEvents(input, {                  │
│   │                         │               │   configurable: {                      │
│   │                         │               │     thread_id: langGraphThreadId        │
│   │                         │               │   }                                    │
│   │                         │               │ })                                     │
│   │                         │               │   → LangGraph stream                   │
│   │                         │               │                                        │
│   │                         │               │ translateLangGraphStream(stream, ...)  │
│   │                         │               │   → AG-UI events                      │
│   │                         │               │     (TEXT_MESSAGE_CHUNK,                │
│   │                         │               │      TOOL_CALL_CHUNK,                   │
│   │                         │               │      TOOL_CALL_RESULT,                  │
│   │                         │               │      REASONING_MESSAGE_START,           │
│   │                         │               │      STATE_SNAPSHOT,                    │
│   │                         │               │      CUSTOM / subagent_activity,        │
│   │                         │               │      CUSTOM / hitl_request,             │
│   │                         │               │      CUSTOM / clarification_request)    │
│   │                         │               │                                        │
│   │  ◄── SSE events ────────┴───────────────┴──────────────────────────────────     │
│   │                                                                                  │
│   │  Auto-titling (if new thread):                                                   │
│   │    checkpointService._autoTitleThread(thread, content, llm)                      │
│   │                                                                                  │
│   │  After stream ends:                                                              │
│   │    Persist subagentTraces on thread document                                      │
│   │                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Files Inspected / Evidence

### Primary Source Files

| File | Evidence |
|---|---|
| `agent-backend/src/modules/agui/agui.routes.js` | AG-UI route setup, thread resolution, auth middleware integration, `langGraphThreadId` construction |
| `agent-backend/src/modules/agui/agui.controller.js` | Agent authorization (`canUserExecuteAgent`), concurrency key, SSE setup, thread resume |
| `agent-backend/src/modules/agui/agui.service.js` | Agent build, thread state check, stream execution, auto-titling |
| `agent-backend/src/modules/agui/aguiTranslator.js` | LangGraph → AG-UI event translation (no identity) |
| `agent-backend/src/modules/agents/agent.factory.js` | Agent compilation, cache key construction, identity namespace setup, backend route construction |
| `agent-backend/src/modules/agents/agent.service.js` | `canUserExecuteAgent`, `getAgentById`, `_formatSafe` (owner check) |
| `agent-backend/src/modules/agents/agent.model.js` | Agent schema (ownerId, visibility, isActive, deletedAt, etc.) |
| `agent-backend/src/modules/agents/agent.repository.js` | Agent DB queries, soft-delete |
| `agent-backend/src/modules/threads/thread.model.js` | Conversation schema (userId, agentId, threadId) |
| `agent-backend/src/modules/threads/thread.repository.js` | Thread queries by userId, ownership checks |
| `agent-backend/src/modules/threads/thread.controller.js` | Thread ownership enforcement in all CRUD operations |
| `agent-backend/src/modules/threads/checkpoint.service.js` | Checkpointer setup, `getMessages` with ownership check |
| `agent-backend/src/modules/memory/memory.service.js` | Memory CRUD with `['users', userId]` namespace |
| `agent-backend/src/modules/memory/memory-file.model.js` | MemoryFile schema (namespace, key, content, unique index) |
| `agent-backend/src/modules/memory/memory-files-store.js` | `userMemoryNamespace`, `agentMemoryNamespace`, `MemoryFilesStore` |
| `agent-backend/src/modules/memory/memory.controller.js` | Memory REST API (user-scoped) |
| `agent-backend/src/modules/auth/auth.middleware.js` | Clerk authentication → `syncUser` → `req.user` |
| `agent-backend/src/modules/auth/auth.service.js` | `syncUser` — Clerk ID → User document resolution |
| `agent-backend/src/modules/auth/optional-auth.middleware.js` | Optional Clerk auth for public routes |
| `agent-backend/src/modules/mcp/mcp.model.js` | MCP schema (authMode, authType, ownerToken) |
| `agent-backend/src/modules/mcp/mcp-user-connection.model.js` | User-MCP connection (mcpId, userId), compound unique index |
| `agent-backend/src/modules/mcp/mcp.tools.js` | MCP tool resolution, user vs owner token selection |
| `agent-backend/src/modules/mcp/mcp-token.service.js` | Token resolution for owner and user auth modes |
| `agent-backend/src/modules/mcp/mcp-user-connection.repository.js` | `findByMcpAndUser(mcpId, userId)` |
| `agent-backend/src/modules/tools/index.js` | `resolveAgentTools(agent, userId)` |
| `agent-backend/src/modules/tools/builder.tools.js` | Architect tools — each captures `userId` in closure |
| `agent-backend/src/modules/tools/search.tool.js` | Web search tool |
| `agent-backend/src/modules/knowledge/knowledge.tools.js` | Knowledge tools — pass `userId` for ownership filtering |
| `agent-backend/src/modules/knowledge/knowledge.service.js` | KB operations with ownership checks (`ownerId.toString() !== userId.toString()`) |
| `agent-backend/src/modules/upload/upload.routes.js` | File upload — flat directory, no user/thread scoping |
| `agent-backend/src/modules/users/user.model.js` | User schema (clerkId, email, name, role) |
| `agent-backend/src/modules/users/user.repository.js` | User DB operations |
| `agent-backend/src/index.js` | Route mounting order, AG-UI before express.json(), raw body handling |
| `agent-backend/src/utils/mongoStore.js` | Legacy global store — `agent_memories` collection, namespace-based |
| `agent-backend/src/utils/versionedStateBackend.js` | Ephemeral thread-scoped StateBackend (DeepAgent filesystem) |

### Key Lines of Evidence

```
// agent.factory.js — cache key: agentId:userId (line ~68)
const effectiveCacheKey = `${cacheKey}:${userId}`;

// agent.factory.js — memory namespaces (lines ~170-185)
'/memories/user/': StoreBackend({ ..., namespace: userMemoryNamespace(userId) })
'/memories/agent/': StoreBackend({ ..., namespace: agentMemoryNamespace(userId, agentIdStr) })

// agent.factory.js — skill namespace
namespace: ['agents', agentIdStr, 'enabled']

// memory-files-store.js — namespace helpers
['users', String(userId)]
['users', String(userId), 'agents', String(agentId)]

// agui.routes.js — deterministic thread ID (line ~28)
langGraphThreadId = agentId ? `agui-${agentId}-${userId}` : null;

// agui.routes.js — thread ownership check (line ~32)
if (thread && thread.userId.toString() === userId.toString())

// agent.service.js — execution authorization (line ~80)
canUserExecuteAgent(agent, userId)

// thread.model.js — thread schema
userId: { type: ObjectId, ref: 'User', required: true, index: true }

// auth.middleware.js — identity source
const authState = getAuth(req); // Clerk → clerkId → syncUser → req.user
```

---

## 18. Answers to Specific Questions

### Q1: What currently scopes a thread to a user?

The `userId` field on the Conversation (thread) document. All thread operations (findByUser, findById + ownership check, update, delete) enforce that the requesting user's ID matches the thread's `userId` field.

### Q2: Can a user supply another user's thread ID? What prevents access?

Yes, they can supply it. Access is prevented by:
1. **AG-UI route:** The middleware looks up the thread by ID and checks `thread.userId.toString() === userId.toString()`. If it fails, it falls back to the deterministic `agui-${agentId}-${userId}` — creating a new effective session.
2. **Thread CRUD:** Every controller method checks ownership and returns 404 if mismatched.
3. **Checkpoint messages:** The `getMessages` method in checkpointService checks `thread.userId === userId`.

### Q3–4: What scopes memory? Is memory user-level, agent-level, thread-level, or combination?

Memory is **user-level** (shared across all agents) and **per user+agent** (private to one user-agent pair). It is NOT thread-level. Namespaces:
- `['users', userId]` — user-global, shared across all agents for that user
- `['users', userId, 'agents', agentId]` — per user+agent, private to that pair

### Q5: How does DeepAgent receive memory/user identity?

DeepAgent does NOT receive userId or agentId as explicit parameters. Instead, the agent factory pre-configures StoreBackend instances with hardcoded namespaces at construction time. The agent reads/writes files through virtual paths like `/memories/user/preferences.md`, which resolve through the CompositeBackend → StoreBackend → MongoDB `memoryfiles` collection via the pre-configured namespace.

### Q6: How are checkpoints keyed?

By `thread_id` only (stored in `checkpoints` and `checkpoint_writes` MongoDB collections via `MongoDBSaver`). No userId or agentId is stored on checkpoint documents — enforcement is entirely at the application layer through thread ownership checks.

### Q7: Could two users using the same public agent ever collide in state?

**Currently: No.** Two Persona users using the same public agent are fully isolated because:
- Different `userId` → different deterministic `langGraphThreadId` → different checkpoint keys
- Different `userId` → different memory namespaces
- Different `userId` → different thread ownership

**But if userId is not unique (e.g., external IDs without Project scoping): Yes, collision would occur.**

### Q8: How are uploaded/runtime files associated with users/threads/agents?

- **Avatar uploads**: Not associated with any user/thread/agent in storage. Saved with random filename, URL returned to caller.
- **Runtime workspace files**: Ephemeral, in DeepAgent's thread-scoped StateBackend, checkpointed with the thread.
- **Memory files**: Associated by namespace `['users', userId, ...]`.
- **Knowledge documents**: Associated by `kbId` (owner enforced at service layer).

### Q9: Does any runtime path trust client-provided user identity?

**No.** User identity is obtained from Clerk (via `@clerk/express`'s `getAuth()`), which verifies the JWT in the `Authorization` header. The `userId` is always resolved from the authenticated session. The `x-agent-id` and `x-thread-id` headers are client-provided but are validated:
- `x-agent-id` → agent lookup → `canUserExecuteAgent` check
- `x-thread-id` → thread lookup → ownership check

### Q10: Where is authenticated identity obtained?

```javascript
// auth.middleware.js
const authState = getAuth(req);       // Clerk JWT verification
const clerkId = authState?.userId;     // Clerk user ID
const user = await authService.syncUser(clerkId);  // → Persona User document
req.user = user;                       // Available everywhere
```

### Q11: Does AG-UI currently assume: authenticated Persona user == runtime user?

**Yes, completely.** The `userId` from `req.user._id` (Persona MongoDB ObjectId) is the sole identity used for all runtime state: thread ownership, memory namespaces, MCP connections, tool resolution, concurrency keys, agent cache keys.

### Q12: Does AgentFactory make authorization/ownership assumptions?

**Yes.** In `buildAgent`:
- It calls `canUserExecuteAgent(agent, userId)` as a second authorization gate
- It uses `userId` for memory namespaces, cache keys, and tool resolution
- It uses `agentId` for skill namespaces and agent lookup
- It assumes `agent.ownerId` refers to a Persona User

### Q13: Where does the `canUserExecuteAgent` security policy run?

1. **`agui.controller.js`** — before SSE stream (primary gate)
2. **`agent.factory.js`** — during `buildAgent` for non-Architect agents (secondary gate)
3. **`agent.service.js`** — `getAgentById`, `getAgentBySlug` (REST API gates)

### Q14: Is authorization checked before SSE begins?

**Yes.** In `agui.controller.js` `runAgent()`:
```javascript
agent = await agentRepository.findById(context.agentId);
if (!agent || !agentService.canUserExecuteAgent(agent, context.userId)) {
  throw new NotFoundError('Agent not found');
}
// THEN: set SSE headers and start streaming
```

### Q15: Can an existing thread bypass current agent authorization?

**Partially.** When resuming a thread with `x-thread-id`, the agent is re-checked via `canUserExecuteAgent` against the provided `x-agent-id`. However:
- The thread's original `agentId` (from the Conversation document) is NOT compared against the requested `x-agent-id`.
- A user could theoretically resume a thread with a different `x-agent-id` than the original agent. The thread data would still be correct (checkpointer uses the thread's `threadId`), but the new agent's configuration would be used for subsequent messages.

**This is a minor gap** — the thread ownership is still enforced (same user), so no cross-user data leaks.

### Q16: Which runtime pieces could likely remain unchanged if an abstract execution identity existed later?

- AG-UI event translator and event types
- RunScopeTracker (run ancestry tracking)
- Subagent trace folding
- LangGraph ↔ AG-UI event translation
- Knowledge search functionality (just the query logic)
- Tool execution (the actual tool function calls)
- MCP auth modes (owner vs user distinction)
- DeepAgent/StateBackend abstraction
- Checkpointer mechanism (just the keying needs change)

### Q17: Which runtime pieces are deeply coupled to Persona user IDs?

- Auth middleware and auth service (Clerk-specific)
- User repository and model
- Memory namespace construction (`userMemoryNamespace`, `agentMemoryNamespace`)
- Agent cache key construction
- Thread ownership queries
- MCP user connection storage
- Provider ownership queries
- Agent ownership queries
- Skill repository queries
- Rate limiter concurrency keys
- Upload path (no identity at all)
- Deterministic LangGraph thread ID (`agui-${agentId}-${userId}`)

---

## 19. Key Findings

### Current Isolation Strengths

1. **Strong per-user runtime isolation** within the Persona product. Two users sharing a public agent get fully separated threads, checkpoints, memory, and MCP connections.

2. **Authorization is checked before SSE streaming begins**, preventing enumeration or unauthorized execution.

3. **Thread ownership is enforced at the application layer** on every access path (AG-UI and REST).

4. **The Agent Factory already uses user-scoped caching** (`agentId:userId`), providing a namespace-ready pattern.

5. **The MCP system already distinguishes owner vs user auth**, providing a reusable pattern for resource sharing.

6. **Memory uses compound unique indexes** on `(namespace, key)`, providing storage-level isolation for well-defined namespaces.

### Dangerous Assumptions

1. **`userId` is a globally unique Persona identifier** — there is no `projectId` dimension anywhere. Every storage key, query, and namespace embeds only a Persona user ID.

2. **Deterministic thread ID `agui-${agentId}-${userId}`** — works perfectly within Persona, but would cause collisions if user IDs are not globally unique.

3. **Memory namespace `['users', userId]`** — the literal `'users'` prefix is Persona-specific. There's no path to extend this to multi-tenant without changing the namespace structure.

4. **Flat upload directory** — no identity scoping at all. Two users in different Projects could overwrite each other's avatars if they happened to get the same random filename (extremely unlikely but architecturally unsafe).

5. **Checkpoint storage has no user/tenant field** — enforcement is entirely application-layer via thread ownership checks. A direct DB access or a future API that proxies checkpointer calls could bypass this.

6. **`canUserExecuteAgent` judges "public" globally** — there's no project-scoped visibility. A public agent is public to all Persona users; there's no mechanism to limit visibility to a specific Project.

7. **Existing Agent slug uniqueness is global** — two Projects cannot have agents with the same slug.

### Unknowns

1. **What does a future Project credential look like?** The authentication mechanism determines how `projectId` enters the request pipeline.

2. **How are external user identities asserted?** The requirements explicitly rule out trusting a bare `userId` header. The assertion mechanism (signed tokens, etc.) is [OPEN].

3. **Should existing Persona data be migrated or side-by-side?** The existing Persona product must keep working. Does it become Project "persona" or remain on separate storage?

4. **How does the checkpointer get scoped?** MongoDBSaver is configured once at startup with a MongoDB client. If checkpoints need `projectId` scoping, either the checkpointer must be replaced/reconfigured per request, or checkpoint keys must encode `projectId`.

### Files That Would Need Changes (Conceptually)

| File | Nature of Change |
|---|---|
| `auth.middleware.js` | Accept Project authentication; extract `(projectId, externalUserId)` |
| `auth.service.js` | Skip Clerk sync for Project requests; resolve external identity |
| `agui.routes.js` | Propagate `(projectId, externalUserId)` in aguiContext; change thread ID construction |
| `agui.controller.js` | Use project-scoped concurrency key |
| `agui.service.js` | Pass composite identity to agent factory |
| `agent.factory.js` | Change memory namespace construction; change cache key; change skill namespace |
| `memory-files-store.js` | Add `projectId` dimension to namespace helpers |
| `memory-file.model.js` | Possibly add `projectId` field or rely on namespace |
| `thread.model.js` | Add `projectId` field |
| `thread.repository.js` | Add project-scoped queries |
| `checkpoint.service.js` | Scoped checkpointer key construction |
| `mcp-user-connection.model.js` | Add `projectId` field or rely on (userId + project) |
| `upload.routes.js` | Add user/Project-scoped storage paths |
| `rateLimiter/` | Add Project dimension to concurrency keys |
| `agent.service.js` | `canUserExecuteAgent` — add project-scoped visibility |
| `agent.model.js` | Possibly add `projectId` for ownership/visibility |
| `user.model.js` | Possibly restructure or leave for Persona-only |

---

*This document is the codebase research deliverable for the Developer Platform initiative. It identifies facts and risks only — no architecture decisions, schema proposals, or implementation plans. See the requirements document (`01-developer-platform-requirements.md`) for the official requirements and `§33` of that document for the required next steps before implementation.*
