# 03 - Request Lifecycles

This document traces the request-response lifecycle of five representative API endpoints in the persona.hasanraiyan.me backend to visualize how data flows through our current layers.

---

## 1. Public Endpoint Trace: Server Status (`GET /`)

This public endpoint requires no authentication and checks basic database connectivity.

```
[HTTP GET /]
    ↓
[index.js (Express Application Entry)]
    ↓
[Global Middleware (CORS)]
    ↓
[Global Middleware (Cache-Control Headers)]
    - Injects: Cache-Control: no-store, no-cache...
    ↓
[Global Middleware (Request Logger - Start Timer)]
    ↓
[Route Handler (app.get('/') in index.js)]
    - Queries database.getConnectionStatus()
    ↓
[Database Utility (database.getConnectionStatus() in config/database.js)]
    - Returns boolean: true (connected) or false (disconnected)
    ↓
[Route Handler (Formats Response)]
    - Builds message: "Welcome to persona.hasanraiyan.me API", version, database status
    ↓
[HTTP Response (200 JSON)]
    ↓
[Global Middleware (Request Logger - Log Timer Output)]
    - Output: "GET / → 200 (2ms)"
```

---

## 2. Authenticated Endpoint Trace: User Profile Retrieval (`GET /api/v1/profile`)

This endpoint strictly requires an authenticated user token and returns user details.

```
[HTTP GET /api/v1/profile with Authorization Bearer JWT]
    ↓
[index.js]
    ↓
[Global Middleware (CORS + Cache-Control)]
    ↓
[Global Middleware (clerkMiddleware() from @clerk/express)]
    - Decodes and validates Clerk token. Populates getAuth(req) context.
    ↓
[Route Middleware (authMiddleware in src/middlewares/auth.middleware.js)]
    - Invokes getAuth(req) to extract clerkId.
    - Queries: User.findOne({ clerkId }).
        ├─ If user exists: Sets req.user = user.
        └─ If user is missing: Syncs with Clerk, queries User.create(), then sets req.user.
    ↓
[Profile Router (src/routes/profile.routes.js)]
    - Matches GET '/' -> forwards to profileController.getProfile.
    ↓
[Profile Controller (getProfile in src/controllers/profile.controller.js)]
    - Calls userRepository.findByIdForProfile(req.user.id).
    ↓
[User Repository (userRepository.findByIdForProfile in src/repositories/userRepository.js)]
    - Queries: User.findById(id).
    - Returns Mongoose User document or throws NotFoundError.
    ↓
[Profile Controller (Success Formatter)]
    - Formats User document: successFormatter.formatSuccess({ id, name, email, role, profile... }).
    - Returns res.json(...) with HTTP 200.
```

---

## 3. Authorization-Sensitive Endpoint Trace: Admin Delete User (`DELETE /api/v1/admin/users/:id`)

This endpoint requires a valid admin role to perform a deletion of another user.

```
[HTTP DELETE /api/v1/admin/users/:userId]
    ↓
[index.js]
    ↓
[Global Middleware (clerkMiddleware() -> decodes credentials)]
    ↓
[Route Middleware (authMiddleware)]
    - Fetches user database record, sets req.user = user.
    ↓
[Route Middleware (adminMiddleware in src/middlewares/admin.middleware.js)]
    - Checks: if (!req.user || req.user.role !== 'admin') -> throws BaseError(403, 'FORBIDDEN').
    ↓
[Admin Router (src/routes/admin.routes.js)]
    - Matches DELETE '/users/:id' -> forwards to adminController.deleteUser.
    ↓
[Admin Controller (deleteUser in src/controllers/admin.controller.js)]
    - Guards: If req.user.id === req.params.id -> throws BaseError(400) (cannot self-delete).
    - Calls: userRepository.findById(id) to check existence.
    - Calls: userRepository.delete(id) to perform database operation.
    ↓
[User Repository (userRepository.delete in src/repositories/userRepository.js)]
    - Queries: User.findByIdAndDelete(id).
    - Returns deleted user document or throws NotFoundError.
    ↓
[Admin Controller]
    - Logs event: logger.info('User permanently deleted by admin', { userId, adminId }).
    - Formats response: successFormatter.formatSuccess(..., 'User permanently deleted').
    - Returns res.json(...) with HTTP 200.
```

