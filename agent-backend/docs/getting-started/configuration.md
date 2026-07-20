# Configuration

## Environment Files

| File | Purpose | When Used |
|------|---------|-----------|
| `.env` | Development/production configuration | `NODE_ENV != test` |
| `.env.test` | Test configuration | `NODE_ENV === test` |

Create your configuration:

```bash
cp .env.example .env
```

## Required Configuration

### MongoDB

```env
MONGODB_URI=mongodb://localhost:27017/agent-marketplace
```

Local or Atlas MongoDB connection string. The application will not start without a valid MongoDB connection.

### Authentication (Clerk)

```env
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Clerk handles all authentication. Get these from the [Clerk Dashboard](https://dashboard.clerk.com).

### JWT Secrets

```env
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

These are used for MCP OAuth state signing and password reset flows.

## Recommended Configuration

### AI Provider

At least one of these is required to run AI agents:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Email (Resend)

```env
RESEND_API_KEY=re_...
```

Required for transactional emails (verification, password reset).

## Optional Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `BACKEND_URL` | `http://localhost:3000` | Public URL for OAuth redirects |
| `WEBSITE_URL` | `https://persona.ai/` | Frontend URL for email links |
| `LANGSMITH_API_KEY` | — | LangSmith observability |
| `QDRANT_URL` | `https://your-cluster.cloud.qdrant.io` | Vector store URL |
| `QDRANT_API_KEY` | — | Vector store auth |
| `TAVILY_API_KEY` | — | Web search tool |
| `DISABLE_CRON` | `false` | Disable background jobs |
| `DEBUG` | — | Enable debug logging |

## Encryption Keys

The backend uses AES-256-GCM encryption for sensitive data (API keys, OAuth tokens).

Generate keys:

```bash
pnpm run keygen:secrets:encryption
```

This outputs two environment variables:

```env
DB_ENCRYPTION_ACTIVE_KEY_ID=key_20260327T033000Z
DB_ENCRYPTION_KEYS={"key_20260327T033000Z":"base64:..."}
```

> **⚠️ Security:** Never commit real encryption keys, API keys, or secrets to version control.

## Complete Configuration Reference

See [Environment Variables](../operations/environment-variables.md) for the full reference.
