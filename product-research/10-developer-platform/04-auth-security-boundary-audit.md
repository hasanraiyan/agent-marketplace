# Persona Developer Platform — Auth/Security Boundary Audit

> **Audit date:** 2026-07-29
> **Codebase state:** `feat/ai` branch, pre-Developer-Platform implementation
> **Scope:** Current (single-tenant) Persona product auth/authz, evaluated against future
>   Developer Platform requirements from `developer-platform-requirements.md`
>
> **⚠️ NOT IMPLEMENTATION. NOT ARCHITECTURE. SECURITY RESEARCH ONLY.**

---

## 1. Executive Summary

Persona's current authentication is **single-tenant, Clerk-bound, user-owned.** There is exactly
one identity domain (Persona users authenticated via Clerk), one ownership model (each resource
is owned by one MongoDB User), and no concept of Projects, tenants, organizations, workspaces,
API keys, or service accounts.

**The biggest finding:** the entire authorization model assumes `authenticated identity == resource
owner == runtime user`. The three roles the Developer Platform requires (Platform Admin, Project
Admin, Project/Runtime User) are currently compressed into a single dimension with only two
levels: `normal` and `admin`. Every service implements its own ad-hoc ownership check by string-
comparing `ownerId.toString()` to `userId.toString()`. There is zero centralized authorization.

**The second biggest finding:** MCP OAuth uses a signed state token (HMAC-SHA256, time-limited)
to carry identity across an unauthenticated redirect — this is the *only* existing mechanism that
already conveys "identity without a Clerk session." It is a valuable primitive to preserve.

**The most dangerous risk for the Developer Platform:** the near-total absence of tenant
isolation. Adding `X-Project-Key` and `X-External-User-Id` headers without a middleware-level
enforcement layer would let any bearer of a valid Clerk token trivially impersonate any Project
or external user because the code has no concept of project scoping at any layer (route,
middleware, service, or data model).

---

## 2. Current Authentication Architecture

### 2.1 Frontend Authentication

| Layer | Mechanism | File |
|-------|-----------|------|
| Route protection | `clerkMiddleware()` with `createRouteMatcher()` | `frontend/src/middleware.js` |
| Public routes | `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/dashboard/agents/(.*)` | same |
| Token injection | `AxiosTokenProvider` component → `setTokenFetcher(getToken)` → axios interceptor | `frontend/src/components/auth/axios-token-provider.jsx` |
| API request header | `Authorization: Bearer <Clerk-session-token>` | `frontend/src/lib/api/core.js` |
| Profile hook | `useProfile()` uses `useUser()` from `@clerk/nextjs` | `frontend/src/hooks/use-profile.js` |

Every frontend API call goes through the axios instance in `frontend/src/lib/api/core.js`. The
request interceptor calls `window.Clerk.session.getToken()` (or the injected `getToken` from
`useAuth()`) and attaches the result as a Bearer token.

### 2.2 Backend Authentication

| Layer | Mechanism | File |
|-------|-----------|------|
| Clerk SDK middleware | `clerkMiddleware()` from `@clerk/express` — parses session JWT | `agent-backend/src/index.js` |
| Required auth | `authMiddleware` → `getAuth(req)`, `authService.syncUser(clerkId)` → sets `req.user` | `agent-backend/src/modules/auth/auth.middleware.js` |
| Optional auth | Same but catches errors silently | `agent-backend/src/modules/auth/optional-auth.middleware.js` |
| Admin gate | `adminMiddleware` checks `req.user.role === 'admin'` | `agent-backend/src/modules/users/admin.middleware.js` |

**Middleware registration order** (from `agent-backend/src/index.js`):

```
1. CORS
2. No-cache headers
3. Request logging
4. /api/v1/webhooks — RAW body, NO clerkMiddleware, NO json parser
5. clerkMiddleware() — parses Clerk session for ALL subsequent routes
6. /api/v1/agui — RAW body (AG-UI reads its own request body)
7. express.json()
8. Route-specific middleware (authMiddleware, optionalAuthMiddleware, etc.)
```

### 2.3 Auth Flow Diagram

**Flow A: Normal authenticated dashboard API request**

```
Browser ──[Clerk session cookie]──→ Next.js middleware.js
  ├── If public route (/, /sign-in, etc.) → allow
  └── If protected route → Clerk validates session → allow or redirect
       │
       ↓
  React component → AxiosTokenProvider.getToken() → Bearer token
       │
       ↓
  axios request → api.get('/agents/search', ...)
       │  headers: { Authorization: 'Bearer <clerk-jwt>' }
       ↓
  Express backend
       │
       ├── clerkMiddleware() ──→ getAuth(req) → clerkId
       ├── authMiddleware ──→ authService.syncUser(clerkId) → req.user
       ├── route handler
       └── response
```

**Flow B: Agent execution request**

```
Browser ──→ POST /api/v1/agui ──→ aguiRouter middleware
  │  headers: { Authorization, x-agent-id, x-thread-id }
  │
  ├── authMiddleware → getAuth(req) → syncUser → req.user
  ├── Resolve userId = req.user._id (MongoDB ObjectId)
  ├── Resolve agentId = req.headers['x-agent-id']
  ├── Resolve thread → verify thread.userId === userId
  ├── req.aguiContext = { userId, agentId, langGraphThreadId, threadDbId }
  │
  └── aguiController.runAgent()
       ├── Check: rateLimiter (concurrency)
       ├── agentRepository.findById(context.agentId)
       ├── agentService.canUserExecuteAgent(agent, context.userId) ← central auth
       ├── readJsonBody(req)
       └── runAgentAsAguiEvents({ agentId, userId, ... })
            └── agentFactory.buildAgent(agentId, userId, checkpointer)
                 ├── SECOND canUserExecuteAgent(agent, userId) check ← defense-in-depth
                 └── Build DeepAgent graph, return event stream
```

**Flow C: Public agent execution by non-owner**

