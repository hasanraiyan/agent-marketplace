# Environment Variables

## Overview

All environment variables are loaded in `src/config/index.js` using `dotenv`. Variables are loaded from `.env` (development/production) or `.env.test` (test environment).

## Core

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment (`development`, `test`, `production`) |
| `BACKEND_URL` | No | `https://api.persona.hasanraiyan.me` | Public URL (used for MCP OAuth redirect URIs) |
| `WEBSITE_URL` | No | `https://persona.ai/` | Frontend URL (used in email links) |
| `DISABLE_CRON` | No | `false` | Set to `true` to disable all scheduled jobs |

## Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | **Yes** | `mongodb://127.0.0.1:27017/agent-marketplace` | MongoDB connection string |
| `DB_ENCRYPTION_ACTIVE_KEY_ID` | **Yes*** | — | Active encryption key ID for AES-256-GCM |
| `DB_ENCRYPTION_KEYS` | **Yes*** | — | JSON map of key IDs to base64-encoded encryption keys |

> * Required if any encrypted data is stored (API keys, OAuth tokens)

## Authentication (Clerk)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLERK_PUBLISHABLE_KEY` | **Yes** | — | Clerk publishable key |
| `CLERK_SECRET_KEY` | **Yes** | — | Clerk secret key |

## JWT / OAuth State

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | — | Secret key for signing OAuth state tokens (HMAC-SHA256) |
| `JWT_EXPIRES_IN` | No | `15m` | Token expiry (not actively used — Clerk handles auth) |
| `JWT_REFRESH_SECRET` | **Yes*** | — | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiry |

> `JWT_SECRET` is the most important — it's used for OAuth state signing which is critical for MCP OAuth flow security.

## AI / LLM

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | **Yes*** | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4.1-mini` | Default OpenAI model |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Default Anthropic model |
| `TAVILY_API_KEY` | No | — | Tavily web search API key |

> * At least one AI provider API key is required for agent functionality

## Observability

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LANGSMITH_API_KEY` | No | — | LangSmith API key for tracing |
| `LANGSMITH_PROJECT` | No | `persona-ai-backend` | LangSmith project name |
| `LANGSMITH_ENDPOINT` | No | `https://api.smith.langchain.com` | LangSmith endpoint |

> **Note:** LangSmith tracing is currently disabled due to a bug where subagent callbacks fire twice through `streamEvents`.

## Knowledge Base / Vector Store

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QDRANT_URL` | **Yes*** | `https://your-cluster.cloud.qdrant.io` | Qdrant cluster URL |
| `QDRANT_API_KEY` | **Yes*** | — | Qdrant API key |
| `KNOWLEDGE_EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model for document vectors |
| `KNOWLEDGE_CHUNK_SIZE` | No | `800` | Document chunk size (characters) |
| `KNOWLEDGE_CHUNK_OVERLAP` | No | `100` | Chunk overlap (characters) |
| `KNOWLEDGE_TOP_K` | No | `5` | Default search result count |

> * Required if using knowledge base features

## Email

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | **Yes*** | — | Resend API key for email delivery |
| `MAIL_FROM` | No | `Persona.ai <noreply@persona.ai>` | Sender email address |

> * Required for transactional emails (verification, password reset)

## Cron / Background Jobs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRON_DELETE_INACTIVE_USERS` | No | `0 3 * * *` | Cron schedule for inactive user cleanup |
| `CRON_CLEAN_EXPIRED_OTPS` | No | `0 */6 * * *` | Cron schedule for expired OTP cleanup |
| `ACCOUNT_RETENTION_DAYS` | No | `30` | Days before inactive accounts are purged |

## Debug

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEBUG` | No | — | Enable verbose debug logging |

## Environment-Specific Variables

### Required in All Environments
- `MONGODB_URI`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `JWT_SECRET`
- At least one AI provider API key

### Required in Production Only
- `BACKEND_URL` (must be actual domain, not localhost)
- `WEBSITE_URL` (must be actual domain)
- Strong encryption keys
- `QDRANT_URL` and `QDRANT_API_KEY`
- `RESEND_API_KEY`

### Development-Only
None specific — all variables have development-safe defaults.

## Generating Secrets

```bash
# Generate encryption key
pnpm run keygen:secrets:encryption

# Generate JWT secrets
pnpm run keygen:secrets:jwt
```

## Security Notes

1. **Never commit** `.env` files to version control
2. **Rotate encryption keys** periodically using `DB_ENCRYPTION_KEYS` map
3. **Never log** API keys, tokens, or secrets
4. **Use placeholder values** in `.env.example` — never real credentials
5. **Generate strong secrets** for `JWT_SECRET` and encryption keys
