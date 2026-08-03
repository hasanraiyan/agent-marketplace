# 08 - API Compatibility

This document records the existing public API contracts of the persona.hasanraiyan.me backend. During the refactoring, we must preserve these exact contracts to prevent breaking changes for existing frontend/mobile clients.

---

## 1. Global & Utility Endpoints

### GET `/`

- **Auth**: None
- **Description**: Root status info.
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Welcome to persona.hasanraiyan.me API",
    "version": "1.0.0",
    "database": "connected"
  }
  ```

---

## 2. Health Module

### GET `/api/v1/health`

- **Auth**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "timestamp": "2026-07-20T07:22:33Z",
      "uptime": 12.34
    },
    "message": "Server is healthy",
    "statusCode": 200
  }
  ```

### GET `/api/v1/health/db`

- **Auth**: None
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "database": "connected",
      "timestamp": "2026-07-20T07:22:33Z"
    },
    "message": "Database is healthy",
    "statusCode": 200
  }
  ```

---

## 3. Profile Module

### GET `/api/v1/profile`

- **Auth**: Required
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "user_id_string",
      "name": "User Name",
      "email": "user@example.com",
      "username": "username",
      "age": 30,
      "isActive": true,
      "role": "normal",
      "emailVerified": true,
      "profile": { "summary": "", "preferences": {} },
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

### PATCH `/api/v1/profile`

- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "Updated Name",
    "age": 31,
    "profile": {
      "summary": "Updated bio summary",
      "preferences": { "theme": "dark" }
    }
  }
  ```
- **Success Response (200 OK)**: Returns updated profile structure.

### DELETE `/api/v1/profile`

- **Auth**: Required
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": null,
    "message": "Account and all associated data deleted successfully"
  }
  ```

---

## 4. Admin Module

### GET `/api/v1/admin/users`

- **Auth**: Required (Admin role)
- **Query Params**: `page` (default 1), `limit` (default 20), `isActive` ("true" / "false")
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "users": [ ... ],
      "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1, "hasNext": false, "hasPrev": false }
    }
  }
  ```

### DELETE `/api/v1/admin/users/:id`

- **Auth**: Required (Admin role)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": { "email": "...", "name": "..." },
    "message": "User permanently deleted"
  }
  ```

---

## 5. Provider Module

### GET `/api/v1/providers`

- **Auth**: Required
- **Success Response (200 OK)**: Returns list of user's active provider metadata (excluding raw API keys).

### POST `/api/v1/providers`

- **Auth**: Required
- **Request Body**:
  ```json
  {
    "label": "OpenAI Custom",
    "baseURL": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "defaultModel": "gpt-4o",
    "isDefault": true
  }
  ```

### POST `/api/v1/providers/test-connection`

- **Auth**: Required
- **Request Body**:
  ```json
  {
    "baseURL": "https://api.openai.com/v1",
    "apiKey": "sk-..."
  }
  ```

### POST `/api/v1/providers/:id/test`

- **Auth**: Required
- **Success Response (200 OK)**: `{ "success": true, "message": "Connection successful." }`

### GET `/api/v1/providers/:id/models`

- **Auth**: Required
- **Success Response (200 OK)**: `{ "success": true, "data": [ { "id": "model-name" } ] }`

---

## 6. Agent Module

### POST `/api/v1/agents/search`

- **Auth**: Optional
- **Request Body**:
  ```json
  {
    "page": 1,
    "limit": 20,
    "search": "...",
    "category": "coding",
    "visibility": "public",
    "ownerId": "...",
    "sortBy": "newest",
    "tags": []
  }
  ```

### POST `/api/v1/agents`

- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "Agent Name",
    "description": "...",
    "systemPrompt": "System directives...",
    "providerId": "...",
    "modelName": "...",
    "visibility": "private"
  }
  ```

### GET `/api/v1/agents/:id/memory`

- **Auth**: Required
- **Success Response (200 OK)**: Returns array of user memory files metadata for this agent.

---

## 7. Thread / Conversation Module

### GET `/api/v1/threads`

- **Auth**: Required
- **Success Response (200 OK)**: Returns list of user conversation threads.

### POST `/api/v1/threads`

- **Auth**: Required
- **Request Body**:
  ```json
  {
    "agentId": "agent_id_string",
    "title": "New Thread"
  }
  ```

### GET `/api/v1/threads/:id/messages`

- **Auth**: Required
- **Success Response (200 OK)**: Returns LangGraph history array of messages + subagentTraces.

---

## 8. MCP Module

### GET `/api/v1/mcps/oauth/owner/callback`

- **Auth**: None (External callback)
- **Query Params**: `code`, `state`

### GET `/api/v1/mcps/oauth/user/callback`

- **Auth**: None (External callback)
- **Query Params**: `code`, `state`

### POST `/api/v1/mcps`

- **Auth**: Required
- **Request Body**:
  ```json
  {
    "name": "MCP Server",
    "transport": "sse",
    "url": "http://localhost:5000/sse",
    "authType": "none",
    "authMode": "owner"
  }
  ```

---

## 9. AGUI Module

### POST `/api/v1/agui`

- **Auth**: Required
- **Headers**: `x-agent-id`, `x-thread-id`
- **Request Body**:
  ```json
  {
    "messages": [{ "role": "user", "content": "hello" }],
    "resume": "...",
    "threadId": "...",
    "runId": "..."
  }
  ```
- **Success Response (200 OK)**: Text/event-stream (SSE) connection chunk outputs.

---

## 10. Webhooks Module

### POST `/api/v1/webhooks/clerk`

- **Auth**: None (SVIX signature headers required)
- **Request Body**: Raw Clerk event payload.
- **Success Response (200 OK)**: `{ "success": true, "message": "Webhook received" }`
