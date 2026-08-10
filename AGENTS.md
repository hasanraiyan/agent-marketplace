# AI Coding Agent Guide

This guide helps AI coding agents understand and modify the **persona.hasanraiyan.me** repository.

> **Current Architecture (July 2026):** persona.hasanraiyan.me has three intentionally separate frontend experiences
> sharing one backend. See "Frontend Architecture" below.

## Repository Overview

**Purpose:** Agent marketplace + agent creation/runtime platform
**Backend Location:** `agent-backend/`
**Frontend Location:** `frontend/`
**SDK Location:** `sdk/` — all published SDK packages (see "SDK Directory Structure")
**Package Manager:** `pnpm`
**Runtime:** Node.js 22+ (ES Modules)
**Backend Framework:** Express 5
**Frontend Framework:** Next.js (App Router)
**Database:** MongoDB via Mongoose 9
**Auth:** Clerk (external)
**AI Stack:** LangChain, LangGraph, Deep Agents

## Frontend Architecture

### Three Experiences, One Platform

| Experience                 | URL Prefix       | Audience        | Purpose                                       |
| -------------------------- | ---------------- | --------------- | --------------------------------------------- |
| **Persona** (Consumer)     | `/dashboard/*`   | End users       | Discover, use, converse with agents           |
| **Agent Studio** (Creator) | `/studio/*`      | Agent builders  | Build, configure, test, publish               |
| **Developer Studio** (Dev) | `/developer/*`   | Platform admins | Create Projects, manage credentials/resources |

All three sit on the **same backend**, use the **same authentication**, and share the **same agent runtime** (AG-UI protocol). Agent Studio and Developer Studio are NOT separate products.

### Frontend Routes

**Persona (Consumer):**

- `/dashboard` — Discover agents (search, browse, trending)
- `/dashboard/agents` — My Agents (owned agents list)
- `/dashboard/agents/[id]` — Agent profile (consumer detail page)
- `/dashboard/agents/[id]/run` — AG-UI streaming chat

**Agent Studio (Creator):**

- `/studio` — Studio home (stats, recent agents, resources)
- `/studio/agents` — Agent management
- `/studio/agents/new` — Create agent
- `/studio/agents/[id]/build` — Agent builder (instructions, model, provider, skills, etc.)
- `/studio/agents/[id]/test` — Agent testing
- `/studio/skills` — Skill management + public marketplace
- `/studio/knowledge` — Knowledge bases (RAG)
- `/studio/connectors` — MCP connector management
- `/studio/memory` — Persistent memory
- `/studio/providers` — LLM provider configuration

**Developer Studio (Developer):**

