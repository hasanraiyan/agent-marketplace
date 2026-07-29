# Current Data & Ownership Audit

> **Status:** Research-only. Do NOT implement based on this document.
> **Purpose:** Understand current ownership, identity, visibility, and authorization patterns before designing Project scoping.
> **Date:** 2026-07-29
> **Scope:** Single backend (`agent-backend/src/modules/`), all 17 domain modules.

---

## 1. Executive Summary

Persona today is a **single-tenant** system built around **Persona/Clerk user identity**. Every resource is owned by a Persona user. Every authorization check compares the authenticated user's MongoDB ObjectId (`req.user._id` or `req.user.id`) against an `ownerId` or `userId` field on the resource. There is no concept of "Project," "tenant," "external user," or "scoped identity."

The system is **cleanly layered** with consistent ownership naming (`ownerId`/`userId` across all models), which makes it auditable. However, this same consistency means the coupling to Persona user identity is **deep and pervasive** — not a single module is free of it.

**Key finding:** The transition to a multi-tenant/Project-scoped model is feasible but will touch **every collection, every repository, every service authorization check**, and the entire auth middleware chain. The existing `ownerId` pattern is reusable, but the *type* of the owner field (Mongoose ObjectId → User) must be generalized.

---

## 2. Current Identity Model

### 2.1 Clerk Authentication Flow

```
Client request with Clerk JWT
  → Clerk middleware (clerkMiddleware) extracts { userId: clerkUser_xxx }
  → auth.middleware.js calls authService.syncUser(clerkId)
      → userRepository.findByClerkId(clerkId)
        → if found: return User document
        → if not found: auto-sync from Clerk API → create local User
  → req.user = { _id, clerkId, email, name, role, ... }
  → downstream code uses req.user.id (or req.user._id) as ownerId
```

**Evidence:**
- `agent-backend/src/modules/auth/auth.middleware.js` (lines 15-19): `getAuth(req)` → `clerkId` → `authService.syncUser(clerkId)` → `req.user = user`
- `agent-backend/src/modules/auth/auth.service.js` (lines 27-90): sync/find-or-create logic

### 2.2 Current User Model

The `User` model has:
- `clerkId` (String, required, unique) — **the platform identity**
- `email` (String, required, unique)
- `username` (String, unique, sparse)
- `role` (enum: 'normal' | 'admin')
- `name` (String, required)

**Evidence:** `agent-backend/src/modules/users/user.model.js`

**Key observations:**
- `clerkId` is the single source of truth for identity — there is no other identity provider.
- The User model has **no projectId, no externalUserId, no tenant field**.
- Roles are flat 'normal'/'admin' — no Project-level admin vs. platform admin distinction.

### 2.3 Optional Auth

Some agent routes use `optionalAuthMiddleware` for public discovery (unauthenticated users can search public agents). This middleware does not fail on missing auth, but `req.user` will be undefined for unauthenticated requests.

**Evidence:** `agent-backend/src/modules/auth/optional-auth.middleware.js`

---

## 3. Current Agent Ownership Model

### 3.1 Agent Schema Ownership Fields

```javascript
ownerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true,
  index: true,
}
```

**Evidence:** `agent-backend/src/modules/agents/agent.model.js` (lines 6-10)

### 3.2 Ownership Enforcement

**Create:** `agentService.createAgent(userId, data)` → `ownerId: userId` set in controller (line 83)
**Evidence:** `agent-backend/src/modules/agents/agent.service.js` (line 78)

**Update:** `existing.ownerId.toString() !== userId.toString()` → rejection
**Evidence:** `agent-backend/src/modules/agents/agent.service.js` (line 96)

**Delete:** Same pattern — `existing.ownerId.toString() !== userId.toString()`
**Evidence:** `agent-backend/src/modules/agents/agent.service.js` (line 103)

**Search (owner filter):** `_buildSearchFilter` scopes by `ownerId` if specified
**Evidence:** `agent-backend/src/modules/agents/agent.service.js` (lines 47-73)

### 3.3 Agent Visibility Model

```javascript
visibility: {
  type: String,
  enum: ['private', 'unlisted', 'public'],
  default: 'private',
  index: true,
}
```

**Deletion state:**
```javascript
isActive: { type: Boolean, default: true }
deletedAt: { type: Date, default: null }
```

**Evidence:** `agent-backend/src/modules/agents/agent.model.js` (lines 78-90)

**Execution authorization** (`canUserExecuteAgent`):
- Virtual agents (Architect): always executable
- `deletedAt` set: never executable
- `isActive === false` and not owner: not executable
- `visibility === 'private'` and not owner: not executable
- Public/unlisted active agents: executable by anyone

