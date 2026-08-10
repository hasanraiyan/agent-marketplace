# Frontend — Backend API Usage Mapping

This document maps frontend pages/components to backend API endpoints (Express routes) the frontend calls.

**Architecture:** persona.hasanraiyan.me has three frontend experiences sharing one backend.

| Experience                 | URL Prefix       | Audience       | Purpose                                 |
| -------------------------- | ---------------- | -------------- | --------------------------------------- |
| **Persona** (Consumer)     | `/dashboard/...` | End users      | Discover, use, converse with agents     |
| **Agent Studio** (Creator) | `/studio/...`    | Agent builders | Create, configure, test, publish agents |
| **Developer Studio** (Dev) | `/developer/...` | Platform admins | Create Projects, manage credentials/resources |

---

## Persona (Consumer) Routes

### `/dashboard` — Discover Agents

- **File:** `src/app/dashboard/page.jsx`
- **Calls:**
  - `searchAgents()` → POST `/api/v1/agents/search` — browse/search public agents
  - `getProviders()` → GET `/api/v1/providers` — check if providers exist (for Studio entry visibility)
- **Description:** Landing page with search, category filters, featured slider, trending list

### `/dashboard/agents` — My Agents

- **File:** `src/app/dashboard/agents/page.jsx`
- **Calls:**
  - `getProfile()` → GET `/api/v1/profile` — resolve current user
  - `searchAgents({ ownerId, ... })` → POST `/api/v1/agents/search` — fetch user's owned agents
  - `deleteAgent(id)` → DELETE `/api/v1/agents/:id` — delete owned agent
- **Note:** Currently shows **owned agents**, not installed agents (see known product gap below)

### `/dashboard/agents/[id]` — Agent Profile (Consumer)

- **File:** `src/app/dashboard/agents/[id]/page.jsx`
- **Calls:**
  - `getAgent(id)` → GET `/api/v1/agents/:id` — fetch agent detail
  - `getProfile()` → GET `/api/v1/profile` — check ownership for "Manage in Studio" link
- **Description:** Consumer-facing agent detail with plain-language capability summary

### `/dashboard/agents/[id]/run` — Agent Chat

- **File:** `src/app/dashboard/agents/[id]/run/page.jsx`
- **Calls:**
  - AG-UI SSE streaming → POST `/api/v1/threads/:id/stream` — streaming chat
  - `createThread()` → POST `/api/v1/threads` — start new conversation
- **Description:** Full AG-UI protocol chat interface with tool calls, reasoning traces, sub-agent dialogs

### `/dashboard/settings` — User Settings

- **Calls:**
  - `getProfile()` → GET `/api/v1/profile`
  - `updateProfile()` → PATCH `/api/v1/profile`

### Legacy Creative Routes (Redirect to Studio)

The following dashboard routes are **redirects** to Agent Studio:

| Legacy Route                                | Redirects To                |
| ------------------------------------------- | --------------------------- | --------- | ---------- | ------- |
| `/dashboard/agents/create`                  | `/studio/agents/new`        |
| `/dashboard/agents/builder`                 | `/studio/agents/new`        |
| `/dashboard/agents/[id]/builder`            | `/studio/agents/[id]/build` |
| `/dashboard/agents/[id]/edit`               | `/studio/agents/[id]/build` |
| `/dashboard/connectors/[[...slug]]`         | `/studio/skills             | knowledge | connectors | memory` |
| `/dashboard/skills/[[...slug]]`             | `/studio/skills/...`        |
| `/dashboard/settings/providers/[[...slug]]` | `/studio/providers/...`     |

---

## Agent Studio (Creator) Routes

### `/studio` — Studio Home

- **File:** `src/app/studio/page.jsx`
- **Calls:**
  - `getProfile()` → GET `/api/v1/profile`
  - `searchAgents({ ownerId, ... })` → POST `/api/v1/agents/search` — fetch creator's agents
  - `getProviders()` → GET `/api/v1/providers`
  - `getMySkills()` → GET `/api/v1/skills`
  - `getMyMcps()` → GET `/api/v1/mcps`
  - `getMyKnowledgeBases()` → GET `/api/v1/knowledge`
- **Description:** Dashboard showing agent stats, needs-attention list, resource counts

### `/studio/agents` — Agent Management

- **Calls:** Same as `/dashboard/agents` (owns agent listing)

### `/studio/agents/new` — Create Agent

- **Calls:** `createAgent()` → POST `/api/v1/agents`

### `/studio/agents/[id]/build` — Agent Builder

