# Resource & MCP Infrastructure Audit

> **Status:** Research-only. Do NOT implement based on this document.
> **Purpose:** Understand current resource ownership, authentication, isolation, and runtime resolution for Skills, Knowledge, MCPs, and Providers before designing Project scoping.
> **Date:** 2026-07-29
> **Scope:** `agent-backend/src/modules/skills/`, `knowledge/`, `mcp/`, `providers/`, `agents/agent.factory.js`, `agents/builder.tools.js`

---

## 1. Executive Summary

Persona's resource infrastructure is **cleanly layered** with consistent ownership patterns across all four resource types (Skills, Knowledge, MCP, Providers). Every resource is owned by a Persona User via `ownerId: ObjectId → ref: User`. The MCP module already distinguishes **creator-auth** (`authMode: 'owner'`) from **runtime-user-auth** (`authMode: 'user'`) at the schema level, making it the most future-proof module for the Developer Platform.

Key findings:

1. **Skills, Knowledge, MCPs, and Providers all follow the exact same ownership pattern** (`ownerId: ObjectId → ref: User`). This consistency makes migration auditable.

2. **MCP already has a `authMode` field** (`'owner' | 'user'`) that directly maps to the Developer Platform's requirement for MCP creator-auth vs runtime-user-auth.

3. **OAuth token isolation already works** — owner tokens are stored on the MCP document itself (`mcp.oauth.ownerToken`), while user tokens are stored in a separate `mcpuserconnections` collection keyed by `(mcpId, userId)`. This is a strong foundation.

4. **Agents reference resources purely by ID** (array of ObjectIds) with **no cross-ownership validation** at attachment time. An agent can theoretically reference any MCP, Skill, or KnowledgeBase regardless of who owns it (though runtime resolution may fail).

5. **Agent graph compilation** (`agent.factory.js`) is where all resources come together at runtime — it resolves the provider, loads skills, connects MCPs with per-user tokens, and binds knowledge tools. This is the single integration point.

6. **The Architect agent** (a virtual meta-agent for building other agents) uses special logic that bypasses normal ownership and authorization. It must be handled as a special case in any Project-scoping effort.

7. **Three modules have global unique indexes** that conflict with Project scoping: Skill `(ownerId, name)`, MCP `(ownerId, name)`, and KnowledgeBase `qdrantCollectionName`.

---

## 2. Skills Current Model

### 2.1 Schema

```javascript
// skill.model.js
{
  ownerId:     ObjectId → User (required, indexed),
  name:        String (2-64 chars, lowercase-hyphen, required),
  description: String (max 1024, required),
  instructions: String (max 50000, required),  // The body of SKILL.md
  files:       [{ path, content, mimeType, createdAt, updatedAt }],
  isPublic:    Boolean (default false, indexed),
}
```

**Evidence:** `agent-backend/src/modules/skills/skill.model.js`

### 2.2 Indexes

- `{ ownerId: 1, name: 1 }` — unique per user (prevents duplicate skill names per user)
- `isPublic: 1` — used for marketplace queries

**Evidence:** `agent-backend/src/modules/skills/skill.model.js` (lines 47-49)

### 2.3 Ownership and Authorization

| Operation | Authorization | Mechanism |
|-----------|--------------|-----------|
| Create | `ownerId = userId` | Set in controller (`skill.controller.js:12`) |
| Read (own) | `findByOwner(userId)` | Repository scope (`skill.repository.js:23`) |
| Read (public) | `isPublic: true` | Repository filter (`skill.repository.js:34`) |
| Read (by ID) | Owner OR `isPublic` | Service check (`skill.service.js:17-20`) |
| Update | `findOneAndUpdate({_id, ownerId})` | Repository enforces ownership (`skill.repository.js:65-66`) |
| Delete | `findOneAndDelete({_id, ownerId})` | Repository enforces ownership (`skill.repository.js:72`) |

### 2.4 Public Skill Marketplace

Public skills are discovered via:
```javascript
const filter = { ...query, isPublic: true };
// No scope boundary — returns ALL public skills globally
```

**Evidence:** `skill.repository.js` (`findPublicSkills`, lines 29-48)

**Critical finding:** `isPublic: true` means Persona-global. There is no `projectId` or scope filter.

### 2.5 Skill Authoring (Agent Architect Integration)

Skills can be authored through the Agent Architect via the `/skill-library/` virtual filesystem route:

- `SkillLibraryStore` is a `BaseStore` implementation backed by the `Skill` collection
- Namespace: `['users', userId, 'skill-library']`
- Files: `/<skill-name>/SKILL.md` + supporting files (references/, scripts/, assets/)
- SKILL.md frontmatter (YAML) is parsed into `name`, `description`, and the body becomes `instructions`
- Supporting files go into `skill.files[]` array

**Evidence:** `agent-backend/src/modules/skills/skillLibraryStore.js`

### 2.6 Agent-Skill Binding

