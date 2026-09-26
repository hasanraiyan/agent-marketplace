# Idempotency Module

The **Idempotency** module provides guaranteed once-and-only-once execution semantics for HTTP mutation requests on the Developer Platform.

## Overview

When network retries, timeouts, or client replays occur, duplicate creations (e.g. creating duplicate agents, double-charging, or redundant workflow runs) must be strictly prevented. The Idempotency module intercepts incoming `POST` requests bearing an `Idempotency-Key` header, caches the initial response status and body in MongoDB, and replays that cached response for subsequent identical requests.

## Directory Structure

```
src/modules/idempotency/
└── idempotencyKey.model.js  # Mongoose model for IdempotencyKey (cacheKey, statusCode, responseBody, createdAt TTL)
```

## How It Works

1. **Header Detection**: The client sends an `Idempotency-Key: <unique-uuid-or-hash>` header on mutation requests (`POST /api/v1/developer/*`).
2. **Cache Key Formation**: The key is bound to the tenant domain and request method to prevent collision:
   `cacheKey = ${req.developerDomain}:${idempotencyKey}:${req.method}:${req.baseUrl}`.
3. **Cache Lookup**:
   - If an entry is found, the middleware intercepts the request immediately and returns the cached HTTP status code and response payload with header `X-Cache: HIT`.
   - If no entry is found, the request proceeds to the route handler and controller.
4. **Response Caching**: An override on `res.json()` records the outgoing response body and HTTP status code asynchronously into the `IdempotencyKey` collection.
5. **TTL Automatic Eviction**: MongoDB TTL indexes automatically expire and remove idempotency documents after 24 hours (86,400 seconds).

## Key Files & Middleware

- `idempotencyKey.model.js`: Mongoose collection definition with TTL expiration.
- `src/middlewares/idempotencyMiddleware.js`: Express middleware factory applied across Developer routes (`developerAgent.routes.js`, `developerFile.routes.js`, `developerSkill.routes.js`, etc.).
