# 04 - Module-by-Module Analysis

This document provides a detailed, independent analysis of each logical module/domain in the current persona.hasanraiyan.me backend.

---

## 1. Auth Module

- **Responsibilities**: Verify Clerk JWT tokens, sync user information into local MongoDB dynamically upon login, manage authorization metadata.
- **Entry Points**: Global middleware inside `src/index.js`, route middleware in other routers.
- **Business Logic**: Exists inside `src/middlewares/auth.middleware.js` and `src/middlewares/optionalAuthMiddleware.js`.
- **Data Access**: Queries MongoDB directly via `User.findOne` / `User.create` / `User.save`.
- **Dependencies**:
  - _Internal_: `User` model, `loggerService`, `BaseError`.
  - _External_: `@clerk/express`.
- **Problems**: Sync logic is duplicated between `auth.middleware.js` and `optionalAuthMiddleware.js` (including commented-out log writing logic). Bypasses repository layers to hit `User` model directly.
- **Risk Level**: High (Critical path for all secure endpoints).
- **Refactoring Difficulty**: Medium.

---

## 2. User / Profile Module

- **Responsibilities**: User profile CRUD, account deletion, cleanup of related models.
- **Entry Points**: `/api/v1/profile`
- **Business Logic**: Inline in `src/controllers/profile.controller.js`.
- **Data Access**: Uses `userRepository` and queries models `Agent`, `Skill`, `Provider`, `Mcp`, `McpUserConnection`, `Conversation` directly.
- **Dependencies**:
  - _Internal_: `userRepository`, `checkpointService`, Mongoose models (`Agent`, `Skill`, `Provider`, `Mcp`, `McpUserConnection`, `Conversation`).
- **Problems**:
  - Profile deletion logic is in the controller rather than a service.
  - Direct query and deletion operations on Mongoose models (`Agent.deleteMany`, etc.) bypass repositories, leading to high coupling between profile controller and all other database schemas.
  - Lack of a profile service.
- **Risk Level**: Medium.
- **Refactoring Difficulty**: Medium.

---

## 3. Admin Module

- **Responsibilities**: List users, delete users.
- **Entry Points**: `/api/v1/admin/users`, `/api/v1/admin/users/:id`
- **Business Logic**: Inside `src/controllers/admin.controller.js`.
- **Data Access**: Uses `userRepository` functions.
- **Dependencies**:
  - _Internal_: `userRepository`, `adminMiddleware`, `authMiddleware`.
- **Problems**: Direct usage of `userRepository` inside the controller (no admin service exists).
- **Risk Level**: Low.
- **Refactoring Difficulty**: Low.

---

## 4. Provider Module

- **Responsibilities**: Manage custom LLM provider endpoints and API keys with secure encryption.
- **Entry Points**: `/api/v1/providers`
- **Business Logic**: `src/services/provider.service.js`.
- **Data Access**: Uses `providerRepository` and queries `Agent` Mongoose model directly.
- **Dependencies**:
  - _Internal_: `providerRepository`, `agentRepository`, `agentFactory`, `Agent` model, `encryption` utility.
- **Problems**: `ProviderService` queries `Agent.find` directly, bypassing `agentRepository` and coupling the Provider module to the Agent data layer.
- **Risk Level**: Medium (Leaking decrypted API keys is a major security risk).
- **Refactoring Difficulty**: Low.

---

## 5. Agent Module

- **Responsibilities**: Agent configuration, slug generation, visibility checking, search filters, and file-based user memory search/removal.
- **Entry Points**: `/api/v1/agents`
- **Business Logic**: `src/services/agent.service.js`.
- **Data Access**: Uses `agentRepository` and queries `User` and `MemoryFile` models directly.
- **Dependencies**:
  - _Internal_: `agentRepository`, `User` model, `MemoryFile` model, `agentFactory`, `memoryFilesStore` utility.
- **Problems**:
  - Redundant request body Zod validation in route middleware and controller.
  - Direct queries on Mongoose models (`User` and `MemoryFile`) inside the service and controller.
- **Risk Level**: High (Core business entity of the marketplace).
- **Refactoring Difficulty**: Medium.

---

## 6. Thread / Conversation Module

- **Responsibilities**: Retrieve thread history, create conversations, manage checkpoint persistence.
- **Entry Points**: `/api/v1/threads`
- **Business Logic**: `src/services/checkpoint.service.js`.
- **Data Access**: Uses `threadRepository` and MongoClient directly.
- **Dependencies**:
  - _Internal_: `threadRepository`, `MongoClient` client saver.
  - _External_: `@langchain/langgraph-checkpoint-mongodb`.
