# API Routes Reference

All routes are prefixed with `/api/v1` unless noted otherwise.

---

## Root / Docs

| Method | Path            | Purpose                           | Auth |
| ------ | --------------- | --------------------------------- | ---- |
| GET    | `/`             | Welcome / API info with DB status | None |
| GET    | `/docs`         | Swagger UI documentation          | None |
| GET    | `/openapi.json` | OpenAPI spec JSON                 | None |

---

## Health — `/api/v1/health`

| Method | Path         | Purpose                      | Auth |
| ------ | ------------ | ---------------------------- | ---- |
| GET    | `/health`    | Overall server health status | None |
| GET    | `/health/db` | Database connection health   | None |

---

## Profile — `/api/v1/profile`

| Method | Path       | Purpose                             | Auth     |
| ------ | ---------- | ----------------------------------- | -------- |
| GET    | `/profile` | Get authenticated user's profile    | Required |
| PATCH  | `/profile` | Update authenticated user's profile | Required |

---

## Admin — `/api/v1/admin`

| Method | Path               | Purpose                      | Auth       |
| ------ | ------------------ | ---------------------------- | ---------- |
| GET    | `/admin/users`     | List all users in the system | Admin only |
| DELETE | `/admin/users/:id` | Delete a specific user by ID | Admin only |

---

## Providers — `/api/v1/providers`

| Method | Path                         | Purpose                                  | Auth     |
| ------ | ---------------------------- | ---------------------------------------- | -------- |
| GET    | `/providers`                 | Get all providers for authenticated user | Required |
| POST   | `/providers`                 | Create a new provider                    | Required |
| POST   | `/providers/test-connection` | Test provider credentials (no ID)        | Required |
| POST   | `/providers/:id/test`        | Test connection for a specific provider  | Required |
| GET    | `/providers/:id/models`      | Get available models for a provider      | Required |
| PUT    | `/providers/:id`             | Update an existing provider              | Required |
| DELETE | `/providers/:id`             | Delete a provider                        | Required |

---

## Agents — `/api/v1/agents`

| Method | Path                 | Purpose                               | Auth     |
| ------ | -------------------- | ------------------------------------- | -------- |
| POST   | `/agents/search`     | Search agents with advanced filters   | Optional |
| POST   | `/agents/count`      | Get count of agents matching criteria | Optional |
| GET    | `/agents/slug/:slug` | Get agent by slug identifier          | Optional |
| GET    | `/agents/:id`        | Get a specific agent by ID            | Optional |
| POST   | `/agents`            | Create a new agent                    | Required |
| PATCH  | `/agents/:id`        | Update an existing agent              | Required |
| DELETE | `/agents/:id`        | Delete an agent                       | Required |

---

## Threads — `/api/v1/threads`

| Method | Path                    | Purpose                                | Auth     |
| ------ | ----------------------- | -------------------------------------- | -------- |
| POST   | `/threads`              | Create a new conversation thread       | Required |
| GET    | `/threads`              | Get all threads for authenticated user | Required |
| GET    | `/threads/:id`          | Get a specific thread by ID            | Required |
| DELETE | `/threads/:id`          | Delete a thread                        | Required |
| PATCH  | `/threads/:id/title`    | Update thread title                    | Required |
| GET    | `/threads/:id/messages` | Get all messages in a thread           | Required |
| POST   | `/threads/:id/stream`   | Stream chat responses (SSE)            | Required |
| POST   | `/threads/:id/actions`  | Handle thread actions / commands       | Required |

---

## Skills — `/api/v1/skills`

| Method | Path             | Purpose                             | Auth     |
| ------ | ---------------- | ----------------------------------- | -------- |
| GET    | `/skills/public` | Get publicly available skills       | Optional |
| GET    | `/skills`        | Get authenticated user's own skills | Required |
| POST   | `/skills`        | Create a new skill                  | Required |
| GET    | `/skills/:id`    | Get a specific skill by ID          | Required |
| PATCH  | `/skills/:id`    | Update an existing skill            | Required |
| DELETE | `/skills/:id`    | Delete a skill                      | Required |

