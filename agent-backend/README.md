# Persona.ai Backend Part

REST API backend for Persona.ai built with Express 5, MongoDB (Mongoose), and Zod validation.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express 5
- **Database**: MongoDB via Mongoose 9
- **Validation**: Zod
- **AI orchestration**: LangChain, LangGraph, Deep Agents
- **Encryption**: AES-256-GCM with key rotation support
- **Auth deps**: bcrypt, jsonwebtoken
- **Email deps**: resend, mailgen
- **Testing**: Jest + Supertest
- **Formatting**: Prettier
- **Git hooks**: Husky + lint-staged
- **CI**: GitHub Actions
- **Package manager**: pnpm

## Project Structure

```
backend/
 src/
   index.js                        # Express app entry point
   config/
     index.js                      # Environment config loader
     database.js                   # MongoDB connection singleton
   controllers/
     healthController.js           # Health check endpoint
   middlewares/
     errorHandler.js               # Global error handler
     validationMiddleware.js       # Zod-based request validation
   models/
     User.js                       # Mongoose + Zod User model
     index.js
   repositories/
     healthRepository.js           # Server status data
     userRepository.js             # User CRUD operations
     index.js
   routes/
     health.js                     # /health route
   services/
     healthService.js              # Health check business logic
   utils/
     constants.js                  # HTTP status codes, error codes, pagination defaults
     encryption.js                 # AES-256-GCM encrypt/decrypt with key rotation
     index.js                      # Central utils export
     errors/
       BaseError.js                # Abstract error base class
       ValidationError.js          # 400 validation errors
       NotFoundError.js            # 404 not found errors
     formatters/
       successFormatter.js         # Standardized success responses
       errorFormatter.js           # Standardized error responses
     logger/
       ConsoleLogger.js            # Default console logger
       index.js                    # Logger singleton (swappable)
     validators/
       schemaValidator.js          # Zod validation helpers + reusable schemas
  ai/
    config.js                    # AI provider/env helpers
    examples.js                  # LangChain, LangGraph, and Deep Agents examples
    index.js                     # AI module exports
 scripts/
   generate-encryption-key.js      # CLI tool for encryption key generation
  verify-ai-stack.js              # Offline LangChain/LangGraph/Deep Agents verification
 tests/                            # Jest test suite
 docs/
   encryption-rotation-plan.md     # Key rotation migration design
```

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

| Variable                      | Description                                       | Default                                       |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------- |
| `PORT`                        | Server port                                       | `3000`                                        |
| `NODE_ENV`                    | Environment (`development`, `test`, `production`) | `development`                                 |
| `MONGODB_URI`                 | MongoDB connection string                         | `mongodb://localhost:27017/persona-ai` |
| `DB_ENCRYPTION_ACTIVE_KEY_ID` | Active encryption key ID                          | —                                             |
| `DB_ENCRYPTION_KEYS`          | JSON map of key IDs to base64-encoded keys        | —                                             |
| `OPENAI_API_KEY`              | OpenAI API key for live LangChain examples        | —                                             |
| `OPENAI_MODEL`                | Default OpenAI model                              | `gpt-4.1-mini`                                |
| `ANTHROPIC_API_KEY`           | Anthropic API key for live Deep Agent examples    | —                                             |
| `ANTHROPIC_MODEL`             | Default Anthropic model                           | `claude-sonnet-4-6`                           |
| `LANGSMITH_API_KEY`           | LangSmith tracing key                             | —                                             |
| `LANGSMITH_PROJECT`           | LangSmith project name                            | `persona-ai-backend`                   |

## Running

```bash
# Development (auto-reload)
pnpm run dev

# Production
pnpm run start
```

## API Endpoints

| Method | Path         | Description                                  |
| ------ | ------------ | -------------------------------------------- |
| GET    | `/`          | Root — server status and DB connection state |
| GET    | `/health`    | Health check with uptime                     |
| GET    | `/health/db` | Database connectivity check                  |

## API Documentation

- **Swagger UI**: Interactive API documentation is served at `/docs` when the server is running (e.g. `http://localhost:3000/docs`). The OpenAPI specification lives at `src/docs/openapi.js`.

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

The offline examples and verification suite live in `src/ai/`, `scripts/verify-ai-stack.js`, and `tests/aiExamples.test.js`.

Detailed implementation guidance is documented in `docs/langchain-javascript-backend-implementation.md`.

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