**Evidence:** `agent-backend/src/modules/agents/agent.service.js` (lines 90-116)

---

## 4. Current Resource Ownership Model

### 4.1 Ownership Field Consistency

Every resource model uses the **same pattern**:

| Module | Collection | Field | Type | Ref | Required |
|--------|-----------|-------|------|-----|----------|
| Agents | `agents` | `ownerId` | ObjectId | User | Yes |
| Skills | `skills` | `ownerId` | ObjectId | User | Yes |
| Knowledge | `knowledgebases` | `ownerId` | ObjectId | User | Yes |
| MCP | `mcps` | `ownerId` | ObjectId | User | Yes |
| Providers | `providers` | `ownerId` | ObjectId | User | Yes |
| Threads | `conversations` | `userId` | ObjectId | User | Yes |
| MCP User Conn | `mcpuserconnections` | `userId` | ObjectId | User | Yes |
| Memory | `memoryfiles` | `namespace[1]` | String | — | N/A (namespace-based) |
| Knowledge Chunks | `knowledgechunks` | `kbId` (indirect) | ObjectId | KnowledgeBase | Yes |
| Users | `users` | `clerkId` | String | — | Yes |

**Summary:** All 6 main resource types + 2 user-association types contain a direct `ownerId` or `userId` reference to the User collection. This is **exceptionally consistent** — a single naming convention across all modules.

### 4.2 Authorization Enforcement Consistency

The authorization check is **nearly identical** across every service:

```javascript
// Agent service (~line 96):
if (existing.ownerId.toString() !== userId.toString()) {
  throw new Error('Unauthorized to update this agent');
}

// Skill service (~line 54):
if (skill.ownerId.toString() !== userId.toString()) {
  throw new Error('Unauthorized to delete this skill');
}

// Knowledge service (~line 189):
if (kb.ownerId.toString() !== userId.toString()) {
  throw new Error('Not authorized to update this knowledge base');
}

// MCP service (~line 80):
if (mcp.ownerId.toString() !== userId.toString()) {
  throw new NotFoundError('MCP server not found');
}

// Provider service (~line 80):
if (provider.ownerId.toString() !== userId.toString()) {
  throw new Error('Unauthorized to update this provider');
}

// Thread controller (~line 37):
if (thread.userId.toString() !== req.user.id) {
  return res.status(404).json({ success: false, message: 'Thread not found' });
}
```

**This is the single most important finding.** Every single ownership check compares `resource.ownerId` (or `resource.userId`) against `req.user.id` (or `userId` parameter). These comparisons all assume:
1. Both sides are MongoDB ObjectIds
2. The right side is a Persona User ID
3. There is no intermediate scoping (no project boundary, no tenant)

### 4.3 Resources Without Explicit Owner

- **KnowledgeChunk**: Owned indirectly through `kbId` → `KnowledgeBase.ownerId`. No direct owner field.
- **MemoryFile**: Uses namespace-based scoping `['users', <userId>, ...]`. The owner is the `<userId>` element.
- **Checkpoint data** (LangGraph `checkpoints`/`checkpoint_writes` collections): Scoped by `thread_id` (a UUID string). Thread ownership is via the `Conversation` collection's `userId` field.

No resource is truly "ownerless."

---

## 5. Agent Visibility Model

### 5.1 Visibility Field Per Module

| Module | Visibility Model | Values | Default | Public Query Pattern |
|--------|-----------------|--------|---------|---------------------|
| Agent | `visibility` enum | private, unlisted, public | private | `{ visibility: 'public' }` |
| Skill | `isPublic` boolean | true/false | false | `{ isPublic: true }` |
| KnowledgeBase | `isPublic` boolean | true/false | false | `{ isPublic: true }` (code-level, not enforced in query directly) |
| MCP | None | — | — | Not discoverable |
| Provider | None | — | — | Not discoverable |
| Threads | `isArchived` boolean | true/false | false | Not publicly discoverable |

### 5.2 "Public" Means Persona-Global

The discovery queries have **no scope boundary**:

```javascript
// Agent search (agent.service.js, line 69):
match.visibility = 'public';  // Global scope — no project filter

// Skill public query (skill.repository.js, line 34):
const filter = { ...query, isPublic: true };  // Global scope

// KnowledgeBase visibility (knowledge.service.js, line 184):
if (kb.ownerId.toString() !== userId.toString() && !kb.isPublic) {
  throw new Error('Not authorized');
}
```