---

## MCP (Model Context Protocol) — `/api/v1/mcps`

| Method | Path                   | Purpose                                    | Auth     |
| ------ | ---------------------- | ------------------------------------------ | -------- |
| GET    | `/mcps`                | Get all MCP servers for authenticated user | Required |
| POST   | `/mcps`                | Register a new MCP server                  | Required |
| GET    | `/mcps/:id`            | Get a specific MCP server                  | Required |
| PATCH  | `/mcps/:id`            | Update an existing MCP server              | Required |
| DELETE | `/mcps/:id`            | Delete an MCP server                       | Required |
| GET    | `/mcps/:id/tools`      | List tools exposed by an MCP server        | Required |
| POST   | `/mcps/:id/connect`    | Connect user to an MCP server              | Required |
| DELETE | `/mcps/:id/disconnect` | Disconnect user from an MCP server         | Required |
| GET    | `/mcps/connections`    | Get all user-MCP connections               | Required |

---

## Knowledge Bases — `/api/v1/knowledge`

| Method | Path                    | Purpose                                        | Auth     |
| ------ | ----------------------- | ---------------------------------------------- | -------- |
| GET    | `/knowledge`            | Get all knowledge bases for authenticated user | Required |
| POST   | `/knowledge`            | Create a new knowledge base                    | Required |
| GET    | `/knowledge/:id`        | Get a specific knowledge base                  | Required |
| DELETE | `/knowledge/:id`        | Delete a knowledge base                        | Required |
| POST   | `/knowledge/:id/upload` | Upload documents to a knowledge base           | Required |
| POST   | `/knowledge/:id/search` | Search within a knowledge base (RAG)           | Required |

---

## Memory — `/api/v1/memories`

| Method | Path                  | Purpose                                 | Auth     |
| ------ | --------------------- | --------------------------------------- | -------- |
| GET    | `/memories`           | Get all memories for authenticated user | Required |
| POST   | `/memories`           | Create or update a memory entry         | Required |
| DELETE | `/memories/:id`       | Delete a specific memory entry          | Required |
| GET    | `/memories/agent/:id` | Get memories scoped to a specific agent | Required |

---

## Webhooks — `/api/v1/webhooks`

| Method | Path              | Purpose                                      | Auth           |
| ------ | ----------------- | -------------------------------------------- | -------------- |
| POST   | `/webhooks/clerk` | Clerk auth webhook for user lifecycle events | Svix signature |

**Events handled by the Clerk webhook:**

- `user.created` — creates the user record in the database
- `user.deleted` — removes the user record from the database

---

## Upload — `/api/v1/upload`

| Method | Path                | Purpose                          | Auth     |
| ------ | ------------------- | -------------------------------- | -------- |
| POST   | `/upload`           | Upload a file (avatar, document) | Required |
| POST   | `/upload/avatar`    | Upload agent avatar image        | Required |
| POST   | `/upload/knowledge` | Upload knowledge document        | Required |

---

## Summary

| Group       | Routes |
| ----------- | ------ |
| Root / Docs | 3      |
| Health      | 2      |
| Profile     | 2      |
| Admin       | 2      |
| Providers   | 7      |
| Agents      | 7      |
| Threads     | 8      |
| Skills      | 6      |
| MCP         | 9      |
| Knowledge   | 6      |
| Memory      | 4      |
| Webhooks    | 1      |
| Upload      | 3      |
| **Total**   | **60** |

**Auth levels:**

- **None** — public, no token needed
- **Optional** — works for both authenticated and unauthenticated requests
- **Required** — valid JWT via `authMiddleware`
- **Admin only** — requires JWT + admin role via `adminMiddleware`
- **Svix signature** — Clerk webhook signature verification
