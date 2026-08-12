# API Overview

## Base URL

```
http://localhost:3000/api/v1
```

All API routes are prefixed with `/api/v1/`.

Exceptions:

- `GET /` — Root welcome page
- `GET /docs` — Swagger UI
- `GET /openapi.json` — OpenAPI spec download
- `POST /api/v1/webhooks/*` — Webhook routes (Clerk events)

## API Versioning

The API is versioned via the URL path prefix (`/api/v1/`). The current version is **v1**.

## Response Format

All successful responses follow a consistent format:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

### List Responses

Paginated responses use `formatList`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {
    "items": [ ... ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "pages": 10
    }
  },
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

## Error Format

All error responses follow a consistent format:

```json
{
  "success": false,
  "status": "error",
  "statusCode": 400,
  "message": "Human-readable error message",
  "code": "VALIDATION_ERROR",
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

See [Error Reference](errors.md) for all error codes.

## Available Endpoints

| Method                  | Path                     | Module     | Auth              |
| ----------------------- | ------------------------ | ---------- | ----------------- |
| `GET`                   | `/`                      | Root       | None              |
| `GET`                   | `/docs`                  | Swagger UI | None              |
| `GET`                   | `/openapi.json`          | OpenAPI    | None              |
| `GET`                   | `/api/v1/health`         | Health     | None              |
| `GET`                   | `/api/v1/health/db`      | Health     | None              |
| `GET/PATCH/DELETE`      | `/api/v1/profile`        | Users      | Required          |
| `GET/DELETE`            | `/api/v1/admin/users`    | Users      | Admin             |
| `GET/POST/PUT/DELETE`   | `/api/v1/providers`      | Providers  | Required          |
| `POST/GET/PATCH/DELETE` | `/api/v1/agents`         | Agents     | Optional/Required |
| `POST/GET/DELETE/PATCH` | `/api/v1/threads`        | Threads    | Required          |
| `GET/POST/PATCH/DELETE` | `/api/v1/skills`         | Skills     | Required          |
| `GET/POST/PATCH/DELETE` | `/api/v1/mcps`           | MCP        | Required (mostly) |
| `GET/POST`              | `/api/v1/agui`           | AG-UI      | Required          |
| `POST`                  | `/api/v1/upload/avatar`  | Upload     | Required          |
| `POST/GET/PATCH/DELETE` | `/api/v1/knowledge`      | Knowledge  | Required          |
| `GET/PUT/DELETE`        | `/api/v1/memory`         | Memory     | Required          |
| `POST`                  | `/api/v1/webhooks/clerk` | Webhooks   | Svix              |

## HTTP Methods Used

| Method   | Purpose                            |
| -------- | ---------------------------------- |
| `GET`    | Retrieve resources                 |
| `POST`   | Create resources / execute actions |
| `PATCH`  | Partial updates                    |
| `PUT`    | Full resource replacement          |
| `DELETE` | Remove resources                   |

## Request Body Format

Most endpoints accept JSON request bodies with `Content-Type: application/json`.

File uploads use `multipart/form-data` (upload and knowledge base routes).

## Headers

| Header          | Required For            | Description                                                  |
| --------------- | ----------------------- | ------------------------------------------------------------ |
| `Authorization` | Auth-required endpoints | Clerk session token (via `__session` cookie or Bearer token) |
| `x-agent-id`    | AG-UI                   | Agent ID for chat                                            |
| `x-thread-id`   | AG-UI (optional)        | Thread ID for resuming conversations                         |

## Rate Limiting

Rate-limited endpoints include headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 45
```

See [Rate Limiter](../modules/rate-limiter.md) for details.

## Swagger UI

Interactive API documentation is available at:

```
http://localhost:3000/docs
```

The OpenAPI specification is also available as JSON:

```
http://localhost:3000/openapi.json
```

> **Note:** The OpenAPI spec is partially outdated and may not reflect all current endpoints. For the most accurate reference, use the route tables in this documentation.
