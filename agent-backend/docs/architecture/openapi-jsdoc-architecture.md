# OpenAPI Auto-Generation via JSDoc Annotations

> **Status:** IMPLEMENTED. `src/docs/openapi.js` was removed and every route file (including all 9
> `developer*.routes.js` Developer Platform files) now carries `@openapi` JSDoc blocks, compiled by
> `src/docs/swagger.config.js` and served at `/docs` (Swagger UI) and `/openapi.json`. This document
> is kept as the annotation-pattern reference (§5–§10 below); the "Migration Plan" (§7) describes
> work that has already happened, not work still pending.
> **Target:** Replace manual `src/docs/openapi.js` with auto-generated spec from route-file annotations  
> **Date:** July 2026 (implemented; confirmed still accurate August 2026)

---

## 1. The Problem

### Current approach: monolithic `openapi.js`

The OpenAPI spec is a single large JavaScript object at `src/docs/openapi.js` (~770 lines). Every endpoint, schema, and response is hand-written in one file that lives separately from the route definitions.

### Why this doesn't scale

| Issue                    | Impact                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Drift**                | The old spec had 7 fake auth endpoints (register/login/logout etc.) and was missing ~40 real routes. This happened once and will happen again. |
| **Cognitive separation** | Developers edit route files but must remember to update a separate spec file. Humans forget.                                                   |
| **No ownership**         | The spec file is not owned by any module. It's a lonely file that everyone ignores.                                                            |
| **Duplicate detail**     | Route paths, HTTP methods, parameter names, and auth requirements are already defined in route files. The spec re-declares them.               |
| **No type safety**       | The spec is just a runtime JS object. A typo in a path string silently produces a missing endpoint in Swagger UI.                              |

### Root cause

The source of truth for the API lives in **two places** (route files + openapi.js) with no formal synchronization mechanism. Eventually they diverge.

---

## 2. The Solution: JSDoc + swagger-jsdoc

### How it works

```
┌─────────────────────────────┐
│   Route files (*.routes.js) │  ← Each route handler has an @openapi
│   with @openapi annotations │     JSDoc block directly above it
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│       swagger-jsdoc          │  ← Scans all matched files at startup
│   (builds spec from JSDoc)   │     and compiles the OpenAPI object
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   swagger-ui-express         │  ← Serves the compiled spec at /docs
│   (serves Swagger UI)        │     and exposes /openapi.json
└─────────────────────────────┘
```

### Key principle

**The route file IS the spec.** Adding a new endpoint means adding the route + its JSDoc annotation in one place. There is no second file to update. The spec stays accurate because it's derived from the code, not duplicated alongside it.

---

## 3. Installation & Wiring

### 3.1 Install the package

```bash
pnpm add swagger-jsdoc
```

(swagger-ui-express is already installed.)

### 3.2 Remove the old spec file

Delete `src/docs/openapi.js` — its content will be replaced by the scan output.

### 3.3 Create the shared spec definition

Create a new file `src/docs/swagger.config.js` that defines the spec-level metadata and shared components:

```javascript
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'persona.hasanraiyan.me Backend API',
      version: '1.0.0',
      description:
        'REST API for the persona.hasanraiyan.me intelligent agent orchestration platform.\n\n' +
        'Authentication is handled by **Clerk**. Send the Clerk session token as\n' +
        'an `Authorization: Bearer <token>` header.\n' +
        'Some endpoints (agent search, get) work with optional auth — unauthenticated\n' +
        'requests see only public data.\n' +
        'Admin endpoints require the user to have `role: admin`.',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Local server',
      },
    ],
    components: {
      securitySchemes: {
        clerkAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk session token (send as Bearer token or via __session cookie)',
        },
      },
      schemas: {
        // All shared schemas live here — see section 4
      },
    },
  },
  apis: [
    // Glob patterns to scan for @openapi annotations
    './src/modules/**/*.routes.js',
    './src/docs/swagger.schemas.js', // Shared schema definitions
    './src/modules/agui/agui.routes.js', // Explicit path needed if glob doesn't match
  ],
};

const spec = swaggerJsdoc(options);
export default spec;
```

### 3.4 Update `src/index.js`

Replace the import of the manual spec with the auto-generated one:

```javascript
// BEFORE:
import openapiSpec from './docs/openapi.js';

// AFTER:
import openapiSpec from './docs/swagger.config.js';
```