Agents reference skills as an array of ObjectIds:
```javascript
// agent.model.js
skills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }]
```

At runtime, the `AgentSkillsStore` resolves these references:
```javascript
// agent.factory.js
const backendRoutes = {
  '/skills/': readonlyBackend(
    new StoreBackend({
      store: agentSkillsStore,
      namespace: ['agents', agentIdStr, 'enabled'],
    })
  ),
};
```

**Evidence:** `agent.factory.js` (lines 230-235), `agent-skills-store.js` (reads skills from the loaded `agent.populate('skills')` data)

---

## 3. Knowledge Current Model

### 3.1 Schema

```javascript
// knowledge-base.model.js
{
  name:         String (max 200, required),
  description:  String (max 1000, default ''),
  ownerId:      ObjectId → User (required, indexed),
  isPublic:     Boolean (default false),
  documentCount: Number,
  chunkCount:   Number,
  qdrantCollectionName: String (required, unique),  // Vector store reference
  documents:    [{ fileName, fileSize, mimeType, chunkCount, uploadedAt }],
  embeddingModel: String (default 'text-embedding-3-small'),
  providerId:   ObjectId → Provider (required: false),
  chunkSize:    Number (default 800),
  chunkOverlap: Number (default 100),
  topK:         Number (default 5),
}
```

```javascript
// knowledge-chunk.model.js
{
  kbId:          ObjectId → KnowledgeBase (required, indexed),
  text:          String (required),
  qdrantPointId: String,  // Qdrant vector point ID
  metadata:      { sourceName, chunkIndex },
}
```

**Evidence:** `agent-backend/src/modules/knowledge/knowledge-base.model.js`, `knowledge-chunk.model.js`

### 3.2 Indexes

- `qdrantCollectionName` — **globally unique** (collision risk across projects)
- `kbId` — for chunk lookups
- `kbId + metadata.sourceName` — for document-level queries

### 3.3 Ownership and Authorization

| Operation | Authorization | Mechanism |
|-----------|--------------|-----------|
| Create | Set `ownerId = userId` | `knowledge.service.js` (line 162) |
| List (own) | `findKbsByUser(ownerId)` | Repository scope |
| Read (by ID) | Owner OR `isPublic` | Service check (`knowledge.service.js:185`) |
| Update | `ownerId.toString() !== userId.toString()` | Service check (`knowledge.service.js:194`) |
| Delete | Same owner check | `knowledge.service.js:209` |
| Upload | Same owner check | `knowledge.service.js:229` |
| Search (runtime) | No auth check (called within agent execution) | `knowledge.service.js:283` |

### 3.4 Qdrant Integration

Knowledge bases use Qdrant vector database for embeddings. Each KB gets its own Qdrant collection:

```javascript
// Collection name format: kb_<mongoId>_<randomHex>
// e.g., 'kb_507f1f77bcf86cd799439011_a1b2c3d4'
```

**Evidence:** `knowledge.service.js` (`_generateCollectionName`, line 90)

**Critical finding:** Qdrant collection names are globally unique. They are random enough to avoid collisions in practice, but there is no scope boundary. A Project-scoped KB would need either prefixed collection names or separate Qdrant instances.

### 3.5 Agent-Knowledge Binding

Agents reference KnowledgeBases as an array of ObjectIds:
```javascript
// agent.model.js
knowledgeBases: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeBase' }]
```

At runtime, `resolveKnowledgeBaseTools` in `knowledge.tools.js` checks:
```javascript
const allowedKbs = kbs.filter(
  (kb) => kb.ownerId.toString() === userId?.toString() || kb.isPublic
);
```

**Evidence:** `agent-backend/src/modules/knowledge/knowledge.tools.js` (lines 25-28)

**Critical finding:** This filter allows access to ANY public KnowledgeBase, regardless of project scope. A user can potentially attach a public KB from another user to their agent.

---

## 4. MCP Current Model

### 4.1 Schema

```javascript
// mcp.model.js
{
  ownerId:          ObjectId → User (required, indexed),
  name:             String (2-100 chars, required),
  description:      String (max 500),
  transport:        String (enum: 'http' | 'sse', required),
  url:              String (required),
  authType:         String (enum: 'none' | 'oauth' | 'apiKey', default 'none'),
  authMode:         String (enum: 'owner' | 'user', default 'owner'),
  oauth:            {   // Embedded sub-document
    clientId,
    clientSecretEncrypted,  // AES-256-GCM encrypted
    authorizationEndpoint,
    tokenEndpoint,
    scopes,
    dynamicallyRegistered: Boolean,
    tokenEndpointAuthMethod,
    ownerToken: {           // Owner's OAuth credentials (embedded)
      accessTokenEncrypted,
      refreshTokenEncrypted,
      expiresAt,
    },
  },
  apiKeyEncrypted:  String,  // For authType: 'apiKey' (never per-user)
  isEnabled:        Boolean (default true),
  tools:            [{ name, description }],
  resources:        [{ uri, name, description, mimeType }],
  resourceTemplates: [{ uriTemplate, name, description, mimeType, toolName }],
  lastTestedAt:     Date,
}
```