```
→ GET /api/v1/agents/:id with optionalAuthMiddleware
→ agentService.getAgentById(id, userId)  where userId may be null
  → agentRepository.findById(id)
  → canUserExecuteAgent(agent, userId)
    → ownerId !== userId (or userId is null)
    → visibility !== private → allowed
    → isActive === true → allowed
  → _formatSafe(agent, userId) → strips systemPrompt, providerId since not owner
  → Returns agent (without sensitive config)
```

**Flow D: Private agent execution**

```
→ POST /api/v1/agui with authMiddleware
→ aguiController → canUserExecuteAgent(agent, userId)
  → visibility === 'private'
  → ownerId !== userId → returns false
→ 404 "Agent not found"
```

**Flow E: Inactive agent execution by owner Studio testing**

```
→ POST /api/v1/agui with authMiddleware
→ aguiController → canUserExecuteAgent(agent, userId)
  → agent.isActive === false
  → ownerId === userId → returns true (owner can test inactive agents)
→ allowed
```

**Flow F: MCP OAuth start/callback**

```
→ GET /api/v1/mcps/:id/oauth/owner/authorize
  → authMiddleware → req.user
  → mcpService.getOwnerAuthorizationUrl(id, req.user.id)
    → mcpService.getMcpById(id, userId) → ownership check
    → signOAuthState({ mcpId, userId, mode: 'owner', codeVerifier })
    → Returns authorization URL

→ GET /api/v1/mcps/oauth/owner/callback?code=...&state=...
  → NO authMiddleware (browser redirect from external OAuth server)
  → mcpService.handleOwnerCallback(code, state)
    → verifyOAuthState(state) → recovers { mcpId, userId, mode, codeVerifier }
      → HMAC-SHA256 verification, expiry check
    → exchangeCodeForToken
    → mcpRepository.update(mcpId, userId, { oauth.ownerToken })
    → Redirect to frontend

User callback is identical pattern with mode: 'user'
```

**Flow G: Server-to-server/internal API calls**

**NONE EXIST.** There are no internal API calls, no machine-to-machine auth, no API keys, no
service accounts. Internal module communication is direct function calls within the same Node.js
process. The only cross-process communication is MongoDB and external service calls (OpenAI,
Qdrant, Tavily, Clerk API, MCP servers).

---

## 3. Current Principal/Identity Model

### 3.1 Identity Sources

There is exactly **one principal type**: a Persona User, represented as a MongoDB document in
the `users` collection.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `_id` | ObjectId | MongoDB | Primary local identifier |
| `clerkId` | String | Clerk | From Clerk's `userId` claim in session JWT |
| `email` | String | Clerk | From Clerk webhook or auto-sync |
| `name` | String | Clerk | Concatenated firstName + lastName |
| `username` | String? | Clerk | Optional |
| `role` | 'normal' \| 'admin' | Local | Default 'normal', only changed manually |
| `isActive` | Boolean | Local | Default true |

The `clerkId` field is the bridge between Clerk's identity and the local User document. It is
unique and indexed.

### 3.2 How req.user is Constructed

```
Request
  ↓
clerkMiddleware() ──→ getAuth(req) returns { userId: 'clerk_abc123', sessionId: '...' }
  ↓
authMiddleware
  ↓
authService.syncUser('clerk_abc123')
  ↓
1. userRepository.findByClerkId('clerk_abc123')  →  if found, return it
2. If not found:
   a. clerkClient.users.getUser('clerk_abc123')   →  fetch from Clerk API
   b. Create local User document with clerkId, email, name, role: 'normal'
   c. Return created user
  ↓
req.user = { _id: ObjectId, clerkId, email, name, role, ... }
```

### 3.3 Dual ID System

The system has **two user identifier formats**:
- **`req.user.clerkId`** — String like `user_2abc123def`. Used by Clerk SDK and webhooks.
- **`req.user._id` / `req.user.id`** — MongoDB ObjectId. Used as `ownerId` in all resource
  models, as `userId` in threads and MCP user connections, and throughout services.

This dual-ID system is a potential source of confusion for the Developer Platform: external users
will not have either Clerk IDs or MongoDB ObjectIds.

---

## 4. User Provisioning

### 4.1 Clerk Webhook Sync

File: `agent-backend/src/modules/webhooks/webhook.service.js`

| Event | Action |
|-------|--------|
| `user.created` | Create local User from Clerk payload |
| `user.updated` | Update local User email/name/username |
| `user.deleted` | Delete local User |

The webhook route (`POST /api/v1/webhooks/clerk`) is:
- **Raw body** (Svix signature verification requires raw bytes)
- **No Clerk middleware** (no session — it's called by Clerk's backend, not a browser)
- **Verified via Svix** (HMAC-SHA256 with `CLERK_WEBHOOK_SECRET`)
- **No rate limiting** on the webhook route

### 4.2 Runtime Auto-Sync

When a request arrives with a valid Clerk session but no local user exists,
`authService.syncUser()` auto-creates one. This means **any authenticated Clerk user is
provisioned automatically** — there is no invite system, no admin approval gate, and no
onboarding flow for the backend.

### 4.3 Account Deletion

`userService.deleteUser(userId)` cascades:
1. Delete all threads (and their LangGraph checkpoints)
2. Delete all agents owned by user (`agentRepository.deleteManyByOwner`)
3. Delete all skills owned by user
4. Delete all providers owned by user
5. Delete all MCPs owned by user
6. Delete all MCP user connections
7. Delete the User document itself

---

## 5. Authorization Architecture

### 5.1 Authorization Layer Distribution

