# Module System

## What is a Module?

A module is a **self-contained directory** under `src/modules/<name>/` that owns a specific business capability. Each module follows a consistent pattern.

## Standard Module Structure

```
src/modules/<module-name>/
├── index.js                    # Barrel exports — defines public API
├── <module>.routes.js          # Express Router — defines endpoints
├── <module>.controller.js      # HTTP handlers — extracts request data
├── <module>.service.js         # Business logic
├── <module>.repository.js      # Database access
├── <module>.model.js           # Mongoose schema (if owns data)
└── <module>.validator.js       # Zod validation schemas (if needed)
```

Not every module needs all layers. Simple modules may combine or omit layers.

## Module Registration

Each module is registered in `src/index.js`:

```javascript
import { healthRouter } from './modules/health/index.js';
import { agentRouter } from './modules/agents/index.js';
// ...

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/agents', agentRouter);
```

The `index.js` barrel export controls what is public:

```javascript
// src/modules/agents/index.js
export { default as agentRouter } from './agent.routes.js';
export { default as Agent } from './agent.model.js';
export { default as agentService } from './agent.service.js';
export { default as agentFactory } from './agent.factory.js';
export { default as agentRepository } from './agent.repository.js';
// ...
```

## Module Layers

### Routes (`<module>.routes.js`)

Responsible for:

- Defining HTTP methods and paths
- Chaining middleware (auth, rate limiting, validation)
- Binding controllers to routes

```javascript
router.post('/', authMiddleware, validateBody(createSchema), controller.create);
```

### Controllers (`<module>.controller.js`)

Responsible for:

- Extracting request data (`req.body`, `req.params`, `req.query`, `req.user`)
- Calling the appropriate service method
- Formatting and sending the response
- Catching and forwarding errors to `next(err)`

**Controllers should NOT contain business logic.**

### Services (`<module>.service.js`)

Responsible for:

- Business logic and validation
- Orchestrating cross-module operations
- Coordinating multiple repository calls
- Implementing business rules

**Services should NOT directly call the database.**

### Repositories (`<module>.repository.js`)

Responsible for:

- Database queries and CRUD operations
- Query building and filtering
- Data transformation for storage/retrieval

**Repositories handle data access only — no business logic.**

### Models (`<module>.model.js`)

Responsible for:

- Mongoose schema definition
- Indexes, validations, defaults
- Virtual properties
- Model relationships (references, population)

### Validators (`<module>.validator.js`)

Responsible for:

- Zod schemas for request body validation
- Field constraints (min/max length, regex, enum values)
- Reusable schema exports

## Module Dependencies

Modules can import from:

- `src/config/` — Environment configuration
- `src/utils/` — Shared utilities (errors, formatters, logger, validators)
- Other `src/modules/<name>/` — Cross-module services/repositories
- External npm packages

Modules should NOT import from:

- Another module's internal files (only via the barrel `index.js`)
- `src/middlewares/` directly (middleware is applied in routes)

## Current Modules

| Module       | Data Owner                          | Complexity | Key Internal Dependencies                        |
| ------------ | ----------------------------------- | ---------- | ------------------------------------------------ |
| Agents       | Yes (Agent)                         | High       | Providers, Skills, MCP, Knowledge, Tools, Memory |
| AG-UI        | No                                  | High       | Agents (Factory), Threads (Checkpoints)          |
| Auth         | No                                  | Medium     | Users (Repository)                               |
| Cron         | No                                  | Low        | Users, Agents, Skills, Providers, MCP, Threads   |
| Health       | No                                  | Low        | None                                             |
| Knowledge    | Yes (KnowledgeBase, KnowledgeChunk) | High       | Qdrant, MongoDB                                  |
| Mail         | No                                  | Low        | Config (Resend)                                  |
| MCP          | Yes (Mcp, McpUserConnection)        | High       | Config (JWT), Encryption                         |
| Memory       | Yes (MemoryFile)                    | Medium     | None                                             |
| Providers    | Yes (Provider)                      | Medium     | Encryption                                       |
| Rate Limiter | No                                  | Low        | None                                             |
| Skills       | Yes (Skill)                         | Medium     | None                                             |
| Threads      | Yes (Conversation)                  | High       | None                                             |
| Tools        | No                                  | Medium     | MCP (Tools), Knowledge (Tools)                   |
| Upload       | No                                  | Low        | Auth (Middleware)                                |
| Users        | Yes (User)                          | Medium     | None                                             |
| Webhooks     | No                                  | Low        | Users (Repository)                               |

## Creating a New Module

See [Adding a Module](../development/adding-a-module.md) for step-by-step instructions.

## Module Rules

1. **One directory per domain** — No splitting a domain across multiple modules
2. **Consistent file naming** — `<module>.<layer>.js` (e.g., `agent.controller.js`)
3. **Barrel exports** — Only `index.js` exports are public; internal files are private
4. **Co-location** — All files for a domain live in its module directory
5. **No cross-module model imports** — Access another module's data through its service or repository
