# persona.hasanraiyan.me Backend Documentation

Welcome to the persona.hasanraiyan.me Backend — an Express 5 REST API for the persona.hasanraiyan.me intelligent agent orchestration platform.

> **System:** Node.js | **Framework:** Express 5 | **Database:** MongoDB (Mongoose 9) | **Validation:** Zod  
> **Auth:** Clerk | **AI Stack:** LangChain, LangGraph, Deep Agents | **Email:** Resend + Mailgen  
> **Package Manager:** pnpm | **Testing:** Jest + Supertest | **Formatting:** Prettier

---

## Quick Start

```bash
# Prerequisites: Node.js 22+, pnpm 10+, MongoDB instance
cd agent-backend
cp .env.example .env        # Fill in required values
pnpm install
pnpm run dev                # Starts at http://localhost:3000
pnpm test                   # Run test suite
```

See [Getting Started →](getting-started/overview.md)

---

## Architecture

The backend uses a **domain-based modular architecture**. Each business capability lives in its own module under `src/modules/<name>/`, following a consistent `route → controller → service → repository → model` pattern.

| Document                                                                                | Description                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [Architecture Overview](architecture/overview.md)                                       | High-level architecture, motivations, design principles |
| [Request Lifecycle](architecture/request-lifecycle.md)                                  | How an HTTP request flows through the system            |
| [Module System](architecture/module-system.md)                                          | How modules are structured and organized                |
| [Dependency Rules](architecture/dependency-rules.md)                                    | Allowed and forbidden dependencies between layers       |
| [Backend Style Guide](architecture/BACKEND_STYLE_GUIDE.md)                              | SOLID principles, conventions, layer by layer           |
| [AI Memory Systems Guide](architecture/AI_AGENT_MEMORY_SYSTEMS_GUIDE.md)                | AI memory taxonomy and implementation patterns          |
| [AI Memory Research](architecture/AI_MEMORY_RESEARCH.md)                                | Memory levels mapped to this codebase                   |
| [LangChain Implementation](architecture/langchain-javascript-backend-implementation.md) | LangChain/LangGraph/Deep Agents integration             |
| [Voice & Telephony FR/NFR Specification](architecture/VOICE_AND_TELEPHONY_FR_NFR_SPECIFICATION.md) | Full requirements for Gemini Live & Twilio Voice   |
| [Workflows DAG Engine FR/NFR Specification](architecture/WORKFLOWS_DAG_ENGINE_FR_NFR_SPECIFICATION.md) | Functional & non-functional spec for DAG execution engine |
| [Dynamic Connectors & Protocols FR/NFR](architecture/DYNAMIC_CONNECTORS_AND_PROTOCOLS_FR_NFR_SPECIFICATION.md) | Spec for RCP, REST API tools, and MCP pipelines |
| [Store Backend Upgrade Plan](architecture/STORE_BACKEND_UPGRADE_PLAN.md)                | DB-backed filesystem upgrade roadmap                    |
| [Memory Implementation Plan](architecture/MEMORY_IMPLEMENTATION_PLAN.md)                | Memory persistence & personalization roadmap            |

---

## Modules

The backend is organized into domain modules under `src/modules/`:

| Module                                  | Purpose                              | Key Files                                                    |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| [Agents](modules/agents.md)             | AI agent CRUD, configuration, search | `agent.model.js`, `agent.factory.js`, `agent.service.js`     |
| [AG-UI](modules/agui.md)                | AI-agent streaming protocol (SSE)    | `agui.service.js`, `aguiTranslator.js`, `RunScopeTracker.js` |
| [Audit](modules/audit.md)               | Security & operational audit logging | `auditLog.model.js`, `auditLog.service.js`                   |
| [Auth](modules/auth.md)                 | Authentication via Clerk             | `auth.middleware.js`, `auth.service.js`                      |
| [Cron](modules/cron.md)                 | Scheduled background jobs            | `deleteInactiveUsers.js`                                     |
| [External Users](modules/external-users.md) | External end-user identities     | `externalUser.model.js`, `externalUser.service.js`           |
| [Health](modules/health.md)             | Server health checks                 | `health.controller.js`, `health.service.js`                  |
| [Knowledge](modules/knowledge.md)       | RAG knowledge bases (Qdrant)         | `knowledge.service.js`, `knowledge.tools.js`                 |
| [Mail](modules/mail.md)                 | Email sending (Resend)               | `mail.service.js`                                            |
| [MCP](modules/mcp.md)                   | Model Context Protocol connectors    | `mcp.service.js`, `mcp.tools.js`, OAuth client               |
| [Memory](modules/memory.md)             | File-based agent/user memory         | `memory-files-store.js`, `memory.service.js`                 |
| [Providers](modules/providers.md)       | LLM provider credentials             | `provider.model.js`, `provider.service.js`                   |
| [Rate Limiter](modules/rate-limiter.md) | API rate limiting                    | `rateLimiter.middleware.js`, `rateLimiter.service.js`        |
| [RCP Sources](modules/rcp-sources.md)   | Remote procedure call integrations   | `rcpSource.model.js`, `rcpSource.tools.js`                   |
| [REST API Tools](modules/rest-api-tools.md) | OpenAPI/REST dynamic tool factory| `restApiTool.model.js`, `restApiTool.service.js`             |
| [Sandbox](modules/sandbox.md)           | Isolated code execution environment  | `sandbox.service.js`, `sandbox.tools.js`                     |
| [Skills](modules/skills.md)             | Agent skill library                  | `skill.model.js`, `skillLibraryStore.js`                     |
| [Stores](modules/stores.md)             | Shared and isolated persistent files | `store.model.js`, `store.service.js`                         |
| [Threads](modules/threads.md)           | Conversation threads + checkpoints   | `thread.model.js`, `checkpoint.service.js`                   |
| [Tools](modules/tools.md)               | Agent tool registration              | `builder.tools.js`, `search.tool.js`                         |
| [Twilio](modules/twilio.md)             | Telephony bridge & media streams     | `twilioGateway.js`, `TwilioVoiceTransport.js`                |
| [Upload](modules/upload.md)             | File uploads (Multer)                | `upload.routes.js`                                           |
| [Users](modules/users.md)               | User profiles & admin                | `user.model.js`, `user.service.js`                           |
| [Voice](modules/voice.md)               | Real-time multimodal voice agent     | `voiceGateway.js`, `VoiceSession.js`, `geminiLiveClient.js`  |
| [Webhooks](modules/webhooks.md)         | Clerk webhook ingestion              | `webhook.service.js`                                         |
| [Workflows](modules/workflows.md)       | DAG multi-step workflow execution    | `workflowEngine.js`, `workflowRunDriver.js`                  |