**Evidence:** `agent-backend/src/modules/mcp/mcp.model.js`

### 4.2 MCP User Connection Schema

```javascript
// mcp-user-connection.model.js
{
  mcpId:                ObjectId → Mcp (required, indexed),
  userId:               ObjectId → User (required, indexed),
  accessTokenEncrypted: String (required),
  refreshTokenEncrypted: String,
  expiresAt:            Date,
}
```

**Evidence:** `agent-backend/src/modules/mcp/mcp-user-connection.model.js`

### 4.3 Indexes

- `{ ownerId: 1, name: 1 }` — unique per user (prevents duplicate MCP names per user)
- `{ mcpId: 1, userId: 1 }` — unique (one connection per user per MCP, in the user connections collection)

### 4.4 Ownership and Authorization

| Operation | Authorization | Mechanism |
|-----------|--------------|-----------|
| Create | `ownerId = userId` | Set in service (`mcp.service.js:83`) |
| Read (own) | `findByOwner(userId)` | Repository scope |
| Read (by ID) | `ownerId.toString() !== userId.toString()` | Service check (`mcp.service.js:80`) |
| Update | `findOneAndUpdate({_id, ownerId})` | Repository enforces ownership |
| Delete | `findOneAndDelete({_id, ownerId})` | Repository enforces ownership |

**Critical finding:** MCP ownership is **purely owner-scoped**. There is no `isPublic` concept. An MCP is visible **only** to its owner. This is the strictest ownership model of all resource types.

---

## 5. MCP Authentication Modes

### 5.1 The `authMode` Field

The MCP schema already distinguishes:

| Mode | Value | Meaning | Token Storage |
|------|-------|---------|---------------|
| Creator/Owner auth | `'owner'` | The MCP creator authenticates once; all agent users share that connection | `mcp.oauth.ownerToken` (embedded in MCP document) |
| Runtime user auth | `'user'` | Each agent user must authenticate individually | `mcpuserconnections` collection, keyed by `(mcpId, userId)` |

**Evidence:** `mcp.model.js` (lines 73-78)

### 5.2 Owner Auth Flow

```
MCP owner clicks "Connect" on /studio/mcps/:id
  → GET /api/v1/mcps/:id/oauth/owner/authorize
    → verify ownership (mcp.ownerId === userId)
    → generate PKCE pair
    → sign OAuth state { mcpId, userId, mode: 'owner', codeVerifier }
    → return authorization URL (redirect to external provider)
    
User's browser → external OAuth provider → callback:
  → GET /api/v1/mcps/oauth/owner/callback (no auth middleware!)
    → verify signed state
    → exchange code for tokens
    → store tokens in mcp.oauth.ownerToken (embedded in MCP doc)
    → redirect to /dashboard/connectors/mcps?mcpId=xxx&connected=owner
```

**Evidence:** `mcp.service.js` (`getOwnerAuthorizationUrl`, lines 212-229; `handleOwnerCallback`, lines 231-265)

### 5.3 Runtime User Auth Flow

```
Different user of the same MCP clicks "Connect":
  → GET /api/v1/mcps/:id/oauth/user/authorize
    → no ownership check! (any authenticated user can connect)
    → generate PKCE pair
    → sign OAuth state { mcpId, userId, mode: 'user', codeVerifier, returnTo }
    → return authorization URL

User's browser → external OAuth provider → callback:
  → GET /api/v1/mcps/oauth/user/callback (no auth middleware!)
    → verify signed state
    → exchange code for tokens
    → store tokens in mcpuserconnections (separate collection, keyed by mcpId+userId)
    → redirect to returnTo URL
```

**Evidence:** `mcp.service.js` (`getUserAuthorizationUrl`, lines 267-285; `handleUserCallback`, lines 287-317)

### 5.4 Token Resolution at Runtime

During agent execution (`mcp.tools.js`), the `resolveMcpTools` function resolves tokens:

```javascript
if (mcp.authType === 'oauth') {
  token = mcp.authMode === 'owner'
    ? await mcpTokenService.getOwnerAccessToken(mcp)        // From mcp.oauth.ownerToken
    : await mcpTokenService.getUserAccessToken(mcp, userId); // From mcpuserconnections
}
```

**Evidence:** `mcp.tools.js` (lines 112-123), `mcp-token.service.js`

---

## 6. OAuth/Credential Isolation

### 6.1 Current Isolation Model

