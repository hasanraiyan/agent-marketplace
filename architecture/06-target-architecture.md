# 06 - Target Architecture

This document describes the target modular architecture for the persona.hasanraiyan.me backend, designed to achieve the high architectural standards of NestJS (domain separation, single responsibility, clear dependency flow) while preserving the simplicity of Express.js.

---

## 1. Domain-Based Module Structure

We will transition the codebase from a technical-layer architecture (where files are sorted by files type like controllers, routes, models) to a **Feature/Domain-Based Module Architecture**.

All features will reside in `src/modules/` with the following structure:

```
src/
  config/                          # Global config singletons (e.g. index.js, database.js)
  middlewares/                     # Global HTTP cross-cutting concerns (CORS, errorHandler, request log)
  modules/                         # Domain-specific logic
    auth/                          # Auth domain
      auth.middleware.js           # Strict auth checker
      optional-auth.middleware.js  # Guest/User auth checker
      auth.service.js              # Clerk user synchronization logic
    users/                         # User & profile domain
      profile.routes.js
      profile.controller.js
      admin.routes.js
      admin.controller.js
      user.service.js              # Business logic (e.g. account cleanups/deletions)
      user.repository.js
      user.model.js                # Mongoose model + Zod schemas
      user.validator.js            # Input schemas
    providers/                     # AI Providers domain
      provider.routes.js
      provider.controller.js
      provider.service.js
      provider.repository.js
      provider.model.js
      provider.validator.js
    agents/                        # Agent domain
      agent.routes.js
      agent.controller.js
      agent.service.js
      agent.repository.js
      agent.model.js
      agent.validator.js
      agent.factory.js             # Factory class to build LangGraph instances
      memory.model.js              # Memory files collection
    threads/                       # Conversation / checkpointer domain
      thread.routes.js
      thread.controller.js
      thread.repository.js
      thread.model.js
      thread.validator.js
      checkpoint.service.js        # LangGraph checkpointer / MongoDB saver logic
    skills/                        # Agent skills domain
      skill.routes.js
      skill.controller.js
      skill.service.js
      skill.repository.js
      skill.model.js
      skill.validator.js
    mcps/                          # MCP domain
      mcp.routes.js
      mcp.controller.js
      mcp.service.js
      mcp.repository.js
      mcp.model.js
      mcp.validator.js
      mcp-token.service.js
      mcp-connection.model.js
    agui/                          # Chat UI stream domain
      agui.routes.js
      agui.controller.js           # Manages SSE response headers & AbortController bindings
      agui.service.js              # Stream generator & translator orchestration
    webhooks/                      # Webhook receiver domain
      webhook.routes.js
      webhook.controller.js        # Clerk webhook verification and delegation
    knowledge/                     # Knowledge base & Vector domain
      knowledge.routes.js
      knowledge.controller.js
      knowledge.service.js
      knowledge.repository.js
      knowledge.model.js
      knowledge.validator.js
      chunk.model.js
  utils/                           # Reusable framework utilities
    errors/                        # BaseError and custom exceptions
    formatters/                    # successFormatter / errorFormatter
    logger/                        # ConsoleLogger / index.js
    validators/                    # schemaValidator
    encryption.js                  # Field encryption helpers
```

---

## 2. Standard Layer Responsibilities

To maintain a clean separation of concerns, each layer must adhere to strict responsibilities:

### A. Routes (`*.routes.js`)

- **Role**: Define HTTP endpoints and bind paths.
- **Operations**: Attach validation middleware, rate limiters, and authentication guards.
- **Dependencies**: Can only import middlewares, validators, and controllers. No services or models.

### B. Middlewares (`*.middleware.js`)

- **Role**: Intercept request execution to perform cross-cutting tasks (auth checks, rate limiting, request validation parsing).
- **Operations**: Extract tokens, execute schema validators, parse raw parameters.
- **Dependencies**: Can call services (e.g. `authService`) or utilities.

### C. Controllers (`*.controller.js`)

- **Role**: Handle HTTP concerns.
- **Operations**: Extract request parameters, body, headers, and query strings. Call service methods, handle service exceptions, and construct HTTP responses via the standardized `successFormatter`.
- **Dependencies**: Can only call services. No direct database queries or model imports.

### D. Services (`*.service.js`)

- **Role**: House core business logic.
- **Operations**: Run computations, format safe outputs, orchestrate transactions, verify cross-domain rules.
- **Dependencies**: Can import repositories or utilities. Cannot access Express `req`/`res` objects.

### E. Repositories (`*.repository.js`)

- **Role**: Abstract database storage engine details.
- **Operations**: Perform queries (`find`, `create`, `update`, `delete`, pagination aggregates).
- **Dependencies**: Import database models or client libraries (e.g., Mongoose, Qdrant). No controllers or services.

### F. Models / Schemas (`*.model.js` / `*.validator.js`)

- **Role**: Define data structures, type constraints, and schema shapes.
- **Operations**: Validate raw JavaScript objects via Zod, model MongoDB collections via Mongoose.

---

## 3. Dependency Direction Rule

To prevent tight coupling and circular references, dependency imports must propagate in one direction:

```
[Route] ──> [Controller] ──> [Service] ──> [Repository] ──> [Model]
```

### Rule Violations (Forbidden Imports)

1. **Controllers importing Models directly**: All queries must pass through a service or repository.
2. **Services importing other domain Models directly**: A service can only import its own domain's repository or call other domain's services/repositories.
3. **Services accessing HTTP layer parameters**: Services must accept raw JavaScript types (IDs, objects) and never accept Express `req` or `res` objects.