| Layer | Auth Mechanism | Examples |
|-------|---------------|---------|
| **Middleware** | Clerk session validation, role check | `authMiddleware`, `optionalAuthMiddleware`, `adminMiddleware` |
| **Route** | Guard clauses, middleware chaining | `router.use(authMiddleware)`, `router.get('/', authMiddleware, ...)` |
| **Controller** | Extracts `req.user.id`, delegates to service | `agentController.create(req, res, next)` |
| **Service** | Ownership comparisons, visibility logic | `canUserExecuteAgent()`, `_formatSafe()`, `_buildSearchFilter()` |
| **Repository** | Query-level filtering (limited) | `findByOwner(userId)`, `deleteManyByOwner(userId)` |
| **Runtime** | Defense-in-depth in factory | `agentFactory.buildAgent()` re-checks `canUserExecuteAgent()` |

### 5.2 Ownership Check Patterns

Every resource with an owner follows a **manual string comparison** pattern:

**AgentService:**
```javascript
// update
if (existing.ownerId.toString() !== userId.toString()) throw new Error('Unauthorized');

// delete
if (existing.ownerId.toString() !== userId.toString()) throw new Error('Unauthorized');

// _formatSafe
const isOwner = ownerIdStr === requestingIdStr;
if (!isOwner) { delete obj.systemPrompt; delete obj.providerId; }
```

**McpService:**
```javascript
// getMcpById (used as gate for all MCP operations)
if (!mcp || mcp.ownerId.toString() !== userId.toString()) throw new NotFoundError('...');
```

**SkillService:**
```javascript
// getSkillById
const isOwner = Boolean(userId && skill.ownerId.toString() === userId.toString());
if (!skill.isPublic && !isOwner) throw new Error('Skill not found or private');

// delete
if (skill.ownerId.toString() !== userId.toString()) throw new Error('Unauthorized');
```

**KnowledgeService:**
```javascript
// (via error messages in controller — exact code not inspected, but follows same pattern)
if (error.message === 'Not authorized to access this knowledge base') ...
if (error.message === 'Not authorized to update this knowledge base') ...
```

**ThreadRepository:**
```javascript
// Threads have userId, not ownerId, but the pattern is the same
if (thread && thread.userId.toString() === userId.toString()) { ... }
```

### 5.3 Admin Authorization

The only role-based authorization is `adminMiddleware`:
```javascript
if (!req.user || req.user.role !== 'admin') throw new BaseError('Admin access required', 403, ...);
```

Admin routes (`/api/v1/admin/*`):
- `GET /admin/users` — list all users (paginated)
- `DELETE /admin/users/:id` — hard delete any user (with self-deletion guard)

