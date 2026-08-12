# Troubleshooting

## Common Startup Issues

### MongoDB Connection Refused

```
MongoDB connection error: MongoServerSelectionError: connect ECONNREFUSED ::1:27017
```

**Solutions:**

1. Ensure MongoDB is running: `mongosh` (should connect)
2. Check `MONGODB_URI` in `.env` — default is `mongodb://127.0.0.1:27017/agent-marketplace`
3. If using MongoDB Atlas, verify the connection string includes username/password
4. Check firewall/mDNS: try `127.0.0.1` instead of `localhost`

### Missing Environment Variables

```
Cannot read properties of undefined (reading 'secret')
```

**Solutions:**

1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Fill in required values: `MONGODB_URI`, `JWT_SECRET`, `CLERK_SECRET_KEY`
3. Generate encryption keys: `pnpm run keygen:secrets:encryption`

### Port Already in Use

```
listen EADDRINUSE :::3000
```

**Solutions:**

1. Set a different port: `PORT=3001` in `.env`
2. Find and kill the process: `lsof -ti:3000 | xargs kill`

## Common Runtime Issues

### API Key Decryption Failed

```
Stored API key for provider "..." cannot be decrypted (encryption key mismatch)
```

**Causes:**

- Encryption keys were rotated without re-encrypting stored keys
- `.env` has different `DB_ENCRYPTION_KEYS` than when the key was stored

**Solutions:**

1. Re-enter the API key in the provider settings (this re-encrypts it)
2. Ensure `DB_ENCRYPTION_ACTIVE_KEY_ID` matches a key in `DB_ENCRYPTION_KEYS`

### Agent Chat Returns "No Provider Configured"

```
Error: No provider configured. Please add a provider (API Key) in settings first.
```

**Solutions:**

1. Create a provider via `POST /api/v1/providers`
2. Ensure the provider has a valid API key (not a placeholder)
3. Set it as the default provider if using the Architect agent

### MCP OAuth Callback Fails

```
Error: OAuth state token expired
```

**Solutions:**

1. Complete the OAuth flow within 10 minutes (the state token expiry)
2. Ensure `BACKEND_URL` is correctly configured — the callback URL must match what's registered with the OAuth provider
3. Check that `JWT_SECRET` is consistent across restarts (state is signed with this secret)

### Web Search Not Working

**Solutions:**

1. Set `TAVILY_API_KEY` in environment
2. Enable `webSearchEnabled` on the agent configuration
3. Verify Tavily API key is valid

### Knowledge Base Search Returns No Results

**Solutions:**

1. Verify Qdrant is running: `curl http://localhost:6333/health`
2. Upload documents via `POST /api/v1/knowledge/:id/upload`
3. Check Qdrant API key configuration
4. Verify the embedding model is accessible

## Common AG-UI / Streaming Issues

### Chat Messages Not Streaming

**Solutions:**

1. Check browser console for SSE errors
2. Verify `x-agent-id` header is being sent
3. Check that the agent has a valid provider with API key
4. Look for server-side errors in the backend logs

### Tool Call Results Not Appearing

**Solutions:**

1. Check if the tool is HITL-guarded and requires user approval
2. Verify the MCP server is running and accessible
3. Check for tool call errors in the server logs

### Chat Suddenly Stops / Aborts

**Solutions:**

1. Check if client disconnected (AbortController signal)
2. Check for provider API errors (rate limits, quota exceeded)
3. Check for timeout in long-running tool executions

## Database Issues

### Duplicate Key Errors

```
E11000 duplicate key error collection
```

**Solutions:**

1. Check for duplicate slugs on agent creation
2. Check for duplicate email addresses
3. Check for duplicate MCP server names per user

### Slow Queries

**Solutions:**

1. Ensure MongoDB indexes are created (check model files)
2. Use `.select()` to limit returned fields
3. Add pagination to list endpoints

## Deployment Issues

### Server Fails to Start in Production

**Solutions:**

1. Check `NODE_ENV=production` is set
2. Verify all required environment variables are set
3. Check that `pnpm install` was run (no `devDependencies` in production)

### Graceful Shutdown Not Working

**Solutions:**

1. Make sure `SIGINT` and `SIGTERM` signals are being sent correctly
2. Check that `stopAllCronJobs()` is called
3. Check that `database.closeConnection()` completes

## Debugging Checklist

When encountering an issue:

1. **Check logs** — Look for `[ERROR]` entries with stack traces
2. **Verify environment** — Run `node src/config/index.js` to check loaded config
3. **Check MongoDB** — `mongosh` to verify connection and data
4. **Check Clerk** — Verify session token is valid in Clerk dashboard
5. **Check AI provider** — Verify API key has available quota
6. **Enable debug logging** — Set `DEBUG=true` for verbose output
7. **Check test suite** — Run `pnpm test` to rule out code issues

## Getting Help

- **Logs:** Check `[ERROR]` entries — most issues are logged with context
- **Test suite:** `pnpm test` validates core functionality
- **AI verify:** `pnpm run ai:verify` verifies AI stack integrity
- **Documentation:** Start at `docs/README.md`
