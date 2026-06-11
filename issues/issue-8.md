---
title: "Rate Limiting Is Dead Code — Zero Rate Limits on Any Endpoint, Including the LLM-Burning Chat Routes"
labels: bug, backend, security, cost, rate-limiting
assignees: []
---

## 🐛 Bug Report — Rate Limiter Built but Never Mounted

### Summary

The codebase contains a complete rate-limiting stack — `rateLimiter.middleware.js` (factory + presets), `rateLimiter.service.js`, `rateLimiter.repository.js` (in-memory store), and a dedicated `RateLimitError` — but **no route ever uses it**. A grep for the middleware across `src/routes/` and `src/index.js` returns nothing:

```js
// agent-backend/src/middlewares/rateLimiter.middleware.js  Line 7-14
export const RATE_LIMITS = {
  LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  REGISTER: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  ...
};
```

These presets target **auth endpoints that don't even exist** in this backend (auth is handled by Clerk — there is no `/login` or `/register` route). Meanwhile the endpoints that actually need protection have none:

| Endpoint | Cost of abuse |
|---|---|
| `POST /api/v1/agui` | Full LLM agent run per request — tokens billed against the user's stored API key; tools include live web search |
| `POST /api/v1/threads/:id/stream` | Same (legacy path) |
| `POST /api/v1/threads` | Unbounded document creation |
| `POST /api/v1/agents`, `/api/v1/skills` | Unbounded document creation |
| `POST /api/v1/providers/...` (model fetch) | Server-side `fetch()` to arbitrary `baseURL` — amplifies into SSRF-ish probing if hammered |

A single misbehaving client (or a `while(true)` loop with a valid Clerk token) can drain a user's OpenAI credits, flood MongoDB with checkpoints, and saturate the event loop with concurrent agent graphs. There is also **no concurrency cap** — nothing stops 50 simultaneous agent runs from one user.

---

## 🧠 Secondary Problem — The Store Is In-Memory

`rateLimiter.repository.js` is an `InMemoryRateLimitStore`. Even once mounted, limits reset on every deploy and aren't shared across instances (same class of problem as the in-memory HITL map in the AG-UI route). Fine for a first pass; should be Mongo/Redis-backed for production.

---

## ✅ Proposed Fix

1. Replace the orphaned auth presets with presets that match real routes, e.g.:
   - `CHAT: { maxRequests: 20, windowMs: 60_000 }` keyed by **userId** (not IP — Clerk gives us identity).
   - `MUTATE: { maxRequests: 30, windowMs: 60_000 }` for create/update/delete of agents, skills, threads, providers.
2. Mount the middleware on `agui.routes.js` (after the auth middleware so `req.user` is available) and on `thread/agent/skill/provider` routers.
3. Add a **per-user concurrent-run cap** (e.g. max 2 active agent streams) — a simple counter incremented when a run starts and decremented in `finally`.
4. Return the already-implemented `RateLimitError` → 429 with `Retry-After` (the middleware does this correctly today; it just needs callers).
5. Follow-up: swap `InMemoryRateLimitStore` for a Mongo TTL-collection or Redis implementation.

---

## 📁 Files Involved

| File | Change |
|---|---|
| `agent-backend/src/middlewares/rateLimiter.middleware.js` | Real presets; support userId-based keys |
| `agent-backend/src/routes/agui.routes.js` | Mount chat rate limit + concurrency cap |
| `agent-backend/src/routes/{thread,agent,skill,provider}.routes.js` | Mount mutation rate limits |
| `agent-backend/src/repositories/rateLimiter.repository.js` | (follow-up) durable store |
