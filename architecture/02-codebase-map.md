# 02 - Codebase Map

This document maps the entire backend codebase by domain/module, identifying their files, dependencies, collections, and shared utilities.

---

## 1. Domain/Module Map

Below is a map of the backend domains. While the files are currently grouped technically (e.g. all controllers in `controllers/`), they form logical domain boundaries:

### A. Auth Domain

- **Responsibilities**: Clerk authentication verification, request parsing, database user synchronization.
- **Routes**: None (handled as middleware on protected endpoints, Clerk webhooks are in Webhook domain).
- **Middleware**:
  - `src/middlewares/auth.middleware.js` (Strict authentication)
  - `src/middlewares/optionalAuthMiddleware.js` (Optional guest/auth handling)
- **Models**: `User` (to resolve local accounts)
- **Internal Dependencies**: `User`, `loggerService`
- **External Dependencies**: `@clerk/express`

### B. User / Profile Domain

- **Responsibilities**: Retrieving user profiles, updating profile metadata, deleting accounts (including cleaning up all associated agents, threads, checkpoints, skills, connections).
- **Routes**: `src/routes/profile.routes.js`
- **Controllers**: `src/controllers/profile.controller.js`
- **Services**: None (Account cleanup/deletion logic is currently inline in `profile.controller.js`).
- **Repositories**: `src/repositories/userRepository.js`
- **Models**: `User`, `Agent`, `Skill`, `Provider`, `Mcp`, `McpUserConnection`, `Conversation`
- **Validators**: `src/validators/profile.validator.js`
- **Internal Dependencies**: `checkpointService`, `userRepository`, `Agent`, `Skill`, `Provider`, `Mcp`, `McpUserConnection`, `Conversation`
- **Database Collections**: `users`

### C. Admin Domain

- **Responsibilities**: User listing, administration analytics, system overview.
- **Routes**: `src/routes/admin.routes.js`
- **Controllers**: `src/controllers/admin.controller.js`
- **Middleware**: `src/middlewares/admin.middleware.js`
- **Repositories**: `src/repositories/userRepository.js`, `src/repositories/agentRepository.js`
- **Validators**: None
- **Internal Dependencies**: `userRepository`, `agentRepository`

### D. Provider Domain

- **Responsibilities**: Managing AI provider integrations and credentials (e.g., API keys, custom model endpoints).
- **Routes**: `src/routes/provider.routes.js`
- **Controllers**: `src/controllers/provider.controller.js`
- **Services**: `src/services/provider.service.js`
- **Repositories**: `src/repositories/providerRepository.js`
- **Models**: `Provider`
- **Validators**: `src/validators/provider.validator.js`
- **Database Collections**: `providers`

### E. Agent Domain

- **Responsibilities**: Agent creation, configuration, slug generation, visibility, metadata management, and user memory files search/removal.
- **Routes**: `src/routes/agent.routes.js`
- **Controllers**: `src/controllers/agent.controller.js`
- **Services**: `src/services/agent.service.js`
- **Repositories**: `src/repositories/agentRepository.js`
- **Models**: `Agent`, `MemoryFile`
- **Validators**: `src/validators/agent.validator.js`
- **Internal Dependencies**: `userRepository`, `agentRepository`, `agentFactory`, `MemoryFile`, `memoryFilesStore`
- **Database Collections**: `agents`, `memoryfiles`

### F. Thread / Conversation Domain

- **Responsibilities**: Chat threads, message history retrieval, auto-titling threads based on first prompt, and LangGraph checkpoint synchronization.
- **Routes**: `src/routes/thread.routes.js`
- **Controllers**: `src/controllers/thread.controller.js`
- **Services**: `src/services/checkpoint.service.js`
- **Repositories**: `src/repositories/threadRepository.js`
- **Models**: `Conversation` (Thread metadata)
- **Validators**: `src/validators/thread.validator.js`
- **Internal Dependencies**: `threadRepository`, `checkpointService`
- **Database Collections**: `conversations`, `checkpoints`, `checkpoint_writes` (MongoDBSaver)

### G. Skill Domain

- **Responsibilities**: Agent tool capabilities, code snippet creation, validation, storage.
- **Routes**: `src/routes/skill.routes.js`
- **Controllers**: `src/controllers/skill.controller.js`
- **Services**: `src/services/skill.service.js`
- **Repositories**: `src/repositories/skillRepository.js`
- **Models**: `Skill`
- **Validators**: `src/validators/skill.validator.js`
- **Database Collections**: `skills`

### H. MCP Domain