- `/developer` — Developer Studio home (redirects to Projects)
- `/developer/projects` — Projects (external consumers of Persona's agent infrastructure)
- `/developer/projects/new` — Create Project
- `/developer/projects/[id]` — Project detail (overview, members, credentials, agents, skills, stores, knowledge, connectors, providers, audit logs)
- `/developer/projects/[id]/agents/*` — Project agents (create, edit, test)
- `/developer/projects/[id]/skills/*` — Project skills (create, edit)
- `/developer/projects/[id]/knowledge/*` — Project knowledge bases (create, detail)
- `/developer/projects/[id]/mcps/*` — Project MCP connectors (create, edit)
- `/developer/projects/[id]/providers/*` — Project AI providers (create, edit)
- `/developer/projects/[id]/stores/*` — Project stores (create, edit)

**Legacy redirects:** Several `/dashboard/*` creator routes now redirect to their `/studio/*` equivalents.

## Backend Directory Structure

```
agent-backend/
├── src/
│   ├── index.js                    # Express app entry + route registration
│   ├── config/                     # Environment configuration
│   │   ├── index.js                # Central environment config loader
│   │   ├── database.js             # MongoDB connection singleton
│   │   ├── ai.config.js            # AI provider config helpers
│   │   ├── jwt.config.js           # JWT config for OAuth state signing
│   │   └── mail.config.js          # Email provider (Resend) config
│   ├── middlewares/                 # Global middleware
│   │   ├── errorHandler.js         # Global error handler
│   │   └── validationMiddleware.js  # Zod validation middleware factory
│   ├── modules/                    # Domain modules (17 total)
│   │   ├── agents/                 # AI agent configurations
│   │   ├── agui/                   # AG-UI SSE streaming protocol
│   │   ├── auth/                   # Clerk authentication middleware
│   │   ├── cron/                   # Scheduled background jobs
│   │   ├── health/                 # Health check endpoints
│   │   ├── knowledge/              # RAG knowledge bases (Qdrant)
│   │   ├── mail/                   # Email sending (Resend + Mailgen)
│   │   ├── mcp/                    # MCP server connectors + OAuth
│   │   ├── memory/                 # File-based persistent memory
│   │   ├── providers/              # LLM provider credentials
│   │   ├── rateLimiter/            # API rate limiting
│   │   ├── skills/                 # Agent skill library
│   │   ├── threads/                # Conversation threads + checkpoints
│   │   ├── tools/                  # Agent tool registration
│   │   ├── upload/                 # File uploads (Multer)
│   │   ├── users/                  # User profiles + admin
│   │   └── webhooks/               # Clerk webhook ingestion
│   └── utils/                      # Shared utilities
│       ├── errors/                 # Custom error classes
│       ├── formatters/             # Response formatters
│       ├── logger/                 # Logger abstraction
│       ├── validators/             # Zod validation helpers
│       ├── encryption.js           # AES-256-GCM encryption
│       └── constants.js            # HTTP status codes, error codes
├── tests/                          # Jest test suite
├── scripts/                        # CLI utility scripts
└── docs/                           # Documentation
```

## SDK Directory Structure

All published SDK packages live under one `sdk/` folder. Package *names* (what users install) are
independent of their folder: `@personaai/sdk`, `@personaai/runtime`, and `persona-agent-sdk` (PyPI).

```
sdk/
├── typescript/        # @personaai/sdk — Node.js/TypeScript API client (tsup + vitest)
├── python/            # persona-agent-sdk — Python API client (hatchling + pytest)
├── runtime/           # @personaai/runtime — framework-agnostic runtime engine
├── adapters/          # future: nextjs, express, fastify, hono, nestjs, node
├── react/             # future
├── ui/                # future
└── themes/            # future
```

Each package has its own toolchain, version, and release cycle — there is **no root pnpm workspace**
unifying them (`frontend/` has its own workspace; the SDK packages do not).

## Module Structure

Every module follows this pattern (not all files are required):

```
src/modules/<name>/
├── index.js              # Barrel exports (public API)
├── <name>.routes.js      # Express Router
├── <name>.controller.js  # HTTP request handlers
├── <name>.service.js     # Business logic
├── <name>.repository.js  # Database access
├── <name>.model.js       # Mongoose schema
└── <name>.validator.js   # Zod validation schemas
```

## Module Boundaries

### Allowed Dependencies

- Route → Controller, Middleware
- Controller → Service
- Service → Service (cross-module), Repository
- Repository → Model

### Forbidden Dependencies

- Route → Model, Repository, Service (direct)
- Controller → Model, Repository
- Repository → Service, Controller

### Cross-Module Access

- Import another module via its barrel (`index.js`) only
- Access data through services/repositories, never models directly
- No circular dependencies between modules

## Coding Conventions

### 1. ES Modules

```javascript
import express from "express";
export default router;
```

### 2. Singleton Pattern

Services and repositories use singleton pattern:

```javascript
class MyService { ... }
export default new MyService();
```

### 3. Error Handling

Services throw errors; controllers catch and pass to `next(err)`:

```javascript
// Service
if (!entity) throw new NotFoundError('Entity not found');

// Controller
async getById(req, res, next) {
  try {
    const result = await service.getById(req.params.id);
    res.json(formatters.formatSuccess(result));
  } catch (err) {
    next(err);
  }
}
```

### 4. Response Format

Always use standard formatters:

```javascript
import { formatters } from "../../utils/index.js";
res.json(formatters.formatSuccess(data, "Message"));
res.json(formatters.formatList(items, total, page, limit));
```

### 5. OpenAPI Documentation (Every Route Must Have It)

Every route handler must have an `@openapi` JSDoc block above it. The spec is
auto-generated at startup by `swagger-jsdoc` — **the route file IS the spec.**
There is no separate OpenAPI file to update.

```javascript
/**
 * @openapi
 * /api/v1/agents:
 *   post:
 *     tags: [Agents]
 *     summary: Create a new agent
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, systemPrompt]
 *             properties:
 *               name:
 *                 type: string
 *               systemPrompt:
 *                 type: string
 *     responses:
 *       201:
 *         description: Agent created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", controller.create);
```

### Rules

- **Every route handler** needs an `@openapi` block — no exceptions
- **Auth-required endpoints** must include `security: [{ clerkAuth: [] }]`
- **Public endpoints** (webhooks, OAuth callbacks) must omit the `security` key
- **Path parameters** use `{param}` syntax (e.g. `/agents/{id}`)
- **Header parameters** use `in: header` (e.g. AG-UI's `x-agent-id`)
- **Multipart uploads** use content type `multipart/form-data`
- **Response codes** must match actual behavior: 201 for create, 400/401/403/404/503
- **Shared models** reference schemas via `$ref: '#/components/schemas/SchemaName'`
- **YAML indentation** is strict — exactly 2 spaces per level
- **Tags** must match the module name (e.g. `[Agents]`, `[MCP]`, `[Knowledge]`)

### 6. Validation

Use Zod schemas via `validateBody()` middleware:

```javascript
router.post("/", validateBody(createSchema), controller.create);
```

## How to Add Features

### Adding a New Module

1. Create `src/modules/<name>/` directory
2. Create model, validator, repository, service, controller, routes, index.js
3. Register routes in `src/index.js`
4. Add tests in `tests/`
5. Add documentation in `docs/modules/`

### Adding an Endpoint to Existing Module

1. Add route in `<module>.routes.js` (with appropriate auth + rate limiting)
2. Add validation schema in `<module>.validator.js` (if accepting input)
3. Add controller method in `<module>.controller.js`
4. Add service method in `<module>.service.js`
5. Add repository method in `<module>.repository.js` (if accessing DB)
6. Add tests

## Testing Requirements

```bash
# Run all tests
pnpm test

# Watch mode
pnpm run test:watch
```

- Tests live in `agent-backend/tests/`
- Use Jest + Supertest for integration tests
- Every module should have tests for controller, service, and repository layers

## Verification Commands

```bash
# Start development server
pnpm run dev

# Run tests with coverage
pnpm test

# Format code
pnpm run format

# Check formatting
pnpm run format:check

# Verify AI stack (no API keys)
pnpm run ai:verify
```

## API Compatibility Rules

1. **Never remove or rename an existing endpoint** without explicit approval
2. **Never change response format** (success/data/message/timestamp envelope is required)
3. **Never add required query params** to existing endpoints (backward compat)
4. **Never remove fields from response objects** without explicit approval
5. **New functionality must use new endpoints** — don't overload existing ones with breaking changes
6. **Versioning is via URL prefix** (`/api/v1/`) — do not add custom versioning

## Security Rules

1. **All API keys encrypted at rest** (AES-256-GCM via `src/utils/encryption.js`)
2. **All mutation endpoints behind rate limiting**
3. **Never log secrets, API keys, tokens** — use `maskedKey` patterns
4. **Authentication via Clerk** — never implement custom auth
5. **Admin endpoints require double auth** (`authMiddleware` + `adminMiddleware`)
6. **OAuth state tokens are signed** (HMAC-SHA256) with expiry

## Documentation Requirements

1. Every module must have a doc file in `docs/modules/`
2. API route tables must stay in sync with actual routes
3. Environment variables must be documented in `docs/operations/environment-variables.md`
4. Architecture diagrams must reflect actual code

## Things You Must Not Do

1. **Do not bypass service/repository boundaries** — controllers must not access models directly
2. **Do not import Mongoose models directly into controllers** — always go through service → repository
3. **Do not put business logic in routes** — routes only chain middleware and call controllers
4. **Do not change API contracts without explicit approval** — response format must remain consistent
5. **Do not introduce cross-domain model imports** — access other modules through their barrel exports
6. **Do not skip tests** — every change should have corresponding test updates
7. **Do not blindly create abstractions** — not every module needs all layers; keep simple modules simple
8. **Do not mix ES Modules and CommonJS** — no `require()`, use `import`/`export`
9. **Do not store secrets in code** — all secrets come from environment variables
10. **Do not create circular dependencies** — Module A → Module B → Module A

## Agent Memory Implementation Note

The memory system uses a **file-based store** backed by MongoDB (not `InMemoryStore`). Memory survives restarts.

- `/memories/user/` — User-level (shared across all agents)
- `/memories/agent/` — Agent-level (per user-agent pair)
- `/skills/` — Read-only skill filesystem
- `/skill-library/` — Read-write skill authoring

## Key Entry Points

| File                                                | Purpose                                       |
| --------------------------------------------------- | --------------------------------------------- |
| `agent-backend/src/index.js`                        | Express app setup, middleware, route mounting |
| `agent-backend/src/config/index.js`                 | Environment variable loading and defaults     |
| `agent-backend/src/modules/agents/agent.factory.js` | Agent graph compilation (most complex file)   |
| `agent-backend/src/modules/agui/aguiTranslator.js`  | LangGraph → AG-UI event translation           |
| `agent-backend/src/middlewares/errorHandler.js`     | Global error handling                         |
| `frontend/src/lib/studio-routes.js`                 | Canonical Studio route definitions            |
| `frontend/src/lib/developer-routes.js`             | Canonical Developer Studio route definitions  |
| `frontend/src/app/dashboard/page.jsx`               | Persona consumer home (agent discovery)       |
| `frontend/src/app/studio/page.jsx`                  | Agent Studio home                             |
| `frontend/src/app/developer/page.jsx`              | Developer Studio home (redirects to Projects) |
| `sdk/typescript/src/index.ts`                       | TypeScript SDK client (`@personaai/sdk`) exports |
| `sdk/python/src/personaai/client.py`                | Python SDK client (`persona-agent-sdk`) entry    |
| `sdk/runtime/src/runtime.ts`                        | Runtime engine (`@personaai/runtime`) core        |

## Configuration

All environment variables are loaded in `src/config/index.js`. Key ones:

```
MONGODB_URI          — MongoDB connection string
CLERK_SECRET_KEY     — Clerk secret for auth
JWT_SECRET           — Used for OAuth state signing
OPENAI_API_KEY       — Default AI provider
ANTHROPIC_API_KEY    — Alternative AI provider
QDRANT_URL           — Vector store URL
RESEND_API_KEY       — Email delivery
TAVILY_API_KEY       — Web search
```

See `docs/operations/environment-variables.md` for complete reference.

## Documentation

Full documentation is available in `docs/README.md` and includes:

- Getting started guides
- Architecture documentation
- Module documentation (all 17 modules)
- API reference
- Development how-to guides
- Operations guides