- **Problems**: Checkpoint service directly manages raw MongoDB collections (`checkpoints`, `checkpoint_writes`), mixing ODM structures with raw MongoDB driver queries.
- **Risk Level**: Medium.
- **Refactoring Difficulty**: Medium.

---

## 7. Skill Module

- **Responsibilities**: Code snippet validation, compilation/instructions validation, and attachment/detachment of tools from agents.
- **Entry Points**: `/api/v1/skills`
- **Business Logic**: `src/services/skill.service.js`.
- **Data Access**: Uses `skillRepository` and queries `Agent` model directly.
- **Dependencies**:
  - _Internal_: `skillRepository`, `Agent` model, `agentFactory`.
- **Problems**: `SkillService` directly runs queries and updates on the raw `Agent` model (e.g. `Agent.find`, `Agent.updateMany`), bypassing the agent repository.
- **Risk Level**: Medium.
- **Refactoring Difficulty**: Low.

---

## 8. MCP Module

- **Responsibilities**: Model Context Protocol (MCP) server creation, connection testing, OAuth integration, per-user connections.
- **Entry Points**: `/api/v1/mcps`
- **Business Logic**: `src/services/mcp.service.js` and `src/services/mcpToken.service.js`.
- **Data Access**: Uses `mcpRepository`, `mcpUserConnectionRepository`, and queries `Agent` model directly.
- **Dependencies**:
  - _Internal_: `mcpRepository`, `mcpUserConnectionRepository`, `Agent` model, `agentFactory`, `mcpTokenService`, `encryption`.
- **Problems**: `McpService` imports and queries `Agent` model directly (`Agent.find`, `Agent.updateMany`), bypassing the repository layer.
- **Risk Level**: High (Handles dynamic client registration and OAuth callbacks).
- **Refactoring Difficulty**: High.

---

## 9. AGUI Module

- **Responsibilities**: Manage Server-Sent Events (SSE) chat streaming, translate LangGraph agent streams, track execution timelines.
- **Entry Points**: `/api/v1/agui`
- **Business Logic**: Written inline inside `src/routes/agui.routes.js` (e.g. `runAgentAsAguiEvents` generator).
- **Data Access**: Uses `threadRepository`.
- **Dependencies**:
  - _Internal_: `agentFactory`, `threadRepository`, `checkpointService`, `aguiTranslator`, `RunScopeTracker`, `subagentTrace`.
- **Problems**:
  - Massive router file (`agui.routes.js`, 10KB+) containing LangGraph stream orchestration, concurrency limiting, AbortController tracking, and event mapping.
  - No service layer or controller structure. Everything is inline in the routing layer.
- **Risk Level**: Critical (Runs the live AI execution engine).
- **Refactoring Difficulty**: High.

---

## 10. Webhooks Module

- **Responsibilities**: Verify Clerk webhook signatures and synchronize local `User` records.
- **Entry Points**: `/api/v1/webhooks`
- **Business Logic**: Written inline inside `src/routes/webhook.routes.js`.
- **Data Access**: Queries `User` model directly.
- **Dependencies**:
  - _Internal_: `User` model, `loggerService`.
  - _External_: `svix` (signature verification).
- **Problems**: High coupling. All Clerk webhook verification, event parsing (`user.created`, `user.updated`, `user.deleted`), and database queries are inline inside the route handler. No service, no controller, and bypasses `userRepository`.
- **Risk Level**: High (dynamic user synchronization).
- **Refactoring Difficulty**: Low.

---

## 11. Knowledge Module

- **Responsibilities**: Parse document uploads, split texts into chunks, generate embeddings, and populate vector databases.
- **Entry Points**: `/api/v1/knowledge`
- **Business Logic**: `src/services/knowledge.service.js`.
- **Data Access**: Uses `knowledgeRepository` and queries `KnowledgeChunk` and `KnowledgeBase` collections.
- **Dependencies**:
  - _Internal_: `knowledgeRepository`, `KnowledgeChunk` and `KnowledgeBase` models.
  - _External_: `@qdrant/js-client-rest`, `pdf-parse`.
- **Problems**: Large service file with deep logic that interacts directly with models.
- **Risk Level**: Medium.
- **Refactoring Difficulty**: Medium.