- **Calls:**
  - `getAgent(id)` → GET `/api/v1/agents/:id`
  - `updateAgent(id)` → PATCH `/api/v1/agents/:id`
  - `getProviders()` → GET `/api/v1/providers`
  - `getProviderModels(id)` → GET `/api/v1/providers/:id/models`

### `/studio/agents/[id]/test` — Test Agent

- **Calls:** AG-UI streaming on a test thread

### `/studio/skills` — Skill Management

- **Calls:**
  - `getMySkills()` → GET `/api/v1/skills`
  - `createSkill()` → POST `/api/v1/skills`
  - `updateSkill(id)` → PATCH `/api/v1/skills/:id`
  - `deleteSkill(id)` → DELETE `/api/v1/skills/:id`

### `/studio/knowledge` — Knowledge Bases

- **Calls:**
  - `getMyKnowledgeBases()` → GET `/api/v1/knowledge`
  - `createKnowledgeBase()` → POST `/api/v1/knowledge`
  - `deleteKnowledgeBase(id)` → DELETE `/api/v1/knowledge/:id`
  - File upload → POST `/api/v1/upload/knowledge`

### `/studio/connectors` — MCP Connectors

- **Calls:**
  - `getMyMcps()` → GET `/api/v1/mcps`
  - `createMcp()` → POST `/api/v1/mcps`
  - `updateMcp(id)` → PATCH `/api/v1/mcps/:id`
  - `deleteMcp(id)` → DELETE `/api/v1/mcps/:id`

### `/studio/memory` — Memory Management

- **Calls:** Memory CRUD via `/api/v1/memories`

### `/studio/providers` — LLM Providers

- **Calls:**
  - `getProviders()` → GET `/api/v1/providers`
  - `createProvider()` → POST `/api/v1/providers`
  - `updateProvider(id)` → PUT `/api/v1/providers/:id`
  - `deleteProvider(id)` → DELETE `/api/v1/providers/:id`
  - `testProviderConnection(id)` → POST `/api/v1/providers/:id/test`

---

## Developer Studio (Developer) Routes

### `/developer/projects` — Projects

- **File:** `src/app/developer/projects/page.jsx`
- **Calls:**
  - `getProjects()` → GET `/api/v1/projects` — list Projects the user administers
  - `createProject(data)` → POST `/api/v1/projects` — create a Project (initial Admin granted automatically)
- **Description:** Projects are external consumers of Persona's agent infrastructure — your own app/platform on top of Persona, with its own Admins, credentials, and resources.

### `/developer/projects/[id]` — Project Detail

- **File:** `src/app/developer/projects/[id]/page.jsx`
- **Calls:**
  - `getProject(id)` → GET `/api/v1/projects/:id` — fetch Project metadata
  - `updateProject(id, data)` → PATCH `/api/v1/projects/:id`
  - `suspendProject(id)` → POST `/api/v1/projects/:id/suspend` — credentials stop authenticating
  - `reactivateProject(id)` → POST `/api/v1/projects/:id/reactivate`
  - `requestProjectDeletion(id)` → POST `/api/v1/projects/:id/delete` — grace-period deletion
  - `cancelProjectDeletion(id)` → POST `/api/v1/projects/:id/cancel-deletion`
- **Description:** Tabs for Overview, Members, Credentials, Agents, Skills, Stores, Knowledge, Connectors, Providers, and Audit Logs.

### Members

- **Calls:**
  - `getProjectMembers(id)` → GET `/api/v1/projects/:id/members`
  - `addProjectMember(id, payload)` → POST `/api/v1/projects/:id/members` — add Admin by `{ email }` or `{ personaUserId }` (exactly one; email resolved server-side)
  - `searchProjectMembers(id, q)` → GET `/api/v1/projects/:id/members/search?q=...` — email autocomplete for the Add Admin dialog (returns name + email only)
  - `removeProjectMember(id, personaUserId)` → DELETE `/api/v1/projects/:id/members/:personaUserId`

### Credentials

- **Calls:**
  - `getProjectCredentials(id)` → GET `/api/v1/projects/:id/credentials`
  - `mintProjectCredential(id, label)` → POST `/api/v1/projects/:id/credentials` — plaintext secret shown exactly once
  - `revokeProjectCredential(id, credentialId)` → DELETE `/api/v1/projects/:id/credentials/:credentialId`

### Project Resources — Agents, Skills, Stores, Knowledge, Connectors, Providers

Every resource follows the same list/create/update/delete shape under `/api/v1/projects/:projectId`:

| Resource    | List            | Create           | Update                  | Delete                 |
| ----------- | --------------- | ---------------- | ----------------------- | ---------------------- |
| Agents      | GET `/agents`   | POST `/agents`   | PATCH `/agents/:id`     | DELETE `/agents/:id`   |
| Skills      | GET `/skills`   | POST `/skills`   | PATCH `/skills/:id`     | DELETE `/skills/:id`   |
| Stores      | GET `/stores`   | POST `/stores`   | PATCH `/stores/:id`     | DELETE `/stores/:id`   |
| Knowledge   | GET `/knowledge`| POST `/knowledge`| PATCH `/knowledge/:id`  | DELETE `/knowledge/:id`|
| Connectors  | GET `/mcps`     | POST `/mcps`     | PATCH `/mcps/:id`       | DELETE `/mcps/:id`     |
| Providers   | GET `/providers`| POST `/providers`| PATCH `/providers/:id`  | DELETE `/providers/:id`|

Resource-specific extras:

- **Providers:** `testProjectProviderConnection()` → POST `/providers/:id/test-connection`, `getProjectProviderModels()` → GET `/providers/:id/models`, `getProjectProviderUsage()` → GET `/providers/:id/usage`
- **Skills:** `getProjectSkillUsage()` → GET `/skills/:id/usage`
- **Knowledge:** `getProjectKnowledgeDocuments()` → GET `/knowledge/:id/documents`, `uploadProjectKnowledgeDocuments()` → POST `/knowledge/:id/documents` (multipart), `deleteProjectKnowledgeDocument()` → DELETE `/knowledge/:id/documents/:sourceName`, `searchProjectKnowledge()` → POST `/knowledge/:id/search`, `getProjectKnowledgeUsage()` → GET `/knowledge/:id/usage`
- **Connectors:** `getProjectMcpOwnerAuthorizeUrl()` → GET `/mcps/:id/oauth/owner/authorize`, `disconnectProjectMcpOwnerConnection()` → DELETE `/mcps/:id/oauth/owner/connection`, `getProjectMcpUsage()` → GET `/mcps/:id/usage`
- **Bulk delete (best-effort per id):** POST `/agents/bulk-delete`, `/skills/bulk-delete`, `/knowledge/bulk-delete`, `/mcps/bulk-delete`, `/providers/bulk-delete`

### Audit Logs

- **Calls:** `getProjectAuditLogs(id, params)` → GET `/api/v1/projects/:id/audit-logs` — lifecycle events only (credentials minted/revoked, membership changes, suspend/restore)

---

## API Module Organization

API helpers live in `src/lib/api/`:

| Module    | File           | Functions                                                                                                                                      |
| --------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Agents    | `agents.js`    | `searchAgents`, `getAgent`, `getAgentBySlug`, `createAgent`, `updateAgent`, `deleteAgent`                                                      |
| Threads   | `threads.js`   | `createThread`, `getThreads`, `getThread`, `deleteThread`, `updateThreadTitle`, `getMessages`                                                  |
| Skills    | `skills.js`    | `getMySkills`, `getSkill`, `createSkill`, `updateSkill`, `deleteSkill`, `getPublicSkills`                                                      |
| Providers | `providers.js` | `getProviders`, `createProvider`, `updateProvider`, `deleteProvider`, `testProviderConnection`, `getProviderModels`, `testProviderCredentials` |
| MCPs      | `mcps.js`      | `getMyMcps`, `getMcp`, `createMcp`, `updateMcp`, `deleteMcp`, `getMcpTools`                                                                    |
| Knowledge | `knowledge.js` | `getMyKnowledgeBases`, `getKnowledgeBase`, `createKnowledgeBase`, `deleteKnowledgeBase`                                                        |
| Memory    | `memory.js`    | Memory CRUD operations                                                                                                                         |
| Profile   | `profile.js`   | `getProfile`, `updateProfile`                                                                                                                  |
| Projects  | `projects.js`  | `getProjects`, `createProject`, `getProject`, `updateProject`, lifecycle (suspend/reactivate/delete/cancel-deletion), members, credentials, resource CRUD (agents/skills/stores/knowledge/mcps/providers), audit logs |
| Admin     | `admin.js`     | Admin user management                                                                                                                          |
| Health    | `health.js`    | Server diagnostics                                                                                                                             |
| Upload    | `upload.js`    | File upload helpers                                                                                                                            |

---

## Known Product Gaps

### Marketplace Architecture

Persona does **not** yet have a proper Add/Install relationship for marketplace agents.

- **"My Agents" currently shows agents the user OWNS**, not agents they have installed from the marketplace.
- There is no installation schema, agent instance model, subscription system, or fork mechanism.
- Monetization, ratings, reviews infrastructure, and analytics are **not implemented**.

This is a **known product gap** that should be explicitly tracked.