These are the **only** endpoints with `adminMiddleware`. There is no scoped admin (e.g., "Project
Admin"). There is no role hierarchy beyond `normal` < `admin`.

### 5.4 Visibility Enforcement

**Agent visibility** is the most sophisticated enforcement in the system:
- `canUserExecuteAgent()` — gate for execution (AG-UI, agent detail)
- `_buildSearchFilter()` — gate for discovery (search, count)
- `_formatSafe()` — information hiding (non-owners can't see systemPrompt or providerId)
- Three visibility levels: `public`, `unlisted`, `private`

**Skill visibility** is binary `isPublic` boolean.

**Knowledge Base visibility** is binary `isPublic` boolean (not fully confirmed but implied by
controller error messages).

**MCPs** have no visibility concept — they are always owner-only.

**Threads** have no visibility concept — they are always user-only.

---

## 6. Agent Execution Authorization

### 6.1 `canUserExecuteAgent()` — Central Gate

**Location:** `agent-backend/src/modules/agents/agent.service.js`

This is the **single most important authorization function** in the codebase. It is the
central source of truth for "can this user execute this agent?".

```javascript
canUserExecuteAgent(agent, userId) {
  if (!agent) return false;
  if (agent.isVirtual || agent._id === '000000000000000000000000') return true;
  if (agent.deletedAt) return false;

  const ownerIdStr = agent.ownerId?.toString();
  const requestingIdStr = userId?.toString();
  const isOwner = Boolean(requestingIdStr && ownerIdStr === requestingIdStr);

  if (agent.isActive === false && !isOwner) return false;
  if (agent.visibility === 'private' && !isOwner) return false;
  return true;
}
```

Called from:
1. **`aguiController.runAgent()`** — before starting SSE stream
2. **`agentFactory.buildAgent()`** — before building DeepAgent graph (defense-in-depth)
3. **`agentService.getAgentById()`** — for agent detail retrieval
4. **`agentService.getAgentBySlug()`** — for slug-based retrieval

### 6.2 Agent Execution Authorization Chain

```
POST /api/v1/agui (raw body)
  └── aguiRouter middleware
       ├── authMiddleware → req.user
       ├── Resolve agentId from x-agent-id header
       ├── Resolve threadId → verify ownership (thread.userId === userId)
       └── req.aguiContext = { userId, agentId, ... }

  └── aguiController.runAgent()
       ├── Check: rate limiter (concurrency: max 2 per userId)
       ├── agentRepository.findById(context.agentId) → agent doc
       ├── agentService.canUserExecuteAgent(agent, context.userId)
       │   - Returns false → 404 "Agent not found" (does not leak existence)
       │   - Returns true → proceed
       └── readJsonBody(req)

  └── runAgentAsAguiEvents({ agentId, userId, ... })
       └── agentFactory.buildAgent(agentId, userId, checkpointer)
            ├── SECOND canUserExecuteAgent(agent, userId) check
            ├── Fetch provider → decrypt API key
            ├── Build DeepAgent graph with tools, memories, subagents
            └── Return instance for streaming
```

### 6.3 Threats Defended

- **Deleted agents**: `canUserExecuteAgent` returns false for `agent.deletedAt` — no one (not even
  owner) can execute a soft-deleted agent.
- **Inactive agents**: Only the owner can execute (enables Studio testing of draft agents).
- **Private agents**: Only the owner can execute.
- **Cross-user thread access**: AG-UI route verifies `thread.userId.toString() === userId.toString()`.
- **Concurrency**: Rate-limited to 2 concurrent chats per user.
- **Information hiding**: `_formatSafe()` strips system prompts and provider config from non-owners.

### 6.4 Threats NOT Defended (Today)

- **No tenant isolation**: There is no project/resource-container concept.
- **No execution audit**: No record of who executed what agent when.
- **No rate limiting on the agent session itself**: The thread ID is deterministic
  (`agui-${agentId}-${userId}`) — but once inside the stream, there's no per-message throttle
  beyond the CHAT rate limiter on the POST route.
- **No agent-level quotas**: No limits on how many messages an agent can process, or how many
  users can execute a public agent.

---

## 7. Ownership Authorization by Module

| Module | Owner Field | Owner Type | Auth Pattern | Centralized? |
|--------|-------------|------------|--------------|--------------|
| **Agent** | `ownerId` | User ObjectId | `canUserExecuteAgent()`, `_formatSafe()`, `_buildSearchFilter()`, manual comparison in update/delete | **Partially** — `canUserExecuteAgent` is shared by execution path, but update/delete have separate checks |
| **Thread** | `userId` | User ObjectId | `thread.userId.toString() === userId.toString()` | **No** — inline in AG-UI middleware and thread controller |
| **MCP** | `ownerId` | User ObjectId | `getMcpById()` always checks ownership | **No** — per-module |
| **Skill** | `ownerId` | User ObjectId | Manual comparison in `getSkillById`, `deleteSkill` | **No** — per-module |
| **Provider** | `ownerId` | User ObjectId | Manual comparison in service | **No** — per-module |
| **Knowledge Base** | `ownerId` | User ObjectId | Error messages indicate service-level check | **No** — per-module |
| **Memory** | Implicit via namespace | User ObjectId | Namespace-based isolation (`['users', userId, 'agents', agentId]`) | **N/A** — data structure enforces it |
| **MCP User Connection** | `userId` | User ObjectId | Query-level: `findByMcpAndUser(mcpId, userId)` | **N/A** — compound key |

**Key observation:** There is **zero ownership/authorization logic shared across modules**. Each
module reimplements the same `ownerId.toString() !== userId.toString()` pattern independently.

---

## 8. MCP OAuth Identity Flow

### 8.1 OAuth State Token Design

The MCP OAuth flow is the **only mechanism** that conveys identity without a Clerk session. It
is a well-designed mechanism worth preserving.

**`oauth-state.js`** — `signOAuthState()`:

```javascript
signOAuthState({ mcpId, userId, mode, codeVerifier }, ttlSeconds = 600) {
  // HMAC-SHA256 over JSON payload with expiry
  // Format: base64url(payload).base64url(signature)
  // Uses JWT_SECRET as signing key
}
```

The state payload contains:
```json
{
  "mcpId": "ObjectId",
  "userId": "ObjectId",
  "mode": "owner" | "user",
  "codeVerifier": "base64url-string",
  "exp": 1234567890
}
```

Verification: `crypto.timingSafeEqual()` over HMAC digests, plus expiry check.

### 8.2 Owner vs User Mode

| Mode | Who Connects | Storage | Auth on Callback |
|------|-------------|---------|-----------------|
| `owner` | MCP creator | Token on MCP document (`oauth.ownerToken`) | Recover userId from signed state |
| `user` | End user | Token on `McpUserConnection` doc (per userId) | Recover userId from signed state |

### 8.3 MCP Auth Types

| Auth Type | Transport | Token Storage | Who Creates? |
|-----------|-----------|---------------|--------------|
| `none` | HTTP/SSE | None | Anyone |
| `apiKey` | HTTP/SSE | Encrypted in `mcp.apiKeyEncrypted` | Owner (always shared) |
| `oauth` (owner) | HTTP/SSE | Dynamic/permanent in MCP doc | Owner authenticates once |
| `oauth` (user) | HTTP/SSE | Per-user in `mcp_user_connections` | Each user authenticates separately |

### 8.4 Token Refresh

`mcp-token.service.js` handles transparent token refresh for both owner and user OAuth tokens.
Uses a 60-second skew window before expiry to trigger proactive refresh.

---

## 9. Existing Machine-to-Machine Authentication

**There is none.** What doesn't exist:
- ❌ No API keys for service-to-service auth
- ❌ No service accounts
- ❌ No internal API tokens
- ❌ No webhook-to-backend auth (Clerk webhooks go through Svix, calls from services like
  OpenAI/Tavily are one-directional)
- ❌ No OAuth client credentials flow
- ❌ No session tokens for anything other than Clerk browser sessions

The only M2M-like mechanism is:
- **Svix webhook verification** for Clerk → Persona webhooks (HMAC-SHA256)
- **MCP OAuth state signing** (HMAC-SHA256, but this conveys user identity after an OAuth flow,
  it's not M2M auth)

---

## 10. Persona-User Assumptions

The following are **explicit or implicit assumptions** in the current codebase that tie
authorization to Persona users specifically:

### 10.1 `authenticated identity == resource owner` — WHERE

Every ownership check using `ownerId.toString() === userId.toString()` explicitly assumes that
the authenticated user IS the only valid principal type. There is no mechanism to say "this
is a Project Admin acting on another user's resource," or "this is a runtime user who is not
the owner."

Affected code:
- `agentService.updateAgent()`, `deleteAgent()`, `_formatSafe()`
- `mcpService.getMcpById()` (used as gate for ALL MCP mutations)
- `skillService.deleteSkill()`
- `knowledgeService.*` (implied by error messages)
- `threadRepository` operations (scoped by `userId`)
- AG-UI thread ownership check

### 10.2 `authenticated identity == runtime user` — WHERE

In the AG-UI execution path, `userId` from `req.user._id` is passed directly as the runtime
user. There is no distinction between "the user who owns the agent" and "the user running the
agent":

- `aguiRouter` middleware: `const userId = req.user._id;`
- `aguiController.runAgent()`: `context.userId` used for `canUserExecuteAgent()` and as the
  runtime identity
- `agentFactory.buildAgent()`: `userId` used for memory namespace (`['users', userId, 'agents', agentId]`)

### 10.3 `Persona user == only possible principal` — WHERE

- `userRepository.findByClerkId()` assumes every user has a Clerk ID
- `authService.syncUser()` creates a full Persona user for every authenticated client
- `userMemoryNamespace(userId)` and `agentMemoryNamespace(userId, agentId)` use MongoDB ObjectIDs
  as namespace keys with the prefix `['users', ...]`
- All `ownerId` fields are `ref: 'User'` — Mongoose foreign keys to the User model
- The User model requires `clerkId` (unique, required, indexed)
- The User model validates email uniqueness — but external users won't have Persona emails
- `cascadeOnDelete` logic in `userService.deleteUser()` destroys ALL user resources — no scoped
  deletion exists

---

## 11. Future Project Boundary Risk Analysis

### 11.1 What Would Happen with `X-Project-Key` + `X-External-User-Id`

If these headers were simply injected without middleware-level enforcement, the following
scenarios would arise:

**Risk 1: Project Impersonation via Body/Query Parameters**

Many endpoints accept `ownerId` in request bodies (e.g., `POST /agents/search`). A malicious
Actor A could pass `ownerId: <Actor-B's-Id>` in a search request and, if `optionalAuthMiddleware`
is in use, gain information about Actor B's agents. The `_buildSearchFilter()` method does check
that you can't search another user's private agents — but it still allows `public` and `unlisted`
visibility.

**Risk 2: No Project Scoping at Database Level**

Every resource model lacks a `projectId` field. Adding a header without schema changes means the
project scope is advisory only — enforced only in application code that may not exist yet.

**Risk 3: Mixed Identity Domains**

A single `req.user` object currently represents both authentication and identity. Adding a Project
identity would require either extending `req.user` (dangerous — every existing service would
unwittingly see Project fields as if they were Persona User fields) or adding a parallel
`req.projectContext` (requires touching every route that uses `req.user.id`).

**Risk 4: Thread/Memory Leaks**

Thread and memory namespaces use MongoDB ObjectIDs. An external user won't have one. An
unsanitized `externalUserId` used as a namespace key could collide with MongoDB User IDs or
between different Projects.

**Risk 5: Provider Credentials**

Providers are per-user (owned by `ownerId`). A Project-based agent needs provider credentials,
but the current model has no "shared provider" or "system provider" concept. If a Project Admin
uses their personal API key for a Project agent, that key leaks to all users of that agent
(decrypted at runtime via `encryption.decrypt()` in `agentFactory._buildLLM()`).

### 11.2 Design Warnings from Current Code

1. **`req.user` is both identity and authorization.** Adding project context requires careful
   separation — every current service uses `req.user.id` as both "who you are" and "what you
   own."

2. **No authz framework.** There is no RBAC, no policy engine, no permission check — just
   `ownerId === userId`. Adding even two roles (Project Admin, Runtime User) requires a
   framework, not inline comparisons.

3. **No audit trail for mutations.** There's no record of who changed what. The `adminMiddleware`
   endpoints log the action but standard user mutations don't.

4. **Cascade delete is all-or-nothing.** `userService.deleteUser()` assumes one user owns all
   their resources. A Project admin's "delete agent" action must not cascade to the agent
   creator's user account.

5. **External users have no Clerk ID.** The entire provisioning system (`authService.syncUser`,
   `webhookService.createUser`) presupposes a Clerk user. External users authenticated by host
   products need a completely separate provisioning path.

---

## 12. Requirements §29 Invariant Assessment

### Invariant 1: Project resource must never become visible in Persona Marketplace

| Status | Notes |
|--------|-------|
| **NOT CURRENTLY APPLICABLE** | No Project concept exists today. Persona Marketplace only shows Persona agents with `visibility: 'public'` and no `projectId` field. Currently satisfied by absence of the feature. |

**Future risk:** HIGH. The current `_buildSearchFilter()` has no project filter. If a Project
agent is created with `visibility: 'public'` but no `projectId` guard, it would appear in Persona
Marketplace immediately.

### Invariant 2: A public agent is public only within its scope

| Status | Notes |
|--------|-------|
| **NOT CURRENTLY APPLICABLE** | There is one scope (Persona). Public means Persona-public. |

**Future risk:** HIGH. `visibility` is a global field with no scope context.

### Invariant 3: Project A must not access Project B's resources

| Status | Notes |
|--------|-------|
| **NOT CURRENTLY APPLICABLE** | Single-tenant. All resources belong to Persona users. |

**Future risk:** EXTREME. Zero tenant isolation exists at any layer.

### Invariant 4: `externalUserId` is unique only inside a Project

| Status | Notes |
|--------|-------|
| **CURRENTLY RELEVANT AND SATISFIED** | Clerk IDs (`user_2abc...`) are globally unique. MongoDB ObjectIDs are globally unique. |

**Future risk:** HIGH. If external users are stored with their host-product IDs, collision
between Projects is guaranteed (e.g., `userId: "rahul_123"` in both Beyond Campus and Coursify).

### Invariant 5: Runtime user state must be isolated between users sharing an agent

| Status | Notes |
|--------|-------|
| **CURRENTLY RELEVANT AND SATISFIED** | This works today via memory namespaces: `['users', userId, 'agents', agentId]`. Threads are also per-user. |

**Future risk:** MODERATE. The namespace `['users', ...]` assumes MongoDB ObjectID as userId.
External users need a different namespace prefix (e.g., `['projects', projectId, 'users', externalUserId, ...]`).

### Invariant 6: Agent ownership does not imply ownership of another user's runtime state

| Status | Notes |
|--------|-------|
| **CURRENTLY RELEVANT AND SATISFIED** | Memory, threads, and files are scoped by runtime userId, not agent ownerId. `canUserExecuteAgent()` enforces execution, not state access. |

### Invariant 7: Project Admin authority must not be represented as user impersonation

| Status | Notes |
|--------|-------|
| **NOT CURRENTLY APPLICABLE** | No Project Admin exists. The only admin is Persona platform admin (`role: 'admin'`), which has full access via separate routes (`/api/v1/admin/*`). |

**Future risk:** HIGH. Current ownership checks are strict `ownerId === userId`. Adding "Project
Admin can moderate" requires a new kind of authorization (role-per-resource-context), not just
an equality check.

### Invariant 8: Runtime-user MCP credentials must never be shared between users

| Status | Notes |
|--------|-------|
| **CURRENTLY RELEVANT AND SATISFIED** | `McpUserConnection` model uses compound key `(mcpId, userId)`. Each user's OAuth tokens are stored separately and decrypted per-request. |

### Invariant 9: Project credentials must never allow accidental access to another Project

| Status | Notes |
|--------|-------|
| **NOT CURRENTLY APPLICABLE** | No Project credentials exist. |

**Future risk:** EXTREME. First-ever design of Project credentials must enforce isolation. No
existing pattern to build on (except MCP state signing for integrity).

### Invariant 10: Existing Persona resources must not automatically leak into Developer Projects

| Status | Notes |
|--------|-------|
| **CURRENTLY RELEVANT AND SATISFIED** | No Developer Projects exist. Today there is nowhere to leak to. |

**Future risk:** HIGH. Any search endpoint without a project filter (`_buildSearchFilter()`, skill
search, knowledge search) would include Persona resources unless explicitly excluded.

### Invariant 11: Developer Project resources must not automatically leak into Persona

| Status | Notes |
|--------|-------|
| **NOT CURRENTLY APPLICABLE** | Mirror of invariant 10. |

### Invariant 12: Must never trust a bare, unauthenticated user-id header

| Status | Notes |
|--------|-------|
| **CURRENTLY RELEVANT AND PARTIAL** | The `authMiddleware` and `optionalAuthMiddleware` never trust bare user IDs — they derive identity from Clerk JWTs. However, there is no enforcement that prevents a route from reading `req.body.userId` or `req.query.userId` and treating it as authoritative. The AG-UI route derives userId from `req.user._id` (safe), but the `x-agent-id` header is used without verifying the agent belongs to any project (fine today — no projects). |

**Future risk:** EXTREME. Adding `X-External-User-Id` as a header without verifying it against
project credentials is exactly the anti-pattern described in §9 of the requirements. The
current code has zero infrastructure for making this verification.

---

## 13. Existing Security Primitives Worth Preserving

### 13.1 Strong Primitives

1. **`canUserExecuteAgent()`** — The single most important auth primitive. Well-designed, handles
   virtual agents, deleted agents, inactive agents, private agents, and public agents. Should be
   extended (not replaced) for Project-aware authorization.

2. **MCP OAuth state signing** — HMAC-SHA256 with time-limited expiry, timing-safe comparison,
   signed state carries identity without a session. The correct pattern for the Developer
   Platform's "asserted identity" mechanism.

3. **AES-256-GCM field-level encryption** — `encryption.js` with key rotation support (versioned
   tokens, multiple key IDs, AAD binding). Used for provider API keys and MCP OAuth tokens. The
   same mechanism (or an extended version) should encrypt Project API keys.

4. **Defense-in-depth in agent execution** — Both the AG-UI controller AND the AgentFactory check
   `canUserExecuteAgent()`. This two-layer pattern should be preserved for Project-scoped
   authorization.

5. **Optional auth pattern** — `optionalAuthMiddleware` enables public agent viewing while still
   providing a better experience for authenticated users. Valuable for Developer Platform's
   "public within project" model.

6. **Rate limiting by user identity** — The rate limiter uses `req.user._id` when available,
   falling back to IP. Concurrency limiting per-user prevents resource exhaustion.

### 13.2 Weak Primitives to Replace

1. **Inline `ownerId.toString() === userId.toString()`** — Scattered across 6+ services. Must
   be centralized into an authorization service.

2. **No authz framework** — Even a simple role/permission matrix for Project Admin vs Runtime User
   would be transformative.

3. **All-or-nothing cascade delete** — Must become scoped by resource type and project.

4. **Dual ID system** — `clerkId` and MongoDB `_id` both serve as user identifiers in different
   contexts. The Developer Platform must not add a third (external userId) without a clear
   mapping strategy.

---

## 14. Architecture Questions Raised

### 14.1 Identity Mapping

- How will external users be represented in MongoDB? A new collection?
  `project_external_users`? An extension of the `users` collection with nullable `clerkId`?
- Will external users get MongoDB ObjectIDs, or will they be identified purely by
  `(projectId, externalUserId)`?
- If they get ObjectIDs, how do we prevent collision with Persona User ObjectIDs? Should there
  be a `principalType` discriminator field?

### 14.2 Project Identity on `req`

- Should project context live on `req.project` (parallel to `req.user`)?
- Should `req.user` be extended with optional project fields? (Dangerous — existing code reads
  `req.user.id` assuming it's a Persona user ID.)
- Should there be a middleware that checks project credentials and sets `req.projectContext`?

### 14.3 Authorization Service

- Should there be a single `authorizationService.authorize(resource, principal, action)`?
- How do we model "Project Admin can moderate any agent in the project" vs "Agent owner can
  edit their own agent"?
- Should this be a policy engine (e.g., CASL, custom RBAC) or just expanded service logic?

### 14.4 Data Model Migration

- Do we add `projectId` to every resource collection? (Migration cost: high)
- Do we create separate collections for Project resources? (Operational cost: higher)
- Can existing Agent, Skill, Knowledge, MCP, etc. collections represent both Persona-owned and
  Project-owned resources via a nullable `projectId`?

### 14.5 Project Credentials

- What format? (e.g., `sk_persona_abc123...`)
- Storage: In the Project document? Encrypted with the same AES-256-GCM?
- Verification: Custom middleware that decrypts the key and checks against the DB?
- How does rotation work? Multiple active keys? Key IDs in the token prefix?

### 14.6 External User Assertion

- How does a Project backend prove it controls a given `externalUserId`?
- Signed token (like MCP OAuth state) that the Project backend generates?
- Short-lived JWT signed by the Project's API key?
- Does the Persona backend call back to the Project backend to verify?

---

## 15. Files Inspected / Evidence

### Backend Auth & Identity

| File | Purpose |
|------|---------|
| `agent-backend/src/modules/auth/auth.middleware.js` | Required auth middleware — Clerk session → `req.user` |
| `agent-backend/src/modules/auth/optional-auth.middleware.js` | Optional auth — sets `req.user` if session exists |
| `agent-backend/src/modules/auth/auth.service.js` | User sync from Clerk — create/find local user |
| `agent-backend/src/modules/auth/index.js` | Barrel exports for auth module |
| `agent-backend/src/modules/users/user.model.js` | User Mongoose schema — clerkId, role, etc. |
| `agent-backend/src/modules/users/user.repository.js` | User DB operations — findByClerkId, findByEmail |
| `agent-backend/src/modules/users/user.service.js` | Cascade delete — threads, agents, skills, etc. |
| `agent-backend/src/modules/users/admin.middleware.js` | Admin role check |
| `agent-backend/src/modules/users/profile.controller.js` | Profile CRUD — uses `req.user.id` |
| `agent-backend/src/modules/users/admin.controller.js` | Admin user list/delete |
| `agent-backend/src/modules/users/admin.routes.js` | Admin route definitions |
| `agent-backend/src/modules/webhooks/webhook.service.js` | Clerk user lifecycle sync |
| `agent-backend/src/modules/webhooks/webhook.controller.js` | Svix webhook verification |
| `agent-backend/src/modules/webhooks/webhook.routes.js` | No-auth webhook route |

### Backend Authorization

| File | Purpose |
|------|---------|
| `agent-backend/src/modules/agents/agent.service.js` | `canUserExecuteAgent()`, `_formatSafe()`, `_buildSearchFilter()` |
| `agent-backend/src/modules/agents/agent.controller.js` | Agent CRUD — uses `req.user.id` |
| `agent-backend/src/modules/agents/agent.routes.js` | Route auth — optional for public, required for mutations |
| `agent-backend/src/modules/agents/agent.model.js` | Agent schema — ownerId, visibility, isActive |
| `agent-backend/src/modules/agents/agent.repository.js` | DB operations |
| `agent-backend/src/modules/agents/agent.factory.js` | Defense-in-depth auth check |
| `agent-backend/src/modules/agui/agui.controller.js` | AG-UI execution gate — canUserExecuteAgent |
| `agent-backend/src/modules/agui/agui.routes.js` | AG-UI route + thread ownership check |
| `agent-backend/src/modules/agui/agui.service.js` | Agent execution stream |
| `agent-backend/src/modules/mcp/mcp.service.js` | MCP ownership checks, OAuth handling |
| `agent-backend/src/modules/mcp/mcp.controller.js` | MCP CRUD — uses `req.user.id` |
| `agent-backend/src/modules/mcp/mcp.routes.js` | Route auth — OAuth callbacks are auth-free |
| `agent-backend/src/modules/mcp/mcp.model.js` | MCP schema — ownerId, authType, authMode |
| `agent-backend/src/modules/mcp/oauth-state.js` | Signed OAuth state tokens |
| `agent-backend/src/modules/mcp/mcp-oauth-client.js` | OAuth client — PKCE, DCR |
| `agent-backend/src/modules/mcp/mcp-token.service.js` | Token resolution and refresh |
| `agent-backend/src/modules/mcp/mcp-user-connection.model.js` | Per-user MCP tokens |
| `agent-backend/src/modules/skills/skill.service.js` | Skill ownership + visibility checks |
| `agent-backend/src/modules/skills/skill.routes.js` | Route auth |
| `agent-backend/src/modules/knowledge/knowledge.controller.js` | Knowledge ownership via error messages |
| `agent-backend/src/modules/providers/provider.routes.js` | Route auth — all require auth |
| `agent-backend/src/modules/threads/thread.repository.js` | Thread ownership — scoped by userId |
| `agent-backend/src/modules/threads/thread.model.js` | Thread schema — userId, agentId |
| `agent-backend/src/modules/threads/thread.routes.js` | Route auth |
| `agent-backend/src/modules/memory/memory.controller.js` | Memory CRUD — uses `req.user.id` |
| `agent-backend/src/modules/memory/memory-files-store.js` | Memory namespace isolation |
| `agent-backend/src/modules/tools/index.js` | Tool resolution — passes userId to MCP/knowledge tools |
| `agent-backend/src/modules/rateLimiter/rateLimiter.middleware.js` | Rate limiting by userId/IP |
| `agent-backend/src/middlewares/errorHandler.js` | Global error handler |

### Backend Infrastructure

| File | Purpose |
|------|---------|
| `agent-backend/src/index.js` | Express setup, middleware registration order |
| `agent-backend/src/config/index.js` | Environment config — JWT, encryption keys |
| `agent-backend/src/utils/encryption.js` | AES-256-GCM with key rotation |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/middleware.js` | Clerk route protection |
| `frontend/src/app/layout.js` | ClerkProvider + AxiosTokenProvider |
| `frontend/src/components/auth/axios-token-provider.jsx` | Token fetcher injection |
| `frontend/src/components/auth-buttons.jsx` | Auth UI |
| `frontend/src/hooks/use-profile.js` | Client-side profile hook |
| `frontend/src/lib/api/core.js` | Axios instance with Bearer token interceptor |
| `frontend/src/lib/api/agents.js` | Agent API calls |
| `frontend/src/lib/api/threads.js` | Thread API calls |

---

## Answers to Specific Questions

### Q1: What proves a request belongs to a Persona user today?

A valid Clerk session token presented as `Authorization: Bearer <token>`. The token is issued by
Clerk after the user signs in via Clerk's UI. The frontend axios interceptor attaches it
automatically via `window.Clerk.session.getToken()` or the React `useAuth().getToken()` hook.

### Q2: Where does backend identity come from?

From `getAuth(req)` (provided by `@clerk/express`), which parses the Clerk JWT from the
Authorization header. The `userId` claim in that JWT is the Clerk user ID, which is then mapped
to a local MongoDB User document via `authService.syncUser(clerkId)`.

### Q3: Can the client choose/override userId?

**No.** The userId is derived from the Clerk JWT. The client cannot forge it. The JWT is
cryptographically signed by Clerk. However, there is no CURRENT enforcement preventing a
malicious client from passing `ownerId` in a request body (e.g., `POST /agents/search` with
`ownerId: <someone-else>`), but the service layer (`_buildSearchFilter()`) enforces visibility
rules even in that case.

### Q4-Q6: Route/body user IDs vs middleware-derived

Endpoints that accept `userId`/`ownerId` in the request body (NOT from auth middleware):
- `POST /agents/search` — accepts `ownerId` filter; service layer enforces visibility
- `POST /agents/count` — same pattern
- Various body fields that use authenticated identity: `GET /profile`, `PATCH /profile`,
  `DELETE /profile` — all use `req.user.id` exclusively

Endpoints deriving from auth middleware only:
- All profile routes
- All provider routes
- All thread routes
- All memory routes
- AG-UI route (extracts from `req.user._id` via authMiddleware)
- All admin routes
- All MCP routes (except OAuth callbacks which use signed state)

### Q7: Where are ownership checks centralized?

They are **not** centralized. Each module implements its own.

### Q8: Authorization per layer

See **Section 5.1** above for the full breakdown.

### Q9: Existing concepts

- **API keys**: ❌ No
- **Service accounts**: ❌ No
- **Organizations**: ❌ No
- **Workspaces**: ❌ No
- **Tenants**: ❌ No
- **Applications/Projects**: ❌ No

The closest pattern is `role: 'admin'`, which grants Persona-wide platform access, not
scoped administrative authority.

### Q10: Danger of adding `X-Project-Key` + `X-External-User-Id` without architecture

Adding these headers without architecture is dangerous because:

1. **No middleware validates them.** Any route could read these headers, but none currently
   do, which means they'd be silently ignored OR silently trusted by new code that doesn't
   verify Project ownership.

2. **No project scope in queries.** Every repository method that filters by `ownerId` or
   `userId` would need a `projectId` filter too, or Project A's resources would leak into
   Project B's results.

3. **Mixed identity domains.** External users won't have MongoDB ObjectIDs. If the system
   conflates `X-External-User-Id` (a string) with `req.user._id` (an ObjectId), crashes and
   leaks are guaranteed.

4. **Thread/memory namespace collisions.** Memory uses `['users', userId, 'agents', agentId]`.
   If `userId` is an external-user string like `"rahul_123"`, it would collide between Projects.

5. **No trust model for the Project Key.** If anyone with a valid Project Key can assert any
   external user ID, there's no mechanism for the Project backend to prove it controls that
   user ID. A leaked Project Key would compromise all users in that Project.

### Q11: Code assuming `authenticated identity == resource owner`

See **Section 10.1** above. Essentially every ownership check in the system.

### Q12: Code assuming `authenticated identity == runtime user`

- AG-UI route: `const userId = req.user._id`
- `agentFactory.buildAgent(agentId, userId, checkpointer)` — passes `userId` as runtime user
- Memory namespaces: `userMemoryNamespace(userId)` and `agentMemoryNamespace(userId, agentId)`
- Thread creation: `thread.userId = userId`

### Q13: Code assuming `Persona user == only possible principal`

See **Section 10.3** above. The entire data model, provisioning pipeline, and architectural
assumptions presume Persona users with Clerk IDs.

### Q14: Authorization checks protecting Project-like resources today

**None.** There are no Project-like resources. The closest comparison:

- **System agents**: ❌ Don't exist. The only non-user-owned agent is the virtual Architect
  agent (`_id: '000000000000000000000000'`), which is a special-case singleton.
- **Project-owned skills/knowledge/MCPs**: ❌ Don't exist.
- **Shared resources**: ❌ Don't exist. Every resource has one owner.

### Q15: Strongest current security primitives

See **Section 13.1** above.

---

## Key Findings

### Biggest Auth Coupling

The **ownership check pattern** (`ownerId.toString() === userId.toString()`) is the tightest
coupling in the auth system. It appears in 6+ services, assumes single-tenancy, and conflates
ownership with runtime identity. Adding Project Admin authority or runtime-user identity will
require replacing every instance of this pattern.

### Biggest Security Risk

**Zero tenant isolation.** There is no resource-container concept at any layer. A bug in a
single query could expose all agents, all threads, all MCP credentials, or all provider API
keys to any authenticated user.

### Most Reusable Security Primitives

1. `canUserExecuteAgent()` — extendable authorization gate
2. MCP OAuth state signing (HMAC-SHA256, time-limited, timing-safe)
3. AES-256-GCM encryption with key rotation
4. Optional + required auth middleware pattern
5. Memory namespace isolation per user per agent

### Unknowns

- How does the knowledge module implement ownership? (Not fully inspected, but controller error
  messages indicate ownership checks exist.)
- Is there any `isPublic` pattern on knowledge bases? (Controller mentions "public" in error
  messages but actual field name not verified.)
- Are there any undocumented public endpoints that leak user data? (The `/dashboard/agents/(.*)`
  route in the Clerk middleware allows unauthenticated access — the frontend handles this via
  layout but the underlying API calls still go through authMiddleware.)
- Does the upload module enforce any ownership? (Not inspected.)

### Files Changed

This document only. No code was modified.