The rest of the wiring stays exactly the same:

```javascript
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get('/openapi.json', (req, res) => res.json(openapiSpec));
```

---

## 4. Shared Schemas

Shared schemas (reusable models) are defined in a separate file that's included in the `apis` glob. This keeps them out of any single route file while still being part of the auto-generation.

Create `src/docs/swagger.schemas.js`:

```javascript
/**
 * @openapi
 * components:
 *   schemas:
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         statusCode:
 *           type: number
 *           example: 200
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         status:
 *           type: string
 *           example: error
 *         statusCode:
 *           type: number
 *           example: 400
 *         message:
 *           type: string
 *         code:
 *           type: string
 *           example: VALIDATION_ERROR
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     PaginatedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         statusCode:
 *           type: number
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 type: object
 *             pagination:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *         timestamp:
 *           type: string
 *           format: date-time
 *
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         clerkId:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         role:
 *           type: string
 *           enum: [normal, admin]
 *         username:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Agent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         systemPrompt:
 *           type: string
 *         modelName:
 *           type: string
 *         webSearchEnabled:
 *           type: boolean
 *         visibility:
 *           type: string
 *           enum: [private, unlisted, public]
 *         category:
 *           type: string
 *           enum: [productivity, coding, creative, research, roleplay, other]
 *         isMainAgent:
 *           type: boolean
 *         messageCount:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Thread:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         agentId:
 *           type: string
 *         userId:
 *           type: string
 *         threadId:
 *           type: string
 *         title:
 *           type: string
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *         isArchived:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Provider:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         label:
 *           type: string
 *         baseURL:
 *           type: string
 *         defaultModel:
 *           type: string
 *         isDefault:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Skill:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         instructions:
 *           type: string
 *         isPublic:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     Mcp:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         transport:
 *           type: string
 *           enum: [http, sse]
 *         url:
 *           type: string
 *         authType:
 *           type: string
 *           enum: [none, oauth, apiKey]
 *         authMode:
 *           type: string
 *           enum: [owner, user]
 *         isEnabled:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     KnowledgeBase:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         ownerId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         isPublic:
 *           type: boolean
 *         documentCount:
 *           type: integer
 *         chunkCount:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 */
export {};
```

---

## 5. Route Annotation Examples

Below are the exact annotation patterns for each route file, based on actual code from the repository. Each follows the same structure:

```
@openapi
/path:
  method:
    tags: [ModuleName]
    summary: ...
    security: [{ clerkAuth: [] }]   # if auth required
    parameters: [...]                # if path/query params
    requestBody: ...                 # if POST/PUT/PATCH with body
    responses: { ... }
```

### 5.1 Health Routes (`health.routes.js`)

**Simple, no auth, no body:**

```javascript
/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Server health check
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.get('/', healthController.getHealth);

/**
 * @openapi
 * /api/v1/health/db:
 *   get:
 *     tags: [Health]
 *     summary: Database connectivity health check
 *     responses:
 *       200:
 *         description: Database connected
 *       503:
 *         description: Database disconnected
 */
router.get('/db', healthController.getDbHealth);
```

### 5.2 Profile Routes (`profile.routes.js`)

**Auth required, GET/PATCH/DELETE on same path:**

```javascript
/**
 * @openapi
 * /api/v1/profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get authenticated user profile
 *     description: Returns the current user's profile including name, email, role, and preferences.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *   patch:
 *     tags: [Profile]
 *     summary: Update profile fields
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *   delete:
 *     tags: [Profile]
 *     summary: Delete own account
 *     description: Permanently deletes the user account, all associated agents, threads, providers, skills, MCP servers, and knowledge bases.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Account deleted
 *       401:
 *         description: Unauthorized
 */
router.get('/', authMiddleware, profileController.getProfile);
router.patch(
  '/',
  authMiddleware,
  validateBody(updateProfileSchema),
  profileController.updateProfile
);
router.delete('/', authMiddleware, mutateLimiter, profileController.deleteProfile);
```

### 5.3 Admin Routes (`admin.routes.js`)

**Auth + admin role check:**

```javascript
/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin only)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Users list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — requires admin role
 */
router.get('/users', authMiddleware, adminMiddleware, adminController.listUsers);

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Permanently delete a user (admin only)
 *     description: Hard-deletes the user and all their associated data from the database (agents, threads, providers, skills, MCP servers, knowledge bases, memories, uploads).
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to delete
 *     responses:
 *       200:
 *         description: User permanently deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — requires admin role
 *       404:
 *         description: User not found
 */
router.delete('/users/:id', authMiddleware, adminMiddleware, adminController.deleteUser);
```