**Critical finding:** `visibility = 'public'` today implicitly means "Persona-global." There is no `projectId` or `scope` field to bound visibility. Adding Project scoping would require every public discovery query to gain a `projectId` filter (or similar).

---

## 6. Module-by-Module Ownership Table

| # | Module | Collection | Owner Field | Owner Type | Public Field | Unique Indexes | Auth Requirement |
|---|--------|-----------|-------------|------------|-------------|----------------|-----------------|
| 1 | Agents | `agents` | `ownerId` | ObjectId → User | `visibility: 'public'` | `slug` (global), `ownerId+isMainAgent+isActive` (partial) | Optional (read), Required (mutate) |
| 2 | Skills | `skills` | `ownerId` | ObjectId → User | `isPublic` | `ownerId+name` (per user) | Required |
| 3 | Knowledge | `knowledgebases` | `ownerId` | ObjectId → User | `isPublic` | `qdrantCollectionName` (global) | Required |
| 4 | MCP | `mcps` | `ownerId` | ObjectId → User | None | `ownerId+name` (per user) | Required |
| 5 | MCP User Conn | `mcpuserconnections` | `userId` | ObjectId → User | None | `mcpId+userId` (per user per MCP) | Required |
| 6 | Providers | `providers` | `ownerId` | ObjectId → User | None | None | Required |
| 7 | Threads | `conversations` | `userId` | ObjectId → User | None (private) | `threadId` (global) | Required |
| 8 | Memory | `memoryfiles` | Namespace[1] | String (userId) | None | `namespace+key` (global) | Required |
| 9 | Knowledge Chunks | `knowledgechunks` | Indirect via `kbId` | ObjectId → KB | None | `kbId+sourceName` | Required |
| 10 | Users | `users` | N/A (self) | N/A | N/A | `clerkId` (global), `email` (global), `username` (sparse global) | Required |

---

## 7. Representative Flow Traces

### Flow A: Persona User Creates Agent

```
POST /api/v1/agents
  → auth.middleware (JWT → clerkId → User lookup → req.user)
  → agentController.create (agent.routes.js:98)
    → agentService.createAgent(req.user.id, req.body) (agent.service.js:76)
      → user validation check
      → Main Agent assignment logic (per-user unique constraint)
      → agentRepository.create({ ...data, ownerId: userId })
        → Agent model: ownerId is required ObjectId ref to User
```

**Ownership set in:** controller → service `ownerId: userId`
**Persona coupling:** `req.user.id` = Persona User ObjectId

### Flow B: Persona User Edits Agent

```
PATCH /api/v1/agents/:id
  → auth.middleware
  → agentController.update
    → agentService.updateAgent(id, req.user.id, data) (agent.service.js:93)
      → agentRepository.findById(id)
      → existing.ownerId.toString() !== userId.toString() → check (line 96)
      → delete updateData.ownerId (line 99 — prevents ownerId hijacking)
      → agentRepository.update(id, updateData)
```

**Authorization:** Direct ObjectId comparison, Persona-User-bound.

### Flow C: Persona User Deletes Agent

```
DELETE /api/v1/agents/:id
  → auth.middleware
  → agentController.remove
    → agentService.deleteAgent(id, req.user.id) (agent.service.js:106)
      → Same ownerId.toString() !== userId.toString() check (line 110)
      → agentRepository.delete(id) → soft delete (isActive=false, deletedAt=Date)
```

**Soft delete:** `isActive` and `deletedAt` are set. No cascade to threads/memory.

### Flow D: User Lists Owned Agents

```
POST /api/v1/agents/search
  → optionalAuthMiddleware
  → body: { ownerId: req.user.id }
  → agentService.searchAgents(filters, pagination, userId)
    → _buildSearchFilter (agent.service.js:47)
      → filters.ownerId === userId.toString() → shows all (incl. private)
    → repository.search(match, pagination)
```

**Ownership boundary:** Implemented as query filter, no hard authorization gate (since the query itself scopes).

### Flow E: Public Agent Discovery

```
POST /api/v1/agents/search
  → optionalAuthMiddleware (req.user may be undefined)
  → body: {} (no ownerId)
  → agentService.searchAgents({}, pagination, null)
    → _buildSearchFilter: match.visibility = 'public' (line 69)
    → No owner scoping — purely global
```

**Dangerous query for Project isolation:** `match.visibility = 'public'` returns ALL public agents with no scope boundary.

### Flow F: Authorization Check for Agent Execution

