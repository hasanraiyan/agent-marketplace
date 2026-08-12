# persona.hasanraiyan.me Backend Part

REST API backend for persona.hasanraiyan.me built with Express 5, MongoDB (Mongoose), and Zod validation.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express 5
- **Database**: MongoDB via Mongoose 9
- **Validation**: Zod
- **AI orchestration**: LangChain, LangGraph, Deep Agents
- **Encryption**: AES-256-GCM with key rotation support
- **Auth**: Clerk (external auth provider)
- **Email deps**: resend, mailgen
- **Testing**: Jest + Supertest
- **Formatting**: Prettier
- **Git hooks**: Husky + lint-staged
- **CI**: GitHub Actions
- **Package manager**: pnpm

## Architecture

The backend uses a **domain-based modular architecture** — 17 business modules under `src/modules/`, each following a consistent `route → controller → service → repository → model` pattern.

```
src/
├── index.js                    # Express app entry point
├── config/                     # Environment & service configs
├── middlewares/                 # Global error handler, Zod validation
├── modules/
│   ├── agents/                 # AI agent CRUD, factory, search
│   ├── agui/                   # AG-UI SSE streaming protocol
│   ├── auth/                   # Clerk authentication middleware
│   ├── cron/                   # Scheduled background jobs
│   ├── health/                 # Health check endpoints
│   ├── knowledge/              # RAG knowledge bases (Qdrant)
│   ├── mail/                   # Email sending (Resend)
│   ├── mcp/                    # MCP server connectors + OAuth
│   ├── memory/                 # File-based persistent memory
│   ├── providers/              # LLM provider credentials
│   ├── rateLimiter/            # API rate limiting
│   ├── skills/                 # Agent skill library
│   ├── threads/                # Conversation threads + checkpoints
│   ├── tools/                  # Agent tool registration
│   ├── upload/                 # File uploads
│   ├── users/                  # User profiles + admin
│   └── webhooks/               # Clerk webhook ingestion
├── utils/                      # Encryption, errors, formatters, logger, validators
└── docs/
    └── openapi.js              # OpenAPI/Swagger spec
```

> See [docs/README.md](docs/README.md) for the complete documentation portal including architecture guides, module docs, API reference, development guides, and operations docs.

## Prerequisites

- Node.js 22+
- pnpm 10+
- MongoDB instance

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

### Environment Variables

| Variable                      | Description                                       | Default                                |
| ----------------------------- | ------------------------------------------------- | -------------------------------------- |
| `PORT`                        | Server port                                       | `3000`                                 |
| `NODE_ENV`                    | Environment (`development`, `test`, `production`) | `development`                          |
| `MONGODB_URI`                 | MongoDB connection string                         | `mongodb://localhost:27017/persona-ai` |
| `DB_ENCRYPTION_ACTIVE_KEY_ID` | Active encryption key ID                          | —                                      |
| `DB_ENCRYPTION_KEYS`          | JSON map of key IDs to base64-encoded keys        | —                                      |
| `OPENAI_API_KEY`              | OpenAI API key for live LangChain examples        | —                                      |
| `OPENAI_MODEL`                | Default OpenAI model                              | `gpt-4.1-mini`                         |
| `ANTHROPIC_API_KEY`           | Anthropic API key for live Deep Agent examples    | —                                      |
| `ANTHROPIC_MODEL`             | Default Anthropic model                           | `claude-sonnet-4-6`                    |
| `LANGSMITH_API_KEY`           | LangSmith tracing key                             | —                                      |
| `LANGSMITH_PROJECT`           | LangSmith project name                            | `persona-ai-backend`                   |

## Running

```bash
# Development (auto-reload)
pnpm run dev

# Production
pnpm run start
```

## API Documentation

API docs and interactive reference are available at:

- **Swagger UI**: `http://localhost:3000/docs` (when server is running)
- **OpenAPI JSON**: `http://localhost:3000/openapi.json`
- **Markdown docs**: See [docs/api/](docs/api/overview.md) for the complete route table, auth flow, error codes, and pagination format.

## Testing

```bash
# Run all tests with coverage
pnpm test

# Watch mode
pnpm run test:watch

# Run the deterministic AI stack smoke test
pnpm run ai:verify
```

## AI Stack

This backend now includes a production-oriented JavaScript AI stack:

- `langchain` for prompts, chains, tools, and agents
- `@langchain/langgraph` for stateful workflow orchestration and memory
- `deepagents` for batteries-included task planning and filesystem-aware agents
- `langsmith` for observability and traces
- `CopilotKit` (v2 preview) for AI UI integration.

> [!IMPORTANT]
> This project depends on the `/v2` preview API of CopilotKit 1.56.x. Dependencies are pinned to exact version `1.56.3`. Any version bump must be treated as a migration, not a patch bump, as the `/v2` exports may move or change in future versions.

The offline verification suite lives in `scripts/verify-ai-stack.js` and `tests/test_deepagents.test.js`.

Detailed implementation guidance is documented in [docs/architecture/langchain-javascript-backend-implementation.md](docs/architecture/langchain-javascript-backend-implementation.md).

## Code Quality

```bash
# Format files
pnpm run format

# Check formatting (CI uses this)
pnpm run format:check
```

Pre-commit hooks (Husky + lint-staged) auto-format staged `.js`, `.json`, and `.md` files.

## Encryption Key Management

The backend supports AES-256-GCM field-level encryption with versioned key rotation.

### Generate a new key

```bash
pnpm run encryption:keygen
```

This prints two env lines:

```
DB_ENCRYPTION_ACTIVE_KEY_ID=key_20260327T033000Z
DB_ENCRYPTION_KEYS={"key_20260327T033000Z":"base64:..."}
```

### Rotate keys

Add a new key while keeping existing keys configured:

```bash
pnpm run encryption:keygen -- next
```

Then run the future background migration job to re-encrypt old records with the new active key. See `docs/encryption-rotation-plan.md` for the full rotation plan.

### How it works

- Encrypted tokens are stored as `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>`
- Decryption uses the embedded key ID, so old data remains readable after rotation
- `needsReencryption(token)` detects values still encrypted with a retired key

## Architecture

The codebase follows SOLID principles:

- **Repository pattern** — data access separated from business logic
- **Dependency inversion** — logger is swappable via `loggerService.setLogger()`
- **Interface segregation** — success and error formatters are independent
- **Centralized constants** — HTTP statuses, error codes, and pagination defaults in one place
- **Zod validation** — schema validation at model and middleware layers

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`:

1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Format check (`pnpm format:check`)
3. Tests (`pnpm test`)

See `CONTRIBUTING.md` for branch protection setup.