| Auth Mode | Where Stored | Isolated By | Key |
|-----------|-------------|-------------|-----|
| Owner | `mcp.oauth.ownerToken` (embedded) | MCP document itself | Only one set of tokens per MCP |
| User | `mcpuserconnections` collection | `(mcpId, userId)` compound key | Separate per user per MCP |
| API Key | `mcp.apiKeyEncrypted` (embedded) | MCP document itself | Always shared (authMode doesn't apply) |

**Evidence:** `mcp-user-connection.model.js` (unique index on `{ mcpId, userId }`, line 28)

### 6.2 Can Two Users Sharing the Same Agent Safely Have Different MCP Credentials?

**Yes, for `authMode: 'user'`.** The credential isolation already works:

- Each user authenticates with the MCP server independently
- Their tokens are stored in separate `mcpuserconnections` documents
- At runtime, each user's tokens are resolved based on `userId`

**No, for `authMode: 'owner'`.** All users share the owner's token. This is by design.

**Evidence:** `mcp-token.service.js` (`getUserAccessToken` uses `mcpUserConnectionRepository.findByMcpAndUser(mcp._id, userId)`, line 65)

### 6.3 Token Refresh

Both owner and user tokens support automatic refresh via `refreshAccessToken` in `mcp-oauth-client.js`. Tokens are refreshed when they are within 60 seconds of expiry (`TOKEN_REFRESH_SKEW_MS = 60 * 1000`).

**Evidence:** `mcp-token.service.js` (lines 12, 29, 81)

### 6.4 OAuth State Token

The OAuth callback recovers identity purely from the signed `state` parameter (HMAC-SHA256):

```javascript
// signOAuthState encodes:
{
  mcpId,         // The MCP being connected
  userId,        // The Persona User ID (ObjectId string)
  mode,          // 'owner' | 'user'
  codeVerifier,  // PKCE code verifier
  exp,           // Expiry (10 minute default TTL)
  returnTo,      // (user mode only) redirect destination
}
```

**Evidence:** `agent-backend/src/modules/mcp/oauth-state.js`

### 6.5 Callback Redirect Destination

- **Owner mode:** Always redirects to `/dashboard/connectors/mcps?mcpId=xxx&connected=owner`
- **User mode:** Redirects to the `returnTo` URL passed in the authorization request, or falls back to `config.websiteUrl`

**Evidence:** `mcp.service.js` (lines 262-263, 312-313)

**Critical finding for Developer Platform:** The owner callback is hardcoded to redirect to `/dashboard/connectors/...`. This is a Persona-specific path. A Project-scoped MCP would need a different redirect.

---

## 7. Provider Current Model

### 7.1 Schema

```javascript
// provider.model.js
{
  ownerId:          ObjectId → User (required, indexed),
  label:            String (1-100 chars, required),
  baseURL:          String (required),
  apiKeyEncrypted:  String (required),  // AES-256-GCM encrypted
  defaultModel:     String (required),
  isDefault:        Boolean (default false),
}
```

**Evidence:** `agent-backend/src/modules/providers/provider.model.js`

### 7.2 Ownership and Authorization

| Operation | Authorization | Mechanism |
|-----------|--------------|-----------|
| Create | `ownerId = userId` | Set in service (`provider.service.js:57`) |
| List (own) | `findByUser(ownerId)` | Repository scope |
| Read/Update | `ownerId.toString() !== userId.toString()` | Service check (`provider.service.js:80`) |
| Delete | Same owner check + dependency check | `provider.service.js:101` |
| Default | `clearUserDefaultKeys(userId)` | Per user, sets all user's providers to non-default first |

### 7.3 Provider Deletion Constraint

A provider cannot be deleted if agents still reference it:
```javascript
const dependentCount = await agentRepository.count({ providerId, ownerId: userId });
if (dependentCount > 0) { throw new Error('...'); }
```

**Evidence:** `provider.service.js` (lines 120-129)

**Critical finding:** This dependency check assumes the agent's `ownerId` equals the provider's `ownerId`. If a Project-owned provider were used by external users' agents, this assumption breaks.

### 7.4 Key Encryption

Provider API keys are encrypted with AES-256-GCM via `encryption.js`. The `_ensureLatestEncryption` method supports lazy re-encryption if the encryption key changes.

**Evidence:** `provider.service.js` (lines 13-35)

---

## 8. Agent-to-Resource Relationships

### 8.1 How Agents Reference Resources

```javascript
// agent.model.js
{
  providerId:     ObjectId → Provider (required),    // Single provider
  skills:         [ObjectId → Skill],                // Multiple skills
  mcps:           [ObjectId → Mcp],                  // Multiple MCPs
  knowledgeBases: [ObjectId → KnowledgeBase],        // Multiple KBs
}
```

### 8.2 Runtime Resolution (Agent Factory)

The agent factory (`agent.factory.js`) is the **single integration point** where all resources are resolved at runtime:

1. **Provider:** Fetched via `providerRepository.findById(agent.providerId)`, decrypted, and used to build the LLM
2. **Skills:** Populated via `agent.populate('skills')`, then served through `AgentSkillsStore` via the `/skills/` virtual filesystem
3. **MCPs:** Populated via `agent.populate('mcps')`, then resolved through `resolveMcpTools()` which connects to each MCP server with per-user or owner tokens
4. **Knowledge:** Populated via `agent.populate('knowledgeBases')`, then resolved through `resolveKnowledgeBaseTools()` which creates LangChain tools for each attached KB

**Evidence:** `agent.factory.js` (lines 126-148, populate calls on lines 140-143; calls to `resolveAgentTools` on line 190)

### 8.3 Cross-Resource Ownership Validation

**There is NO cross-ownership validation at agent attachment time.** When an agent's `skills`, `mcps`, or `knowledgeBases` arrays are updated, the system does NOT verify that the referenced resources belong to the same user or are public.

**Evidence:** `agent.service.js` (`updateAgent`, lines 93-101) — it only checks ownership of the agent itself, not the referenced resources.

**Runtime behavior:** During agent execution:
- **MCPs:** `resolveMcpTools` tries to get a token for each MCP; if no token exists (because the user doesn't own the MCP and hasn't connected), the MCP is silently skipped
- **Knowledge:** `resolveKnowledgeBaseTools` filters to `ownerId === userId || isPublic` — non-public KBs from other users are silently excluded
- **Skills:** `AgentSkillsStore` loads whatever skill documents the agent references; if they're populated successfully, they're available

---

## 9. Current Authorization Model

### 9.1 Authorization Patterns

| Pattern | Used In | Example |
|---------|---------|---------|
| `findOneAndUpdate({_id, ownerId})` | Skills, MCP repositories | Repository-level enforcement |
| `ownerId.toString() !== userId.toString()` | Agents, Knowledge, Providers, MCP services | Service-level enforcement |
| `req.user.id` injected at controller | All modules | Controller passes authenticated user |
| `findByOwner(userId)` | All list endpoints | Query scoping |

### 9.2 Are Rules Centralized or Duplicated?

**Duplicated.** Every module implements its own authorization checks. There is no shared authorization middleware between modules:

- **Agents:** Checks in `agent.service.js` (lines 95-110)
- **Skills:** Checks in `skill.service.js` (line 18) + `skill.repository.js` (lines 65-66, 72)
- **Knowledge:** Checks in `knowledge.service.js` (lines 185-229)
- **MCP:** Checks in `mcp.service.js` (line 80) + `mcp.repository.js` (lines 31, 39)
- **Providers:** Checks in `provider.service.js` (lines 80, 101)
- **Threads:** Checks in `thread.controller.js` (lines 34, 57)
- **Admin:** Only through `admin.middleware.js` (role check)

This duplication is manageable in a single-tenant system but would become a maintenance burden in a multi-tenant system. Every authorization check would need to be updated with Project scope.

---

## 10. Global/Public Resource Semantics

### 10.1 Current Public Resource Queries

| Resource | Public Field | Query | Scope |
|----------|-------------|-------|-------|
| Agent | `visibility: 'public'` | `{ visibility: 'public', isActive: true }` | Persona-global |
| Skill | `isPublic: true` | `{ isPublic: true }` | Persona-global |
| KnowledgeBase | `isPublic: true` | `kb.isPublic` (check in code) | Persona-global |
| MCP | None | Never public | Owner-only |

### 10.2 What Public Means Today

- **Agent public:** Discoverable by anyone via the marketplace search endpoint
- **Skill public:** Visible in the skill marketplace, usable by any agent creation tool
- **KnowledgeBase public:** Readable by any user who has its ID

### 10.3 Could Public Resource Queries Accidentally Become Global Across Future Projects?

**Yes.** Every public query has zero scope filtering. If a `projectId` field were added but the queries weren't updated, a user in Project A would see all public agents/skills from Project B and from Persona.

---

## 11. Persona-User Coupling

### 11.1 Where Is Persona User Identity Directly Embedded?

| Module | Field/Reference | Location |
|--------|----------------|----------|
| Skills | `ownerId: ObjectId → User` | Model, all services |
| Knowledge | `ownerId: ObjectId → User` | Model, all services |
| MCP | `ownerId: ObjectId → User` | Model, all services |
| MCP User Conn | `userId: ObjectId → User` | Model, repository |
| Providers | `ownerId: ObjectId → User` | Model, all services |
| Agent Factory | `userId` passed to `resolveAgentTools`, `buildAgent` | Factory entry point |
| OAuth State | `userId` encoded in signed state | `oauth-state.js` |
| OAuth Callback | `userId` recovered from state → used for token storage | `mcp.service.js` |
| Skill Library | Namespace `['users', userId, 'skill-library']` | `skillLibraryStore.js` |
| Memory | Namespace `['users', userId, ...]` | `memory-files-store.js` |
| Architect | `providerRepository.findByUser(userId)` | `agent.factory.js` |

### 11.2 Resources Hard-Coded to Individual Persona Users

**All of them.** Skills, Knowledge, MCPs, Providers — every single resource is hard-coded to a Persona User via `ownerId`.

### 11.3 Resources That Naturally Support Shared/Project Ownership

**MCPs with `authMode: 'owner'`** are the closest concept — the creator authenticates once and all users share the connection. However, the MCP resource itself is still owned by a single Persona User.

**Public Skills/Knowledge** could conceptually be shared, but today their discoverability is Persona-global, not project-scoped.

---

## 12. Compatibility With Project-Owned Resources

### 12.1 Project-Owned Skill

| Requirement | Current State | Compatible? |
|-------------|---------------|-------------|
| Multiple users can reference | Yes (via ID array) | Yes |
| User cannot modify | N/A today (only owner can modify) | Owner model already supports this |
| Project admin creates | N/A today | Need non-Persona owner |
| Scoped within project | No — `isPublic` is Persona-global | Needs scope boundary |

**Gap:** The `ownerId` field currently requires a User ref. A Project-owned skill would need either a different owner type or a `projectId` override.

### 12.2 Project-Owned Knowledge

| Requirement | Current State | Compatible? |
|-------------|---------------|-------------|
| Shared vector store | Each KB has own Qdrant collection | Yes |
| Project admin manages | N/A today | Need non-Persona owner |
| Scoped within project | No — `isPublic` is Persona-global | Needs scope boundary |
| Qdrant isolation | Collection names are unique but not scoped | Needs naming strategy |

**Gap:** Same `ownerId` issue. Also, the `resolveKnowledgeBaseTools` filter `isPublic` check would need a project scope.

### 12.3 Project-Owned MCP

| Requirement | Current State | Compatible? |
|-------------|---------------|-------------|
| Project admin creates MCP | N/A today | Need non-Persona owner |
| Owner mode: all users share auth | Already supported via `authMode: 'owner'` | **Excellent foundation** |
| Multiple agents can reference | Already supported (ID array) | Yes |
| Scoped within project | MCPs are not currently discoverable publicly | Less risky than other resources |

**Gap:** MCP ownership check is strictest of all — `getMcpById` checks `ownerId.toString() === userId.toString()`. A Project MCP would bypass this.

### 12.4 Project Provider

| Requirement | Current State | Compatible? |
|-------------|---------------|-------------|
| Shared API key | N/A today — every user has their own providers | Significant gap |
| Project admin configures | N/A today | Need Project-level provider concept |
| Agent uses project provider | N/A today | Provider is resolved per agent from `agent.providerId` |

**Gap:** Provider is the most Persona-coupled resource. API keys are encrypted per Persona User. The Architect agent already falls back to the user's default provider. Adding a Project-level provider would require a new provider type or a `projectId` field.

---

## 13. Compatibility With User-Owned Resources

### 13.1 User-Owned Skill (within a Project)

| Requirement | Current State | Compatible? |
|-------------|---------------|-------------|
| External user creates skill | N/A — only Persona users | Need external identity mapping |
| Scoped within project | No — Persona-global | Needs `projectId` scope |
| Same creation flow | Partially — validation, storage patterns are reusable | Yes |

### 13.2 User-Owned Knowledge

Same pattern as skills. The storage infrastructure (Qdrant, chunks) is reusable, but ownership and scoping need changes.

### 13.3 User-Owned MCP

| Requirement | Current State | Compatible? |
|-------------|---------------|-------------|
| External user creates MCP | N/A — only Persona users | Need external identity mapping |
| Runtime user auth | Already supported via `authMode: 'user'` | **Excellent foundation** |
| Credential isolation | Already works per user | Yes, per-user tokens map to this pattern |
| OAuth callback | Hardcoded to `/dashboard/` paths | Needs configurability |

### 13.4 User Provider (External User)

| Requirement | Current State | Compatible? |
|-------------|---------------|-------------|
| External user configures LLM | N/A — only Persona users | Significant gap |
| Credential encryption | Works per Persona user | Encryption is key-agnostic |
| Provider resolution for agent | By ID, no cross-ownership validation | Could work with Project-scoped IDs |

---

## 14. Isolation Risk Areas

### 14.1 High Risk

1. **Skill/MCP name uniqueness per user** (`{ ownerId, name }` unique indexes) — If multiple projects/users share a `userId` concept, name uniqueness across projects would break. Need `{ projectId, name }` compound index.

2. **KnowledgeBase Qdrant collection name** — Globally unique. Two KBs from different projects cannot share a collection name. Low collision probability today, but no scope boundary.

3. **Agent-to-resource cross-ownership validation** — Completely absent. An agent can reference any skill/knowledge/MCP by ID. If the system adds project scope but doesn't validate references, an agent in Project A could reference a resource in Project B.

4. **Knowledge tool runtime resolution** — `resolveKnowledgeBaseTools` allows `isPublic` KBs from any user. No project boundary.

5. **OAuth callback redirect** — Owner mode hardcoded to `/dashboard/connectors/mcps?mcpId=xxx&connected=owner`. Breaks outside Persona UI.

### 14.2 Medium Risk

6. **Provider dependency check** — `agentRepository.count({ providerId, ownerId: userId })` assumes agent owner = provider owner. A Project-owned provider would be deleted incorrectly if an external user's agent references it.

7. **Provider deletion block** — Currently blocks deletion if any agent references the provider, but only checks the provider owner's agents. Project-scoped agents would not be detected.

8. **Memory namespace coupling** — `['users', userId, ...]` is hardcoded to Persona User IDs. External user memory would need `['projects', projectId, 'users', externalUserId, ...]`.

### 14.3 Low Risk

9. **SkillLibraryStore namespace** — `['users', userId, 'skill-library']` — same pattern issue.

10. **AgentSkillsStore namespace** — `['agents', agentIdStr, 'enabled']` — doesn't reference userId, but resolves skills by populating from the agent's skill array.

11. **Rate limiter identifier** — Uses `req.user._id` or IP. Could incorporate projectId.

---

## 15. Reusable Infrastructure

### 15.1 What Can Be Reused Largely As-Is

| Component | Reason |
|-----------|--------|
| MCP `authMode: 'owner' | 'user'` enum | Directly matches the Developer Platform requirement |
| MCP user token storage (`mcpuserconnections`) | Already isolated by `(mcpId, userId)` |
| OAuth PKCE flow + state signing | Protocol-agnostic; just the redirect URL needs configuration |
| Token refresh logic | Credential-type-agnostic |
| Knowledge chunking/embedding pipeline | Pure infrastructure, no ownership logic |
| Skill file validation + SKILL.md parsing | Pure infrastructure |
| Provider key encryption/decryption | Works with any API key, regardless of who owns it |
| Agent factory pattern | Single integration point that can be extended with Project scoping |

### 15.2 What Needs Scoping/Configuration

| Component | What Needs to Change |
|-----------|---------------------|
| MCP callback redirect URL | From hardcoded `/dashboard/...` to configurable per project |
| Knowledge tool filter | From `isPublic` (global) to `projectId + isPublic` |
| Agent factory cache key | From `agentId:userId` to `projectId:agentId:userId` |
| Memory namespaces | From `['users', userId]` to `['projects', projectId, 'users', extUserId]` |

### 15.3 What Needs Redesign

| Component | Why |
|-----------|-----|
| `ownerId` type | From `ObjectId → User` to a polymorphic owner (User, Project, or ExternalUser) |
| Authorization pattern | From `ownerId.toString() !== userId.toString()` to a centralized authorization function |
| Provider model | Need Project-level provider concept |
| Public resource queries | Need project scope on every query |

---

## 16. Architecture Questions Raised

1. **How does `ownerId` become polymorphic?** Options: a `projectId` alongside `ownerId`, a generalized `ownedBy` field with discriminator, or separate collections.

2. **How does the OAuth callback redirect become configurable?** The state token could include a `projectId` field, and the callback handler could look up the project's configured redirect base.

3. **How do MCP credentials work for Project-owned MCPs?** The owner token would be stored against the Project (not a Persona User). Who triggers the owner OAuth flow? The Project admin.

4. **How does the Architect agent handle Project-scoped resources?** Currently it uses the user's default provider and skill library. For a Project, it would need to use the Project's provider and skill library.

5. **Should KnowledgeBase Qdrant collections be named with a project prefix?** E.g., `proj_beyondcampus_kb_<id>_<random>` instead of `kb_<id>_<random>`.

6. **How do external users authenticate for MCP connections?** Currently MCP user auth flows use Persona userId. An external user would need a Persona-recognizable identity (or the Project backend would proxy the OAuth flow).

7. **Is there a need for cross-project resource sharing?** The requirements say no — resources must be strictly isolated. But the architecture should not make future cross-project sharing impossible.

8. **Should `SkillLibraryStore` and `MemoryFilesStore` operate at project scope?** Their namespaces (`['users', userId, ...]`) would need to be generalized.

9. **What happens to global unique indexes?** All three (`skill owner+name`, `mcp owner+name`, `kb qdrantCollectionName`) need to become compound indexes with `projectId`.

10. **How does the `AgentSkillsStore` determine which skills an agent can access?** Currently from `agent.populate('skills')`. In a Project-scoped world, skills need to be filtered by `projectId` too.

---

## 17. Files Inspected

| File | Purpose |
|------|---------|
| `skills/skill.model.js` | Skill schema — ownerId, isPublic, indexes |
| `skills/skill.service.js` | Skill CRUD + ownership logic |
| `skills/skill.repository.js` | Skill DB access + public queries |
| `skills/skill.controller.js` | Skill request handlers |
| `skills/skill.routes.js` | Skill route definitions |
| `skills/skillLibraryStore.js` | BaseStore for skill authoring via Architect |
| `skills/agentSkillsStore.js` | BaseStore for serving agent-attached skills at runtime |
| `skills/skillMarkdown.js` | SKILL.md rendering + slugification |
| `skills/skillValidation.js` | File path validation + MIME type mapping |
| `skills/architectSkill.js` | Built-in Architect skill definition |
| `knowledge/knowledge-base.model.js` | KB schema — ownerId, isPublic, qdrantCollectionName |
| `knowledge/knowledge-chunk.model.js` | Chunk schema — kbId, no direct owner |
| `knowledge/knowledge.service.js` | KB CRUD + Qdrant integration + ownership checks |
| `knowledge/knowledge.repository.js` | KB DB access |
| `knowledge/knowledge.controller.js` | KB request handlers |
| `knowledge/knowledge.routes.js` | KB route definitions |
| `knowledge/knowledge.tools.js` | Runtime KB tool resolution for agents |
| `mcp/mcp.model.js` | MCP schema — ownerId, authType, authMode, oauth, apiKeyEncrypted |
| `mcp/mcp-user-connection.model.js` | User connection schema — mcpId, userId, tokens |
| `mcp/mcp.service.js` | MCP CRUD + OAuth flows + ownership checks |
| `mcp/mcp.repository.js` | MCP DB access |
| `mcp/mcp-user-connection.repository.js` | User connection DB access |
| `mcp/mcp.controller.js` | MCP request handlers |
| `mcp/mcp.routes.js` | MCP route definitions |
| `mcp/mcp-token.service.js` | Token resolution + refresh for both auth modes |
| `mcp/mcp-oauth-client.js` | OAuth discovery, DCR, PKCE, code exchange, token refresh |
| `mcp/oauth-state.js` | Signed OAuth state token (HMAC-SHA256) |
| `mcp/mcp.tools.js` | Runtime MCP tool resolution for agents |
| `providers/provider.model.js` | Provider schema — ownerId, apiKeyEncrypted |
| `providers/provider.service.js` | Provider CRUD + encryption + ownership checks |
| `providers/provider.repository.js` | Provider DB access |
| `providers/provider.controller.js` | Provider request handlers |
| `providers/provider.routes.js` | Provider route definitions |
| `agents/agent.factory.js` | Agent graph compilation — resolves all resources at runtime |
| `agents/agent.model.js` | Agent schema — skills/mcps/knowledgeBases arrays |
| `agents/agent.service.js` | Agent CRUD + authorization |
| `agents/agent.validator.js` | Zod schemas — skills/mcps/knowledgeBases as string arrays |
| `tools/builder.tools.js` | Architect tools — provider verification, agent/skill management |
| `utils/encryption.js` | AES-256-GCM encryption for all secrets |

---

## 18. Evidence Quick Reference

| Claim | File | Line(s) |
|-------|------|---------|
| Skill `ownerId` | `skills/skill.model.js` | 6-10 |
| Skill `ownerId+name` unique | `skills/skill.model.js` | 47-49 |
| Skill public query (global) | `skills/skill.repository.js` | 34-35 |
| Skill public visibility check | `skills/skill.service.js` | 17-20 |
| Skill library namespace | `skills/skillLibraryStore.js` | 190-192 |
| Skill writes serialized per user | `skills/skillLibraryStore.js` | 120-133 |
| KB `ownerId` + `isPublic` | `knowledge/knowledge-base.model.js` | 18-23, 28-31 |
| KB `qdrantCollectionName` unique | `knowledge/knowledge-base.model.js` | 40-43 |
| KB authorization checks | `knowledge/knowledge.service.js` | 185-229 |
| Knowledge tools filter | `knowledge/knowledge.tools.js` | 25-28 |
| MCP `authMode: 'owner'/'user'` | `mcp/mcp.model.js` | 73-78 |
| MCP owner token storage | `mcp/mcp.model.js` | ownerToken schema (15-21) |
| MCP user connection storage | `mcp/mcp-user-connection.model.js` | 6-24 |
| MCP user connection unique index | `mcp/mcp-user-connection.model.js` | 28 |
| MCP ownership check | `mcp/mcp.service.js` | 80 |
| Owner OAuth flow | `mcp/mcp.service.js` | 212-265 |
| User OAuth flow | `mcp/mcp.service.js` | 267-317 |
| Owner callback redirect | `mcp/mcp.service.js` | 262-263 |
| User callback redirect | `mcp/mcp.service.js` | 312-313 |
| Token resolution by mode | `mcp/mcp-token.service.js` | 22-104 |
| Runtime MCP tool resolution | `mcp/mcp.tools.js` | 85-167 |
| Agent resources array references | `agents/agent.model.js` | 57, 62, 67 |
| Agent factory resource resolution | `agents/agent.factory.js` | 126-148, 186-190 |
| Agent cache key includes userId | `agents/agent.factory.js` | 155 |
| No cross-resource validation | `agents/agent.service.js` | 93-101 |
| Provider ownership check | `providers/provider.service.js` | 80 |
| Provider dependency check | `providers/provider.service.js` | 120-129 |
| Agent factory per-user MCP detection | `agents/agent.factory.js` | 152-153 |