```
POST /api/v1/agui (running an agent)
  → agui.routes.js: auth middleware + x-agent-id header
  → aguiController.runAgent
    → agentRepository.findById(context.agentId)
    → agentService.canUserExecuteAgent(agent, context.userId)
      → Checks: deletedAt, isActive, visibility === 'private', ownerId
```

**Authorization:** `canUserExecuteAgent` enforces visibility + ownership + deletion state.

### Flow G: Agent Attaching Skills/Knowledge/MCPs

```
PATCH /api/v1/agents/:id
  → req.body: { skills: [...], knowledgeBases: [...], mcps: [...] }
  → agentService.updateAgent(id, userId, updateData)
  → agentRepository.update(id, updateData) // Direct array replacement
```

**No cross-resource authorization:** When attaching skills/knowledge/MCPs to an agent, the system does NOT verify that the attached skills belong to the same user or are public. This is a potential isolation risk — an agent could theoretically reference a skill from another user.

---

## 8. Direct Persona/Clerk Coupling

### 8.1 Auth Middleware (Strongest Coupling)

```javascript
// auth.middleware.js
const authState = getAuth(req);         // Clerk-specific
const clerkId = authState?.userId;       // Clerk userId format
const user = await authService.syncUser(clerkId);  // Persona User lookup
req.user = user;                          // Always a Persona User doc
```

**Evidence:** `agent-backend/src/modules/auth/auth.middleware.js`

### 8.2 Auth Service (Clerk API Dependency)

```javascript
// auth.service.js, line 39:
const clerkUser = await clerkClient.users.getUser(clerkId);
// ...creates Persona User from Clerk data
```

**Evidence:** `agent-backend/src/modules/auth/auth.service.js`

### 8.3 All Ownership Fields

**Every** `ownerId` and `userId` field across all 8 collections is typed as `ObjectId → ref: 'User'` — always a Persona User.

### 8.4 Optional Auth

Even `optionalAuthMiddleware` still checks `getAuth(req)` from Clerk.

**Evidence:** `agent-backend/src/modules/auth/optional-auth.middleware.js`

### 8.5 Webhook Integration

Clerk webhooks (`user.created`, `user.updated`, `user.deleted`) manage Persona User lifecycle.

**Evidence:** `agent-backend/src/modules/webhooks/webhook.service.js`

### 8.6 User Deletion Cascade

```javascript
// user.service.js
async deleteUser(userId) {
  // Deletes ALL user-owned resources across all modules
  threadRepository.deleteAllByUser(userId);
  agentRepository.deleteManyByOwner(userId);
  skillRepository.deleteManyByOwner(userId);
  providerRepository.deleteManyByOwner(userId);
  mcpRepository.deleteManyByOwner(userId);
  mcpUserConnectionRepository.deleteManyByUser(userId);
  userRepository.delete(userId);
}
```

**Evidence:** `agent-backend/src/modules/users/user.service.js`

This cascade **assumes** every resource belongs to a Persona user. If resources could belong to a Project or an external user, this assumption breaks.

---

## 9. Global-Scope Assumptions

### 9.1 Queries Without Scope Boundaries

| Query | Location | Scope Assumption | Isolation Risk |
|-------|----------|-----------------|----------------|
| `Agent.find({ visibility: 'public' })` | agent.service.js `_buildSearchFilter` (line 69) | No scope = global | Returns ALL Project A agents when accessed from Project B |
| `Skill.find({ isPublic: true })` | skill.repository.js (line 34) | No scope = global | Returns ALL public skills globally |
| `Conversation.find({ userId })` | thread.repository.js (line 24) | Per user only | Already user-scoped (safe) |
| `MemoryFile.find({ namespace: ['users', userId, ... ]})` | memory-files-store.js | Per user only | Already user-scoped (safe) |

### 9.2 Unique Indexes (Global Constraints)

| Index | Collection | Scope | Impact on Multi-Tenant |
|-------|-----------|-------|----------------------|
| `slug` — unique | Agent | Global | Two agents in different projects cannot share a slug |
| `threadId` — unique | Conversation | Global | Rare conflict risk across projects |
| `qdrantCollectionName` — unique | KnowledgeBase | Global | Collision risk across projects |
| `clerkId` — unique | User | Global | External users don't have clerkId |
| `email` — unique | User | Global | External users may have colliding emails |
| `username` — unique, sparse | User | Global | Collision risk across projects |

### 9.3 Agent Slug Global Uniqueness

```javascript
// agent.model.js
slug: { type: String, required: true, unique: true, lowercase: true }
```