---

## API Reference

All API routes are prefixed with `/api/v1/`.

| Document                                  | Description                              |
| ----------------------------------------- | ---------------------------------------- |
| [API Overview](api/overview.md)           | Base URL, versioning, format conventions |
| [Authentication](api/authentication.md)   | How auth works (Clerk)                   |
| [Error Format](api/errors.md)             | Error response structure and codes       |
| [Pagination](api/pagination.md)           | Paginated response format                |
| [Route Reference (Legacy)](api/ROUTES.md) | Original route table (legacy)            |

### Route Summary

| Method             | Path                     | Module    | Auth              |
| ------------------ | ------------------------ | --------- | ----------------- |
| `GET`              | `/`                      | Root      | None              |
| `GET`              | `/docs`                  | Swagger   | None              |
| `GET`              | `/openapi.json`          | OpenAPI   | None              |
| `GET`              | `/api/v1/health`         | Health    | None              |
| `GET`              | `/api/v1/health/db`      | Health    | None              |
| `GET/PATCH/DELETE` | `/api/v1/profile`        | Users     | Required          |
| `GET/DELETE`       | `/api/v1/admin/users`    | Users     | Admin             |
| `CRUD`             | `/api/v1/providers`      | Providers | Required          |
| `CRUD+Search`      | `/api/v1/agents`         | Agents    | Optional/Required |
| `CRUD`             | `/api/v1/threads`        | Threads   | Required          |
| `CRUD+Search`      | `/api/v1/skills`         | Skills    | Required          |
| `CRUD+OAuth`       | `/api/v1/mcps`           | MCP       | Required          |
| `GET/POST`         | `/api/v1/agui`           | AG-UI     | Required          |
| `POST`             | `/api/v1/upload/avatar`  | Upload    | Required          |
| `CRUD`             | `/api/v1/knowledge`      | Knowledge | Required          |
| `CRUD`             | `/api/v1/memory`         | Memory    | Required          |
| `POST`             | `/api/v1/webhooks/clerk` | Webhooks  | Svix              |

---

## Development Guides

| Guide                                                     | Description                         |
| --------------------------------------------------------- | ----------------------------------- |
| [Adding a Module](development/adding-a-module.md)         | Create a new domain module          |
| [Adding an Endpoint](development/adding-an-endpoint.md)   | Add a new API endpoint              |
| [Adding a Service](development/adding-a-service.md)       | Add business logic                  |
| [Adding a Repository](development/adding-a-repository.md) | Add database access                 |
| [Adding a Model](development/adding-a-model.md)           | Add a Mongoose model                |
| [Adding Validation](development/adding-validation.md)     | Add request validation              |
| [Testing](development/testing.md)                         | How to write and run tests          |
| [Architecture Rules](development/architecture-rules.md)   | Architectural constraints           |
| [Route Checklist](development/route-checklist.md)         | Generic endpoint creation checklist |

---

## Operations

| Document                                                     | Description                      |
| ------------------------------------------------------------ | -------------------------------- |
| [Environment Variables](operations/environment-variables.md) | All configurable env vars        |
| [Logging](operations/logging.md)                             | Logging system and configuration |
| [Health Checks](operations/health-checks.md)                 | Health check endpoints           |
| [Background Jobs](operations/background-jobs.md)             | Cron jobs and scheduled tasks    |
| [Troubleshooting](operations/troubleshooting.md)             | Common issues and solutions      |

---

## Testing

```bash
# Run all tests with coverage
pnpm test

# Watch mode
pnpm run test:watch

# AI stack smoke test
pnpm run ai:verify
```

Tests live in `agent-backend/tests/` and use **Jest** + **Supertest**.

---

## AI Coding Agent Guide

For AI coding agents working on this codebase, see [AGENTS.md](/AGENTS.md) at the repository root.

---

## Documentation Maintenance

- Keep module docs in sync with `src/modules/<name>/` structure
- Update route docs when adding/changing endpoints
- Keep environment variable docs in sync with `src/config/index.js`
- Run `pnpm test` before documenting new features

---

_Documentation updated to commit [`fe1445f`](https://github.com/hasanraiyan/agent-marketplace/commit/fe1445f) — July 2026_

> This docs revision covers the full modular architecture refactoring. If the backend has been significantly restructured since this commit, the docs should be re-audited for accuracy.
