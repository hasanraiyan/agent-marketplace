# Health Module

## Purpose

Provides **health check endpoints** for monitoring server and database connectivity. Used by load balancers, monitoring systems, and deployment pipelines.

## Location

`src/modules/health/`

## Structure

```
src/modules/health/
├── index.js                # Barrel exports
├── health.routes.js        # REST API routes
├── health.controller.js    # HTTP handlers
├── health.service.js       # Business logic
└── health.repository.js    # Database access
```

## Responsibilities

- Server health status reporting
- Database connectivity checking
- Uptime tracking

## Public API

| Method | Path                | Auth | Purpose                           |
| ------ | ------------------- | ---- | --------------------------------- |
| `GET`  | `/api/v1/health`    | None | Overall server health with uptime |
| `GET`  | `/api/v1/health/db` | None | Database connectivity check       |

## Response Format

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Health check successful",
  "data": {
    "status": "healthy",
    "uptime": 12345.67,
    "timestamp": "2026-07-20T12:00:00.000Z"
  },
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

## Dependencies

| Dependency | Type     | Purpose                     |
| ---------- | -------- | --------------------------- |
| MongoDB    | External | Database connectivity check |

## Important Notes

- Health endpoints are **public** (no authentication required)
- No rate limiting applied
- `/health/db` returns 200 if DB is connected, 503 if disconnected
- Part of the root health info shown at `GET /`