This is a **hard constraint** enforced at the database level. If an Agent belonged to `Project: Beyond Campus` and another to `Project: Coursify`, they currently cannot share the same slug value. A compound unique index `{ projectId: 1, slug: 1 }` would be needed.

---

## 10. Potential Isolation Risk Areas

### 10.1 High Risk

1. **Agent public search** (`agent.service.js` match.visibility = 'public') — Returns all public agents globally. Without a project scope filter, a Project B user would see Project A agents.

2. **Skill public marketplace** (`skill.repository.js` isPublic: true) — Same issue.

3. **Agent slug global uniqueness** — Prevents natural slug sharing across projects.

4. **Auth middleware** — always resolves to a Persona User. No path for "external user" identity.

5. **User deletion cascade** — Assumes all resources belong to one Persona user.

### 10.2 Medium Risk

6. **Agent referencing cross-user skills/knowledge/MCPs** — No ownership check when attaching resources to an agent. An agent could reference a skill from another user (though loading might fail).

7. **KnowledgeBase qdrantCollectionName uniqueness** — Global Qdrant collection names could collide.

8. **Thread repository `findByUser`** — Scopes by `userId` only. If we add project-scoped threading, all queries need a `projectId` field.

9. **Memory namespace patterns** — Currently `['users', userId, ...]`. Would need `['projects', projectId, 'users', externalUserId, ...]`.

### 10.3 Low Risk

10. **MCP OAuth state tokens** — Signed HMAC, but encode userId/mcpId. Would need projectId.

11. **Rate limiter** — Uses `req.user._id` or IP as identifier. Would need to consider project+user for project-scoped rate limiting.

12. **Admin middleware** (`admin.middleware.js`) — Checks `req.user.role === 'admin'`. There's no Project-admin concept.

---

## 11. Existing Reusable Primitives

### 11.1 What Can Be Reused

1. **`ownerId` field name** — Consistent across all models. A `projectId` field can sit alongside it.

2. **Service-layer authorization pattern** — The `ownerId.toString() !== userId.toString()` pattern is consistent. It can be extended to: `if (!isAuthorized(projectId, ownerId, userId))`.

3. **Visibility enum** (private/unlisted/public) — The concept maps well to Project-scoped visibility.

4. **`isActive` + `deletedAt` pattern** — Good for soft-deletion. Reusable.

5. **`isPublic` boolean** — Works for simpler resources (skills, knowledge). But needs to be scoped per project.

6. **Soft delete** — Agent's soft-delete pattern (`isActive=false, deletedAt=Date`) is a good reference for other modules.

7. **Memory namespace pattern** — Array-based namespacing (`['users', userId, 'agents', agentId]`) is already hierarchical. This could be extended to `['projects', projectId, 'users', externalUserId, 'agents', agentId]`.

8. **BaseStore implementations** (MemoryFilesStore, SkillLibraryStore) — Already encapsulated. The scoping is internal to the store.

### 11.2 What Must Change

1. **Auth middleware** — Must support both Persona users AND external/Project-authenticated identities.

2. **Every `ownerId` model field** — Must add `projectId` or equivalent scope field.

3. **Every `ownerId.toString() !== userId.toString()` check** — Must incorporate project scoping.

4. **Every public discovery query** — Must include a project scope filter.

5. **Global unique indexes** — Compound indexes with `projectId`.

6. **User model** — Either separate from external users, or gain a `projectId` field.

7. **Agent slug generation** — Must be unique per project (or remain globally unique with slug mangling).

---

## 12. A/B/C/D Classification

| Module | Classification | Rationale |
|--------|---------------|-----------|
| **Agents** | **C** — Deep Persona coupling | Ownership + visibility + slug + main agent concept + system prompt protection + execution auth |
| **Skills** | **B** — Reusable with scoping | Clean model, consistent ownership, but `isPublic` is Persona-global |
| **Knowledge** | **B** — Reusable with scoping | Clean model, but Qdrant collection naming + `isPublic` need scoping |
| **MCP** | **C** — Deep Persona coupling | OAuth state tokens encode userId, user connections are userId-scoped, owner auth is Persona-user-specific |
| **Providers** | **C** — Deep Persona coupling | API keys encrypted per Persona user, no concept of Project-provider key sharing |
| **Threads** | **C** — Deep Persona coupling | `userId` is the core scoping field, LangGraph checkpoints use thread_id (already UUID-based) |
| **Memory** | **B** — Reusable with scoping | Namespace pattern is already hierarchical and extensible |
| **Upload** | **A** — Likely reusable | Simple file upload, no ownership logic beyond auth middleware |
| **Auth** | **C** — Deepest coupling | Clerk JWT → Persona User is the foundation of all identity |
| **Users** | **D** — Unclear | Need architecture design for Persona users vs external users |
| **Webhooks** | **C** — Deep Persona coupling | Clerk lifecycle management assumes Persona-only user model |
| **AG-UI** | **B** — Reusable with scoping | Streaming protocol itself is identity-agnostic; authorization is done upstream via `canUserExecuteAgent` |
| **Tools** | **A** — Likely reusable | No ownership logic, purely functional utilities |
| **Cron** | **A** — Likely reusable | Scheduled jobs, no direct ownership concept |
| **Health** | **A** — Likely reusable | No ownership concept |
| **Rate Limiter** | **B** — Reusable with scoping | Identifier key pattern can incorporate projectId |
| **Mail** | **A** — Likely reusable | No ownership concept |