- **Responsibilities**: Model Context Protocol (MCP) server definitions, user connections, server authorizations.
- **Routes**: `src/routes/mcp.routes.js`
- **Controllers**: `src/controllers/mcp.controller.js`
- **Services**: `src/services/mcp.service.js`, `src/services/mcpToken.service.js`
- **Repositories**: `src/repositories/mcpRepository.js`, `src/repositories/mcpUserConnectionRepository.js`
- **Models**: `Mcp`, `McpUserConnection`
- **Validators**: `src/validators/mcp.validator.js`
- **Database Collections**: `mcps`, `mcpuserconnections`

### I. AGUI Domain

- **Responsibilities**: Server-Sent Events (SSE) chat stream, LangGraph graph building, agent run orchestration, human-in-the-loop (HITL) interrupt management, timeline/subagent event stream translation.
- **Routes**: `src/routes/agui.routes.js`
- **Controllers**: None (SSE execution logic is entirely inline inside the router in `agui.routes.js`).
- **Services**: None
- **Repositories**: `src/repositories/threadRepository.js`
- **Internal Dependencies**: `agentFactory`, `threadRepository`, `checkpointService`, `aguiTranslator`, `RunScopeTracker`, `subagentTrace`
- **Database Collections**: Modifies `conversations` (subagentTraces)

### J. Webhook Domain

- **Responsibilities**: Clerk authentication events handler (user created, updated, deleted).
- **Routes**: `src/routes/webhook.routes.js`
- **Controllers**: None (Verification and DB updates are inline inside the router).
- **Models**: `User`
- **External Dependencies**: `svix`

### K. Knowledge Domain

- **Responsibilities**: Document uploads, parsing (PDFs), text splitting, vector embedding, and Qdrant index population/searching.
- **Routes**: `src/routes/knowledge.routes.js`
- **Controllers**: `src/controllers/knowledge.controller.js`
- **Services**: `src/services/knowledge.service.js`
- **Repositories**: `src/repositories/knowledgeRepository.js`
- **Models**: `KnowledgeBase`, `KnowledgeChunk`
- **Validators**: `src/validators/knowledge.validator.js`
- **Database Collections**: `knowledgebases`, `knowledgechunks`
- **External Dependencies**: `@qdrant/js-client-rest`, `pdf-parse`

---

## 2. Shared Utilities & Cross-Cutting Helpers

These utilities are shared across multiple domains to enforce DRY and standardized behaviors:

- `src/utils/errors/`: Standardized domain exceptions extending `BaseError` (e.g. `NotFoundError`, `ValidationError`, `RateLimitError`).
- `src/utils/formatters/`: Unified envelopes for successful API responses (`successFormatter.js`) and error responses (`errorFormatter.js`).
- `src/utils/logger/`: Injectable, swappable logger (`ConsoleLogger` by default).
- `src/utils/validators/`: Schema validation execution adapter (`schemaValidator.js`).
- `src/utils/encryption.js`: Cryptographic wrapper for encrypting sensitive fields using AES-256-GCM.
- `src/utils/memoryFilesStore.js`: Namespace generators and formatting utilities for file-based agent memories.

---

## 3. Conceptual Dependency Map

The overall dependency flow of the application starts with client request handling and propagates downward. Standard hierarchy direction is:

```
[HTTP Request]
     ↓
[Global Middleware] (CORS, Request Log, Clerk Auth)
     ↓
[Validation / Rate Limit Middleware] (Zod validation, rateLimiters)
     ↓
[Routers] (Route registration, SSE streaming)
     ↓
[Controllers] (Request parsing, routing)
     ↓
[Services] (Business logic orchestration, LangGraph graph run)
     ↓
[Repositories / Data Access] (Db query helpers, Qdrant SDK, MongoClient)
     ↓
[Models / Database] (Mongoose models, MongoDB, Qdrant vectors)
```

### Module Cross-Dependencies

```
                 Clerk Webhooks
                      ↓
                    Users (User collection)
                 ↙    ↓    ↘
          Providers Skills  MCPs
             ↘        ↓     ↙
                   Agents (References provider, skill, mcp, knowledge)
                 ↙    ↓    ↘
          Knowledge Threads Memories
             ↙        ↓
         Qdrant     AGUI (SSE stream building)
```

---

## 4. Potential Circular Dependencies

- **Agent & AgentFactory**: `AgentController` calls `agentService` and invalidates `agentFactory`. `agentFactory` builds agents by reading Mongoose models. If a service imports the factory and the factory imports services, a circular dependency can occur. Currently, this is avoided by the factory loading Mongoose models directly, but it violates the service boundaries.
- **Thread & CheckpointService**: `threadRepository` is utilized inside `CheckpointService` for database queries, and `Conversation` (the thread model) is utilized inside `profile.controller.js` which also depends on `checkpointService` to clean up.
- **Knowledge & Agent**: The vector search functions reference agent states, but are segregated through ID mappings rather than direct code imports, which prevents runtime import loops.