---

## 4. Database-Heavy Endpoint Trace: Agent Search (`POST /api/v1/agents/search`)

This endpoint handles pagination, category/text filtering, sorting, and user-privacy access restrictions.

```
[HTTP POST /api/v1/agents/search with body { search: 'coder', category: 'coding', page: 1 }]
    ↓
[index.js]
    ↓
[Global Middleware (clerkMiddleware() -> resolves optional auth)]
    ↓
[Route Middleware (optionalAuthMiddleware in src/middlewares/optionalAuthMiddleware.js)]
    - Extracts optional clerkId.
    - If clerkId exists, resolves user document and sets req.user = user. Else, sets req.user = null.
    ↓
[Route Middleware (validateBody(searchAgentSchema) in src/middlewares/validationMiddleware.js)]
    - Validates request body using Zod schema `searchAgentSchema`.
    - Parses defaults: page=1, limit=20, sortBy='newest'.
    - Reassigns req.body with the sanitized and coerced data.
    ↓
[Agent Router (src/routes/agent.routes.js)]
    - Matches POST '/search' -> forwards to agentController.search.
    ↓
[Agent Controller (search in src/controllers/agent.controller.js)]
    - Parses body again redundantly: searchAgentSchema.parse(req.body).
    - Calls: agentService.searchAgents(filters, pagination, userId).
    ↓
[Agent Service (searchAgents in src/services/agent.service.js)]
    - Invokes `_buildSearchFilter(filters, userId)`:
        ├─ If searching other users' private agents -> throws Error.
        ├─ If searching own agents -> includes private visibility.
        └─ General marketplace search -> locks visibility to 'public'.
    - Calls: agentRepository.search(match, pagination).
    ↓
[Agent Repository (search in src/repositories/agentRepository.js)]
    - Invokes `_getSortObject(sortBy)` to resolve Mongoose sorting structure.
    - Queries: Agent.find(filters).sort(sort).skip(skip).limit(limit).
    - Returns array of agent documents.
    ↓
[Agent Service]
    - Maps agent documents via `_formatSafe(agent, userId)`:
        └─ If requester is not the owner -> strips systemPrompt and providerId fields.
    - Returns formatted array.
    ↓
[Agent Controller]
    - Sends HTTP 200 response with list data.
```

---

## 5. External Integration Endpoint Trace: Knowledge File Processing (`POST /api/v1/knowledge/:id/upload`)

This database-heavy and API-integrating endpoint processes uploaded PDF/text files, extracts text, computes embeddings, and stores them in Qdrant.

```
[HTTP POST /api/v1/knowledge/:id/upload with multipart form-data]
    ↓
[index.js]
    ↓
[Global Middleware (clerkMiddleware() -> authMiddleware() -> sets req.user)]
    ↓
[Knowledge Router (src/routes/knowledge.routes.js)]
    - Matches POST '/:id/upload'
    - Runs: multer upload handler (`upload.array('files', 10)`). Saves files to disk temp.
    - Calls: knowledgeController.upload.
    ↓
[Knowledge Controller (upload in src/controllers/knowledge.controller.js)]
    - Checks if files are present in req.files (throws HTTP 400 if empty).
    - Calls: knowledgeService.uploadFiles(kbId, userId, files).
    ↓
[Knowledge Service (uploadFiles in src/services/knowledge.service.js)]
    - Queries: knowledgeRepository.findById(kbId) to verify existence.
    - Validates ownership: If kb.ownerId !== userId -> throws Error (403).
    - For each uploaded file:
        1. Reads file from disk.
        2. Parses PDF text (via `pdf-parse`) or reads plain text.
        3. Calls `RecursiveCharacterTextSplitter` to generate chunks (chunkSize, overlap).
        4. Calculates OpenAI embeddings for each chunk (External OpenAI API request).
        5. Uploads chunk vectors to Qdrant index (External Qdrant REST API request).
        6. Saves metadata: `KnowledgeChunk.create(...)` in MongoDB.
        7. Increments KnowledgeBase stats (`documentCount`, `chunkCount`).
        8. Deletes temporary file from server disk.
    - Returns processing summary.
    ↓
[Knowledge Controller]
    - Sends success HTTP 200 with processed file metadata.
```