### Classification Summary

| Class | Count | Meaning |
|-------|-------|---------|
| **A** (reusable largely unchanged) | 5 | Health, Tools, Cron, Mail, Upload |
| **B** (reusable with scoping) | 5 | Skills, Knowledge, Memory, AG-UI, Rate Limiter |
| **C** (deeply coupled) | 6 | Agents, MCP, Providers, Threads, Auth, Webhooks |
| **D** (needs architectural design) | 1 | Users |

---

## 13. Questions Architecture Must Resolve

1. **How does Persona coexist with Projects?** Does Persona itself become "Project: Persona"? Or does it keep a separate code path?

2. **What does `visibility = 'public'` mean after Project scoping?** Public within the Project? Persona-global? Both need a scope qualifier.

3. **How do external users map to the User collection?** A new collection? A `projectId` field on User? No User document at all (identity embedded in tokens)?

4. **How do Project Admins authenticate?** Same Clerk? Separate API keys? A new auth system?

5. **What happens to the Agent slug uniqueness constraint?** Compound index `{ projectId, slug }`?

6. **How do Qdrant collections get named?** Qdrant has no namespace/collection-grouping concept. Collection names would need to be unique or prefixed per project.

7. **How do LangGraph checkpoints get scoped?** They use `thread_id` (UUID). Threads are already user-scoped via `Conversation.userId`. Scoping could be at the Conversation collection level (by adding `projectId`).

8. **How does Provider credential management work?** A Project might provide a shared provider for all its agents. Today, providers are per-Persona-user. This needs a Project-level provider concept.

9. **How does User deletion cascade work in a multi-tenant world?** Deleting a Persona user should only delete THEIR resources, not Project resources they administratively modified.

10. **Is the Architect virtual agent affected?** It uses a special `_id` (`ARCHITECT_AGENT_ID`) that bypasses normal authorization. It doesn't have an `ownerId`. This special case needs consideration.

11. **How does the "Main Agent" (Clone) concept interact with Projects?** This is a Persona-specific feature (one agent per user tied to their username). It shouldn't apply to external users in Projects.

12. **Do Projects need their own "main agent" equivalent?** Or is the "main agent" concept purely Persona-specific?

13. **Should external users have full User models?** Or lightweight identity records referenced by `(projectId, externalUserId)`?

---

## 14. Files Inspected

The following files were read in full or in relevant part for this analysis:

| File | Purpose |
|------|---------|
| `agent-backend/src/modules/auth/auth.middleware.js` | Auth middleware — Clerk JWT → Persona User |
| `agent-backend/src/modules/auth/auth.service.js` | User sync/find-or-create from Clerk |
| `agent-backend/src/modules/auth/optional-auth.middleware.js` | Optional auth for public routes |
| `agent-backend/src/modules/users/user.model.js` | User schema — clerkId, email, etc. |
| `agent-backend/src/modules/users/user.repository.js` | User DB access |
| `agent-backend/src/modules/users/user.service.js` | User deletion cascade |
| `agent-backend/src/modules/users/admin.middleware.js` | Admin role check |
| `agent-backend/src/modules/agents/agent.model.js` | Agent schema — ownerId, visibility, isActive, deletedAt |
| `agent-backend/src/modules/agents/agent.repository.js` | Agent DB access |
| `agent-backend/src/modules/agents/agent.service.js` | Core agent authorization + business logic |
| `agent-backend/src/modules/agents/agent.controller.js` | Agent request handlers |
| `agent-backend/src/modules/agents/agent.routes.js` | Agent route definitions |
| `agent-backend/src/modules/agents/agent.factory.js` | Agent graph compilation (partial) |
| `agent-backend/src/modules/skills/skill.model.js` | Skill schema — ownerId, isPublic |
| `agent-backend/src/modules/skills/skill.service.js` | Skill ownership + visibility logic |
| `agent-backend/src/modules/skills/skill.repository.js` | Skill DB access — public query |
| `agent-backend/src/modules/skills/skillLibraryStore.js` | Skill library BaseStore — user-namespaced |
| `agent-backend/src/modules/knowledge/knowledge-base.model.js` | KB schema — ownerId, isPublic, qdrantCollectionName |
| `agent-backend/src/modules/knowledge/knowledge-chunk.model.js` | KB chunk schema — kbId, no direct owner |
| `agent-backend/src/modules/knowledge/knowledge.service.js` | KB ownership checks + Qdrant operations |
| `agent-backend/src/modules/knowledge/knowledge.repository.js` | KB DB access |
| `agent-backend/src/modules/knowledge/knowledge.routes.js` | KB route definitions (all auth-required) |
| `agent-backend/src/modules/mcp/mcp.model.js` | MCP schema — ownerId, authType, authMode |
| `agent-backend/src/modules/mcp/mcp-user-connection.model.js` | MCP user connection — mcpId, userId |
| `agent-backend/src/modules/mcp/mcp.service.js` | MCP authorization + OAuth flows |
| `agent-backend/src/modules/mcp/mcp.repository.js` | MCP DB access |
| `agent-backend/src/modules/mcp/mcp-user-connection.repository.js` | User connection DB access |
| `agent-backend/src/modules/mcp/mcp.routes.js` | MCP route definitions |
| `agent-backend/src/modules/providers/provider.model.js` | Provider schema — ownerId, apiKeyEncrypted |
| `agent-backend/src/modules/providers/provider.service.js` | Provider ownership + key encryption |
| `agent-backend/src/modules/providers/provider.repository.js` | Provider DB access |
| `agent-backend/src/modules/threads/thread.model.js` | Thread schema — userId, agentId, threadId |
| `agent-backend/src/modules/threads/thread.repository.js` | Thread DB access — findByUser |
| `agent-backend/src/modules/threads/thread.controller.js` | Thread request handlers with ownership checks |
| `agent-backend/src/modules/threads/checkpoint.service.js` | LangGraph checkpoint management |
| `agent-backend/src/modules/memory/memory-file.model.js` | Memory file schema — namespace array |
| `agent-backend/src/modules/memory/memory-files-store.js` | Memory BaseStore — namespace-scoped |
| `agent-backend/src/modules/memory/memory.service.js` | Memory file operations |
| `agent-backend/src/modules/memory/memory.routes.js` | Memory route definitions |
| `agent-backend/src/modules/upload/upload.routes.js` | File upload — auth-only, no ownership field |
| `agent-backend/src/modules/agui/agui.routes.js` | AG-UI route — auth + context resolution |
| `agent-backend/src/modules/agui/agui.controller.js` | AG-UI controller — agent auth |
| `agent-backend/src/modules/agui/agui.service.js` | AG-UI event streaming |
| `agent-backend/src/modules/webhooks/webhook.routes.js` | Clerk webhook handler |
| `agent-backend/src/modules/webhooks/webhook.service.js` | User lifecycle from Clerk webhooks |
| `agent-backend/src/modules/rateLimiter/rateLimiter.middleware.js` | Rate limiter — user/ip key |
| `agent-backend/src/index.js` | Express app — route mounting, middleware |

---

## 15. Evidence / File References

Every significant claim above cites the relevant file path. Below is a consolidated quick-reference:

| Claim Key | File | Line(s) |
|-----------|------|---------|
| Clerk JWT → Persona User | `auth/auth.middleware.js` | 5-17 |
| Clerk auto-sync | `auth/auth.service.js` | 27-90 |
| User has `clerkId` | `users/user.model.js` | 56-61 |
| Agent `ownerId` (User ref) | `agents/agent.model.js` | 6-10 |
| Agent visibility enum | `agents/agent.model.js` | 78-83 |
| Agent slug global unique | `agents/agent.model.js` | 14-18 |
| Agent soft delete fields | `agents/agent.model.js` | 86-92 |
| Agent authorization pattern | `agents/agent.service.js` | 93-116 |
| Agent `canUserExecuteAgent` | `agents/agent.service.js` | 90-116 |
| Agent public search (no scope) | `agents/agent.service.js` | 69 |
| Skill `ownerId` | `skills/skill.model.js` | 6-10 |
| Skill `isPublic` | `skills/skill.model.js` | 42-45 |
| Skill public query (global) | `skills/skill.repository.js` | 30-33 |
| KnowledgeBase `ownerId` | `knowledge/knowledge-base.model.js` | 18-23 |
| MCP `ownerId` | `mcp/mcp.model.js` | 44-49 |
| MCP `authMode: 'owner' | 'user'` | `mcp/mcp.model.js` | 73-78 |
| Provider `ownerId` | `providers/provider.model.js` | 6-10 |
| Thread `userId` | `threads/thread.model.js` | 13 |
| Thread ownership check | `threads/thread.controller.js` | 33-37 |
| Memory namespace pattern | `memory/memory-file.model.js` | 13-22 |
| Memory namespace helpers | `memory/memory-files-store.js` | 153-163 |
| User deletion cascade | `users/user.service.js` | 13-30 |
| Admin role check | `users/admin.middleware.js` | 4-8 |
| Rate limiter key | `rateLimiter/rateLimiter.middleware.js` | 23 |
| Optional auth | `auth/optional-auth.middleware.js` | 6-22 |
| AG-UI context resolution | `agui/agui.routes.js` | 12-33 |
| Skill library BaseStore namespace | `skills/skillLibraryStore.js` | 186 |
| MCP user connection `userId` | `mcp/mcp-user-connection.model.js` | 12-17 |
| MCP OAuth state encodes userId | `mcp/mcp.service.js` | 218-224 |
| Provider key encryption per user | `providers/provider.service.js` | 57-63 |
| KnowledgeChunk indirect ownership | `knowledge/knowledge-chunk.model.js` | 6-11 |
| Checkpoint cleanup uses thread_id | `threads/checkpoint.service.js` | 54-72 |
| Webhook Clerk user lifecycle | `webhooks/webhook.service.js` | 12-92 |
| Slug unique index constraint | `agents/agent.model.js` | 16 |
| Skill owner+name unique index | `skills/skill.model.js` | 45-47 |
| MCP owner+name unique index | `mcp/mcp.model.js` | 87-89 |

---

## 16. Summary of Findings

### What Defines Ownership
A `User` document's `_id` stored in a resource's `ownerId` or `userId` field. This is universally of type `ObjectId → ref: 'User'`.

### Is Ownership Consistent?
**Yes.** All 6 main resource types use `ownerId`. Threads and MCP user connections use `userId`. Memory uses namespace arrays. There are no wild deviations.

### Where Is Clerk/Persona User Identity Directly Embedded?
Everywhere: auth middleware, auth service, all 6 resource models' `ownerId` fields, thread `userId`, MCP user connection `userId`, memory namespaces, AG-UI context, OAuth state tokens, rate limiter keys, user deletion cascade.

### Which Collections Assume Every Resource Belongs to a Persona User?
**All of them.** Agents, Skills, Knowledge, MCP, Providers, Threads, MCP User Connections, Memory Files, Knowledge Chunks.

### Resources With No Explicit Owner?
None. Every resource is either directly owned or indirectly referenced through an owner chain.

### Can an Agent Be Owned by Something Other Than a User?
Today, **no.** The only exception is the virtual Architect agent (special `_id` `000000000000000000000000`), which bypasses normal authorization.

### Where Is Visibility Enforced?
In service layers: `agent.service.js` (`_buildSearchFilter`, `canUserExecuteAgent`), `skill.service.js` (public check), `knowledge.service.js` (isPublic check).

### Does "Public" Implicitly Mean Persona-Global?
**Yes.** Public discovery queries have no project/scope boundary.

### Which Queries Would Become Dangerous?
All public discovery queries: agent search (`visibility: 'public'`), skill public listing (`isPublic: true`), knowledge base visibility checks — they have no scope filter.

### Which Unique Indexes Assume Global Scope?
- Agent `slug` (global unique)
- Conversation `threadId` (global unique)
- KnowledgeBase `qdrantCollectionName` (global unique)
- User `email` (global unique)
- User `clerkId` (global unique)

### Which Relationships Need Architectural Attention?
All of them. Every resource-to-resource relationship (Agent → Skills, Agent → MCPs, Agent → KnowledgeBases, Agent → Provider) is a cross-module reference that currently assumes same-user ownership.

### Are There Implicit `resource.userId === authenticated Persona user` Assumptions Spread Throughout?
**Yes.** Every service authorization check, every repository query, every controller handler that accesses `req.user.id` makes this assumption. It is the **single defining characteristic** of the current architecture.
