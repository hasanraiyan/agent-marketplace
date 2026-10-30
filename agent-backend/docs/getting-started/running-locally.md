# Running Locally

## Prerequisites Check

```bash
node --version  # >= 22
pnpm --version  # >= 10
mongosh --version  # MongoDB client (optional, for verification)
```

## Step 1: Start MongoDB

**Local MongoDB:**

```bash
# On macOS with Homebrew
brew services start mongodb-community

# On Linux (systemd)
sudo systemctl start mongod

# On Windows (MongoDB Community Server)
net start MongoDB
```

**Or use MongoDB Atlas** — set `MONGODB_URI` in `.env` to your Atlas connection string.

## Step 2: (Optional) Start Qdrant

Only needed if using knowledge base features:

```bash
# Local Qdrant with persistent storage (no API key by default)
docker run -d --name persona-qdrant \
  -p 6333:6333 -p 6334:6334 \
  -v persona_qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

Dashboard: <http://localhost:6333/dashboard>

Then set `QDRANT_URL=http://localhost:6333` and leave `QDRANT_API_KEY` empty
in `.env`. (`QDRANT_API_KEY` is only required for Qdrant Cloud or a cluster
started with `QDRANT__SERVICE__API_KEY`.)

### Optional: local embeddings with Ollama

Instead of paying for OpenAI embeddings, run a local model:

```bash
ollama pull embeddinggemma-2
```

Then create a provider with `type: ollama` (preset Base URL
`http://localhost:11434/v1`), `defaultModel: embeddinggemma-2`, and leave the
API key empty. New knowledge bases using that provider are indexed at 768
dimensions (or 128/256/512 via `embeddingDimensions`).

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with at minimum:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Any random string (used for OAuth state signing)
- At least one AI provider API key

## Step 4: Install Dependencies

```bash
pnpm install
```

## Step 5: Start Development Server

```bash
pnpm run dev
```

The server starts with `nodemon` for auto-reload on file changes.

Expected output:

```
[INFO] 2026-... - Connecting to MongoDB
[INFO] 2026-... - MongoDB connected successfully
[INFO] 2026-... - Cron job "deleteInactiveUsers" registered with schedule: 0 3 * * *
[INFO] 2026-... - Server listening on port 3000
```

## Step 6: Verify

```bash
# Root endpoint
curl http://localhost:3000/

# Health check
curl http://localhost:3000/api/v1/health

# Health DB check
curl http://localhost:3000/api/v1/health/db

# Swagger UI (open in browser)
open http://localhost:3000/docs
```

## Production Run

```bash
NODE_ENV=production pnpm run start
```

This runs without auto-reload and enables production-level logging.

## Running Tests

```bash
# Full test suite with coverage
pnpm test

# Watch mode (auto-rerun on changes)
pnpm run test:watch

# AI stack verification (no API keys required)
pnpm run ai:verify
```

## Verifying AI Stack

```bash
pnpm run ai:verify
```

This offline smoke test verifies that LangChain, LangGraph, and Deep Agents packages are correctly installed and importable.

## Common Issues

| Issue                      | Solution                                       |
| -------------------------- | ---------------------------------------------- |
| MongoDB connection refused | Ensure MongoDB is running on `localhost:27017` |
| `pnpm: command not found`  | Install pnpm: `npm install -g pnpm`            |
| Module not found errors    | Run `pnpm install` to reinstall dependencies   |
| Port 3000 in use           | Set `PORT=3001` in `.env`                      |
| Node.js version too old    | Upgrade to Node.js 22+                         |

## Next Steps

- [Explore the Architecture](../architecture/overview.md)
- [Browse Module Documentation](../README.md#Modules)
- [Review API Endpoints](../api/overview.md)
