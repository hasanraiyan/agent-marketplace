# 05 - Architecture Problems

This document audits the persona.hasanraiyan.me backend to identify code quality, coupling, validation, error handling, and architectural boundary violations.

---

## 1. CRITICAL Severity Findings

### Finding 1.1: Business Logic and SSE Orchestration Inside Routing Layer

- **Location**: `src/routes/agui.routes.js`
- **Problem**: The routing file is over 300 lines long and handles low-level SSE streaming setup, AbortController abort listener bindings, LangGraph agent factories instantiation, stream event translation mapping, human-in-the-loop (HITL) interrupt handling, and timeline trace persistence.
- **Why it is a problem**: This violates the **Single Responsibility Principle**. Routers should only match paths, attach middleware, and forward execution to controllers. Having runtime execution logic here makes it impossible to unit-test the orchestration logic without mocking Express request/response/stream parameters.
- **Potential Impact**: Hard to maintain, extremely difficult to write automated unit tests for, and high risk of stream leakage or socket hangs if connection closures are handled incorrectly.
- **Recommended Direction**: Extract the LangGraph event stream tracking and SSE mapping logic into an `AguiService` and an `AguiController`. Keep the router thin.

---

## 2. HIGH Severity Findings

### Finding 2.1: Clerk Webhook Handler Contains All Logic Inline

- **Location**: `src/routes/webhook.routes.js`
- **Problem**: Signature verification via `svix`, event parsing (`user.created`, `user.updated`, `user.deleted`), and direct DB queries (`User.create`, `User.findOneAndUpdate`, `User.findOneAndDelete`) are all written inline inside the router definition.
- **Why it is a problem**: Bypasses the controller, service, and repository layers completely. It couples the route endpoint definition directly to both the Clerk external webhook payloads and the internal Mongoose database schemas.
- **Potential Impact**: If Clerk payload structures change or if we migrate to another database engine, we must modify the routing file. Testing requires spinning up full integration mock request streams.
- **Recommended Direction**: Refactor by creating a `WebhookController` and a `WebhookService` (or routing user modifications to a `UserService`).

### Finding 2.2: Cross-Domain Database Leakage in Services

- **Locations**:
  - `src/services/provider.service.js` (imports `Agent` model directly to query/invalidate cache)
  - `src/services/skill.service.js` (imports `Agent` model directly to update/remove skills)
  - `src/services/mcp.service.js` (imports `Agent` model directly to disconnect/invalidate cache)
- **Problem**: Services depend directly on the database models of _other_ domains rather than interacting via their respective repositories.
- **Why it is a problem**: This breaks module boundaries. If the schema or querying logic of the `Agent` model changes, it breaks the Provider, Skill, and MCP services.
- **Potential Impact**: Spagetti dependencies and high coupling. Changes to the `Agent` model can cause regression bugs in unrelated service modules.
- **Recommended Direction**: Expose domain methods in `agentRepository` (e.g. `agentRepository.invalidateCacheForProvider(providerId)`) and call them from the other services, or define cross-domain event listeners.

### Finding 2.3: Direct Database Access from Controllers

- **Location**: `src/controllers/profile.controller.js`
- **Problem**: The account deletion function `deleteProfile` directly references Mongoose models `Conversation`, `Agent`, `Skill`, `Provider`, `Mcp`, and `McpUserConnection` to run `deleteMany` operations, completely bypassing services and repositories.
- **Why it is a problem**: Controllers should only handle HTTP-specific operations (extracting params, returning status codes). Writing database cleanup transactions in a controller couples the HTTP layer directly to the database schemas.
- **Potential Impact**: Deletion logic is untestable without full HTTP mocks. Any failures in intermediate delete operations can leave orphan database documents.
- **Recommended Direction**: Move account deletion logic to a `UserService` or a dedicated cleanup coordinator service.

---

## 3. MEDIUM Severity Findings

### Finding 3.1: Redundant request validation

- **Location**: `src/routes/agent.routes.js` and `src/controllers/agent.controller.js`
- **Problem**: Both the route middleware (`validateBody(createAgentSchema)`) and the controller (`createAgentSchema.parse(req.body)`) run validation parsing against the same schema.
- **Why it is a problem**: It is redundant. The validation middleware has already sanitized, validated, and overwritten `req.body`. Re-running it in the controller increases computation time and creates duplicate code.
- **Potential Impact**: Increased response latency for validation heavy payloads, and code noise.
- **Recommended Direction**: Rely on validation middleware and assume `req.body` is fully validated by the time it reaches the controller.

### Finding 3.2: Duplicated Authentication User Sync Logic

- **Locations**:
  - `src/middlewares/auth.middleware.js`
  - `src/middlewares/optionalAuthMiddleware.js`
- **Problem**: The logic to search for a local user by Clerk ID, fetch it from the Clerk SDK if missing, search by email, update Clerk ID, or create a new user is duplicated across both files.
- **Why it is a problem**: Breaks the DRY (Don't Repeat Yourself) principle. Any changes to the user syncing strategy must be duplicated in both files.
- **Potential Impact**: Inconsistencies between optional and strict auth behaviors.
- **Recommended Direction**: Extract the Clerk user database synchronization logic into a unified utility helper or service method.

### Finding 3.3: Duplicate Field Definition in Mongoose Schema

- **Location**: `src/models/User.js`
- **Problem**: The `username` field is defined twice inside the mongoose schema: once at lines 43-49, and again at lines 70-76.
- **Why it is a problem**: Redundant code definition in database schema.
- **Potential Impact**: Schema definition confusion.
- **Recommended Direction**: Delete one of the duplicate `username` definitions.

---

## 4. LOW Severity Findings

### Finding 4.1: Leftover Debug Filesystem Loggers

- **Location**: `src/middlewares/optionalAuthMiddleware.js`
- **Problem**: Commented-out filesystem write operations (`fs.appendFileSync('ownership_debug.log', ...)`) are scattered in the file.
- **Why it is a problem**: Leftover dead code and debug statements pollute clean code.
- **Potential Impact**: Noise in code readability.
- **Recommended Direction**: Remove these commented-out file logging operations.