### 5.4 Provider Routes (`provider.routes.js`)

**Auth required, POST with body, path parameters, rate limited:**

```javascript
/**
 * @openapi
 * /api/v1/providers:
 *   get:
 *     tags: [Providers]
 *     summary: List user's provider configurations
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Providers list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/', providerController.getAll);

/**
 * @openapi
 * /api/v1/providers:
 *   post:
 *     tags: [Providers]
 *     summary: Create a provider configuration
 *     description: Stores API keys encrypted at rest. The provider is used by agents for LLM inference.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, baseURL, apiKey, defaultModel]
 *             properties:
 *               label:
 *                 type: string
 *                 description: Human-readable name for this provider
 *               baseURL:
 *                 type: string
 *                 description: API base URL (e.g. https://api.openai.com/v1)
 *               apiKey:
 *                 type: string
 *                 description: Plaintext API key (encrypted at rest via AES-256-GCM)
 *               defaultModel:
 *                 type: string
 *                 description: Default model identifier (e.g. gpt-4o)
 *               isDefault:
 *                 type: boolean
 *                 description: Set as the default provider for new agents
 *     responses:
 *       201:
 *         description: Provider created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', mutateLimiter, validateBody(createProviderSchema), providerController.create);

/**
 * @openapi
 * /api/v1/providers/{id}:
 *   put:
 *     tags: [Providers]
 *     summary: Update a provider configuration
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *               baseURL:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               defaultModel:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Provider updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 *   delete:
 *     tags: [Providers]
 *     summary: Delete a provider configuration
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 */
router.put('/:id', mutateLimiter, validateBody(updateProviderSchema), providerController.update);
router.delete('/:id', mutateLimiter, providerController.remove);
```

### 5.5 Agent Routes (`agent.routes.js`)

**Mixed auth (optional + required), complex request body, search endpoint:**

```javascript
/**
 * @openapi
 * /api/v1/agents/search:
 *   post:
 *     tags: [Agents]
 *     summary: Search agents with filters
 *     description: |
 *       Works with optional auth. Authenticated users see their own private agents.
 *       Unauthenticated requests see only public agents. Supports full-text search
 *       by name/description, filtering by category/tags/owner/visibility, and pagination.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 type: string
 *                 description: Full-text search across name and description
 *               category:
 *                 type: string
 *                 enum: [productivity, coding, creative, research, roleplay, other]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               ownerId:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [private, unlisted, public]
 *               page:
 *                 type: integer
 *                 default: 1
 *               limit:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post(
  '/search',
  optionalAuthMiddleware,
  validateBody(searchAgentSchema),
  agentController.search
);

/**
 * @openapi
 * /api/v1/agents:
 *   post:
 *     tags: [Agents]
 *     summary: Create a new agent
 *     description: Creates an agent with a system prompt, assigned provider, and configuration.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, systemPrompt, providerId]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *               systemPrompt:
 *                 type: string
 *                 description: The system prompt that defines agent behavior
 *               providerId:
 *                 type: string
 *                 description: ID of the LLM provider to use
 *               modelName:
 *                 type: string
 *                 description: Model identifier (overrides provider default)
 *               webSearchEnabled:
 *                 type: boolean
 *                 default: false
 *               visibility:
 *                 type: string
 *                 enum: [private, unlisted, public]
 *                 default: private
 *               category:
 *                 type: string
 *                 enum: [productivity, coding, creative, research, roleplay, other]
 *     responses:
 *       201:
 *         description: Agent created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', mutateLimiter, validateBody(createAgentSchema), agentController.create);

/**
 * @openapi
 * /api/v1/agents/slug/{slug}:
 *   get:
 *     tags: [Agents]
 *     summary: Get agent by URL slug
 *     description: Public endpoint. Returns agent details by their human-readable slug.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: URL slug (e.g. "my-coding-assistant")
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Agent not found
 */
router.get('/slug/:slug', optionalAuthMiddleware, agentController.getBySlug);
```

### 5.6 MCP Routes (`mcp.routes.js`)

**OAuth callbacks without auth, complex path structure:**

