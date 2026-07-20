# Rate Limiter Module

## Purpose

Provides **API rate limiting** to protect the backend from abuse. Implements a token-bucket-like algorithm with configurable windows and limits per endpoint.

## Location

`src/modules/rateLimiter/`

## Structure

```
src/modules/rateLimiter/
├── index.js                       # Barrel exports
├── rateLimiter.middleware.js      # Express middleware factory
├── rateLimiter.service.js         # Rate limiting logic
└── rateLimiter.repository.js      # In-memory storage
```

## Responsibilities

- Rate limit checks for API endpoints
- Rate limit header injection (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Retry-After header on rate limited requests
- In-memory counter storage with periodic cleanup

## Rate Limit Presets

| Preset | Max Requests | Window | Used By |
|--------|-------------|--------|---------|
| `CHAT` | 20 | 60 seconds | AG-UI chat |
| `MUTATE` | 30 | 60 seconds | Create/update/delete operations |

## Middleware Usage

```javascript
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';

// Apply to specific routes
router.post('/', 
  rateLimiter('MUTATE', RATE_LIMITS.MUTATE),
  controller.create
);

// Apply to entire router
router.use(rateLimiter('CHAT', RATE_LIMITS.CHAT));
```

## Rate Limit Response

When rate limited, the API returns:

```json
{
  "success": false,
  "status": "error",
  "statusCode": 429,
  "message": "Too many requests. Please try again in X seconds.",
  "code": "RATE_LIMIT_ERROR",
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

With headers:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 60
Retry-After: 60
```

## Architecture

The rate limiter uses an **in-memory store** by default:

- Counters are stored in a `Map<key, { count, resetTime }>`
- Keys are built as `rl:<endpoint>:<identifier>`
- Identifier is `userId` (if authenticated) or IP address (if unauthenticated)
- Expired entries are cleaned up every 60 seconds

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| None | — | Standalone module with no internal dependencies |

## Important Notes

- Rate limiting is **per-endpoint + per-user** (or per-IP for unauthenticated requests)
- The in-memory store is not shared across multiple server instances
- For production deployments with multiple replicas, replace with a Redis-backed store