```javascript
/**
 * @openapi
 * /api/v1/mcps/oauth/owner/callback:
 *   get:
 *     tags: [MCP OAuth]
 *     summary: OAuth callback for owner-mode authorization
 *     description: >
 *       Called by the external auth server after the MCP owner grants access.
 *       Deliberately has NO auth middleware — the external auth server redirects
 *       the browser here and there is no Clerk session on that request.
 *       Identity (mcpId, userId, mode) is recovered entirely from the signed
 *       `state` parameter (see oauth-state.js utility).
 *     responses:
 *       302:
 *         description: Redirect to the application with result
 */
router.get('/oauth/owner/callback', mcpController.ownerCallback);

/**
 * @openapi
 * /api/v1/mcps/{id}/oauth/owner/authorize:
 *   get:
 *     tags: [MCP OAuth]
 *     summary: Get the OAuth authorization URL for the MCP owner
 *     description: >
 *       Generates and returns the URL the owner must visit in their browser
 *       to authorize the MCP server with OAuth. The MCP server must support
 *       OAuth 2.0 with PKCE and Dynamic Client Registration (RFC 7591).
 *       The state parameter is signed with HMAC-SHA256 to prevent CSRF.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Authorization URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       description: Full OAuth authorization URL to redirect the user to
 */
router.get('/:id/oauth/owner/authorize', mcpController.getOwnerAuthorizeUrl);
```

### 5.7 AG-UI Routes (`agui.routes.js`)

**Custom middleware, SSE streaming, headers as parameters:**

```javascript
/**
 * @openapi
 * /api/v1/agui:
 *   get:
 *     tags: [AG-UI]
 *     summary: AG-UI protocol information
 *     description: Returns protocol version and supported features for the AG-UI streaming interface.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Protocol information including version and capabilities
 *   post:
 *     tags: [AG-UI]
 *     summary: Send a message and stream the agent response (SSE)
 *     description: >
 *       Initiates or resumes an agent conversation via Server-Sent Events.
 *       The client reads events as they arrive — text chunks, tool calls,
 *       tool results, and state snapshots. Supports resuming interrupted
 *       threads via the `resume` field.
 *
 *       This endpoint uses a custom body parser (not express.json()) because
 *       it needs to read the raw request before the global JSON middleware
 *       consumes the stream. It also resolves the LangGraph thread ID from
 *       the x-thread-id header.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: x-agent-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID to chat with
 *       - name: x-thread-id
 *         in: header
 *         schema:
 *           type: string
 *         description: Thread ID to resume (omit for a new conversation)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *               resume:
 *                 type: object
 *                 description: >
 *                   Resume data for interrupted threads. For human-in-the-loop
 *                   decisions, pass `{ type: "decision", decision: "continue" }`.
 *                   For tool clarification, pass the answer.
 *     responses:
 *       200:
 *         description: SSE event stream of agent responses
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream
 */
aguiRouter.get('/', aguiController.getProtocolInfo);
aguiRouter.post('/', rateLimiter('CHAT', RATE_LIMITS.CHAT), aguiController.runAgent);
```

### 5.8 Webhook Routes (`webhook.routes.js`)

**No auth, raw body parser:**

```javascript
/**
 * @openapi
 * /api/v1/webhooks/clerk:
 *   post:
 *     tags: [Webhooks]
 *     summary: Clerk user lifecycle webhook handler
 *     description: >
 *       Receives Clerk webhook events (user.created, user.updated, user.deleted).
 *       Verified using Svix signature verification. Uses a raw body parser
 *       (express.raw) because the Svix SDK requires the raw body for signature
 *       computation. This route bypasses Clerk middleware entirely.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [user.created, user.updated, user.deleted]
 *               data:
 *                 type: object
 *                 description: Clerk user payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid signature or payload
 */
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  webhookController.handleClerkWebhook
);
```

### 5.9 Knowledge Routes (`knowledge.routes.js`)

**Multipart file upload:**

```javascript
/**
 * @openapi
 * /api/v1/knowledge/{id}/upload:
 *   post:
 *     tags: [Knowledge]
 *     summary: Upload documents to a knowledge base
 *     description: >
 *       Upload one or more documents to be ingested into the knowledge base.
 *       Files are processed in-memory (multer memoryStorage), chunked into
 *       overlapping segments via RecursiveCharacterTextSplitter, embedded
 *       via OpenAI embeddings, and stored in Qdrant vector database.
 *       Supported formats: PDF, TXT, MD, JSON, CSV.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to upload (PDF, TXT, MD, JSON, CSV, max 20MB each, max 10 files)
 *     responses:
 *       200:
 *         description: Upload successful with chunk counts
 *       400:
 *         description: Invalid file type or too many files
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Knowledge base not found
 */
router.post('/:id/upload', upload.array('files', 10), knowledgeController.upload);
```

---

## 6. Annotation Patterns Reference

### Pattern 1: Simple GET (no auth, no params)

```javascript
/**
 * @openapi
 * /path:
 *   get:
 *     tags: [ModuleName]
 *     summary: One-line description
 *     responses:
 *       200:
 *         description: What comes back
 */
```

### Pattern 2: Auth-only GET (with path parameter)

```javascript
/**
 * @openapi
 * /path/{id}:
 *   get:
 *     tags: [ModuleName]
 *     summary: Description
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Description
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */
```

### Pattern 3: POST with request body

```javascript
/**
 * @openapi
 * /path:
 *   post:
 *     tags: [ModuleName]
 *     summary: Description
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1, field2]
 *             properties:
 *               field1:
 *                 type: string
 *               field2:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 */
```

### Pattern 4: Multipart file upload

```javascript
/**
 * @openapi
 * /path/{id}/upload:
 *   post:
 *     tags: [ModuleName]
 *     summary: Upload files
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Uploaded
 */
```

### Pattern 5: No auth (webhooks, OAuth callbacks)

```javascript
/**
 * @openapi
 * /path:
 *   post:
 *     tags: [Webhooks]
 *     summary: Description
 *     description: Why this endpoint needs no auth
 *     responses:
 *       200:
 *         description: Processed
 */
```

**No `security` key** means the endpoint is unauthenticated in Swagger UI.

### Pattern 6: Combined path (PUT + DELETE on same path)

```javascript
/**
 * @openapi
 * /path/{id}:
 *   put:
 *     tags: [ModuleName]
 *     summary: Update
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       ...update schema...
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     tags: [ModuleName]
 *     summary: Delete
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
```

---

## 7. Migration Plan

### Phase 1: Setup (5 minutes)

1. Install `swagger-jsdoc`
2. Create `src/docs/swagger.config.js` with spec metadata and glob patterns
3. Create `src/docs/swagger.schemas.js` with all shared schemas
4. Update `src/index.js` to import from `swagger.config.js`

### Phase 2: Annotate route files (one per module)

Each route file gets `@openapi` JSDoc blocks added. Estimated effort per file:

| File                  | Endpoints | Complexity                            | Est. Time |
| --------------------- | --------- | ------------------------------------- | --------- |
| `health.routes.js`    | 2         | Simple (no auth, no body)             | 5 min     |
| `profile.routes.js`   | 3         | Medium (auth, body)                   | 10 min    |
| `admin.routes.js`     | 2         | Simple (auth, admin check)            | 5 min     |
| `provider.routes.js`  | 7         | Medium (auth, body, params)           | 20 min    |
| `agent.routes.js`     | 9         | Complex (mixed auth, search filters)  | 25 min    |
| `thread.routes.js`    | 7         | Medium (auth, params)                 | 15 min    |
| `skill.routes.js`     | 8         | Medium (auth, params)                 | 20 min    |
| `mcp.routes.js`       | 16        | Complex (OAuth, nested paths)         | 35 min    |
| `agui.routes.js`      | 2         | Complex (SSE, headers, custom parser) | 10 min    |
| `knowledge.routes.js` | 9         | Complex (multipart, RAG)              | 25 min    |
| `memory.routes.js`    | 4         | Simple (auth, params)                 | 10 min    |
| `webhook.routes.js`   | 1         | Simple (no auth, raw body)            | 5 min     |
| `upload.routes.js`    | 1         | Simple (multipart)                    | 5 min     |

### Phase 3: Verification

1. Start the server
2. Visit `/docs` — confirm all routes are listed with correct methods and paths
3. Visit `/openapi.json` — confirm the JSON parses correctly
4. Test a few endpoints through Swagger UI to verify auth and request bodies work
5. Remove `src/docs/openapi.js`

### Phase 4: Developer onboarding

1. Add a note to `docs/development/adding-an-endpoint.md` about adding JSDoc annotations
2. Add a section to `AGENTS.md` about the annotation convention
3. Remove the old `openapi.js` from the codebase

---

## 8. Why This Is Better

| Aspect                 | Before (manual openapi.js)      | After (JSDoc + swagger-jsdoc)                             |
| ---------------------- | ------------------------------- | --------------------------------------------------------- |
| **Source of truth**    | Two places (routes + spec file) | One place (route file)                                    |
| **Sync mechanism**     | Developer must remember         | Automatic at startup                                      |
| **Adding an endpoint** | Write route + update openapi.js | Write route + add JSDoc block above it                    |
| **Drift detection**    | None (found when docs reviewed) | Impossible — spec is derived from routes                  |
| **Module ownership**   | Nobody owns the spec file       | Each module owns its own annotations                      |
| **Per-module detail**  | Generic descriptions            | Route-specific details (param validation, allowed values) |
| **Review burden**      | PR must check both files        | PR checks one file, diff shows both route + docs          |
| **Startup cost**       | None                            | ~50ms to scan and compile spec                            |

---

## 9. Things to Watch For

### YAML indentation is strict

The JSDoc block uses YAML inside the comment. Indentation matters — two spaces per level. A misaligned line silently drops that property from the spec.

**Bad:**

```javascript
/**
 * @openapi
 * /path:
 *   get:
 *     summary: Description
 *    responses:        ← Only 1 space instead of 4
 */
```

**Good:**

```javascript
/**
 * @openapi
 * /path:
 *   get:
 *     summary: Description
 *     responses:
 *       200:
 *         description: OK
 */
```

### Multiple methods on the same path

When a path has both `PUT` and `DELETE`, both go under the same path key. This is idiomatic in OpenAPI but requires careful YAML indentation.

### Header parameters

AG-UI uses `x-agent-id` and `x-thread-id` HTTP headers. These are declared under `parameters` with `in: header` — not `in: path` or `in: query`.

### No auth ≠ missing annotation

Webhooks and MCP OAuth callbacks deliberately have no Clerk auth. Their JSDoc annotations should explicitly exclude the `security` key. swagger-jsdoc only applies the global default `security` if one is set — in our config we don't set a global default, so endpoints without `security` are unauthenticated.

### Shared schemas must be referenced correctly

Use `$ref: '#/components/schemas/SchemaName'` consistently. The schema name must match exactly what's defined in `swagger.schemas.js` — OpenAPI `$ref` is case-sensitive.

---

## 10. Quick Reference: Route File Checklist

When annotating a route file, verify:

- [ ] Every route handler has an `@openapi` block
- [ ] All path parameters are declared with `name`, `in: path`, `required: true`
- [ ] All query parameters are declared with `name`, `in: query`
- [ ] All header parameters are declared with `name`, `in: header`
- [ ] POST/PUT/PATCH have `requestBody` with content type and schema
- [ ] Multipart uploads use `multipart/form-data` content type
- [ ] All endpoints with authMiddleware have `security: [{ clerkAuth: [] }]`
- [ ] Endpoints without auth (webhooks, OAuth callbacks) have NO `security` key
- [ ] Response codes match what the controller actually returns (201 for create, 400/401/403/404/500 where applicable)
- [ ] Shared models use `$ref: '#/components/schemas/Name'`
- [ ] Descriptions explain WHY, not just WHAT
- [ ] YAML indentation is exactly 2 spaces per level
- [ ] Tags match the module name (e.g. `[Agents]`, `[MCP]`, `[Knowledge]`)
- [ ] The server starts without errors after adding annotations
- [ ] `/openapi.json` includes the new endpoint
- [ ] `/docs` renders the new endpoint correctly

---

## Appendix: Comparison with Current `openapi.js`

### Current state

```
src/docs/openapi.js  (770 lines, manual, single file, already diverging)
```

Every line was hand-written. There is no way to verify it matches actual routes except manual inspection. It has already been rebuilt once because the original drifted.

### Target state

```
src/
  docs/
    swagger.config.js    (40 lines — config + spec metadata)
    swagger.schemas.js   (200 lines — shared component schemas, auto-scanned)
  modules/
    health/
      health.routes.js   (+10 lines of JSDoc)
    providers/
      provider.routes.js (+60 lines of JSDoc)
    agents/
      agent.routes.js    (+90 lines of JSDoc)
    ...etc...
```

Every route file grows slightly, but the documentation is co-located with the code it describes. The spec is compiled automatically — it can never diverge from the routes.
