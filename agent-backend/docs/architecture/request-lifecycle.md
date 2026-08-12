# Request Lifecycle

## Standard REST Request Flow

```mermaid
sequenceDiagram
    participant Client as Client
    participant Express as Express App
    participant Middleware as Middleware Stack
    participant Route as Route Handler
    participant Controller as Controller
    participant Service as Service
    participant Repository as Repository
    participant DB as MongoDB

    Client->>Express: HTTP Request
    Express->>Middleware: CORS + No-Cache + Request Logger
    Middleware-->>Express: Next()

    alt Webhook Route
        Express->>Route: /api/v1/webhooks/* (raw body, no auth)
    else AG-UI Route
        Express->>Middleware: Clerk Middleware
        Express->>Route: /api/v1/agui/* (reads raw body)
    else Normal Route
        Express->>Middleware: Clerk Middleware
        Express->>Middleware: express.json()
        Express->>Middleware: Auth Middleware (per-route)
        Express->>Middleware: Rate Limiter (per-route)
        Express->>Middleware: Validation Middleware (per-route)
        Express->>Route: Matched Route
    end

    Route->>Controller: Call controller method
    Controller->>Service: Call service method
    Service->>Repository: Call repository method
    Repository->>DB: MongoDB query
    DB-->>Repository: Result
    Repository-->>Service: Data
    Service-->>Controller: Processed result

    Controller->>Express: Formatted response (via successFormatter)
    Express-->>Client: JSON Response

    Note over Express,Client: Error path
    Controller-->>Express: next(err) on failure
    Express->>Middleware: errorHandler middleware
    Middleware-->>Client: JSON Error Response
```

## Detailed Step-by-Step

### 1. Request Arrives

```javascript
// src/index.js — Entry point
import express from 'express';
const app = express();

app.use(cors()); // Cross-origin support
app.use(noCacheHeaders()); // Prevent caching
app.use(requestLogger()); // Log every request
```

### 2. Route Resolution

Routes are registered in a specific order to handle special cases:

```javascript
// 1. Webhooks — raw body, bypasses Clerk auth
app.use('/api/v1/webhooks', webhookRouter);

// 2. Clerk middleware (for all subsequent routes)
app.use(clerkMiddleware());

// 3. AG-UI — reads raw body before express.json()
app.use('/api/v1/agui', aguiRouter);

// 4. Standard JSON parsing
app.use(express.json());

// 5. All API routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/agents', agentRouter);
// ...etc
```

### 3. Module-Level Processing

Within each module, the route handler chains middleware:

```javascript
// Example: agent.routes.js
router.post(
  '/search',
  optionalAuthMiddleware, // Auth (optional)
  validateBody(searchSchema), // Validation
  agentController.search // Controller
);

router.use(authMiddleware); // All remaining routes require auth

router.post(
  '/',
  rateLimiter('MUTATE', { maxRequests: 30, windowMs: 60000 }), // Rate limit
  validateBody(createSchema), // Validation
  agentController.create // Controller
);
```

### 4. Controller → Service → Repository

```javascript
// Controller extracts HTTP concerns
controller.create = async (req, res, next) => {
  try {
    const result = await service.create(req.body, req.user._id);
    res.status(201).json(formatSuccess(result, 'Created'));
  } catch (err) {
    next(err);
  }
};

// Service contains business logic
service.create = async (data, userId) => {
  validateBusinessRules(data);
  return repository.create({ ...data, ownerId: userId });
};

// Repository handles data access
repository.create = async (data) => {
  return Model.create(data);
};
```

### 5. Error Handling

If any layer throws, the error propagates to the global error handler:

```javascript
// src/middlewares/errorHandler.js
export default function errorHandler(err, req, res, next) {
  logger.error('Request error', { message: err.message, ... });
  const statusCode = err.statusCode || 500;
  const errorResponse = errorFormatter.formatError(err, statusCode);
  res.status(statusCode).json(errorResponse);
}
```

## AG-UI/SSE Streaming Flow

The AG-UI protocol is a special case — it uses SSE (Server-Sent Events) instead of standard JSON responses.

```mermaid
sequenceDiagram
    participant Client as Client
    participant AGUI as AG-UI Controller
    participant AGSvc as AG-UI Service
    participant Factory as Agent Factory
    participant LLM as LLM Provider
    participant Tools as Tool Layer
    participant Threads as Thread Storage

    Client->>AGUI: POST /api/v1/agui (with agentId, messages)
    AGUI->>AGUI: readJsonBody(req) — raw body parsing
    AGUI->>Factory: buildAgent(agentId, userId)
    Factory->>Factory: Resolve provider, tools, skills
    Factory-->>AGUI: Compiled agent graph + config
    AGUI->>AGSvc: runAgentAsAguiEvents({...})
    AGSvc->>Factory: agentInstance.streamEvents(input)
    Note over AGSvc,Client: Event stream starts

    loop For each stream event
        AGSvc->>AGUI: on_chat_model_stream → text delta
        AGSvc->>AGUI: on_tool_start → tool call
        AGSvc->>AGUI: on_tool_end → tool result
        AGSvc->>AGUI: on_chat_model_stream → more text
    end

    AGSvc->>Threads: Auto-title thread (async)
    AGSvc-->>AGUI: Final state snapshot
    AGUI-->>Client: SSE stream (text, tool calls, results, state)
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client as Client
    participant Clerk as Clerk SDK
    participant Middleware as Auth Middleware
    participant Service as Auth Service
    participant Repo as User Repository
    participant DB as MongoDB

    Client->>Middleware: Request with Clerk Session Token
    Middleware->>Clerk: getAuth(req) → userId
    Clerk-->>Middleware: { userId: "clerk_123" }

    Middleware->>Service: syncUser("clerk_123")
    Service->>Repo: findByClerkId("clerk_123")

    alt User exists locally
        Repo-->>Service: User document
    else User not found
        Service->>Clerk: getUser("clerk_123")
        Clerk-->>Service: User data from Clerk
        Service->>Repo: create({ clerkId, email, name })
        Repo-->>Service: New user document
    end

    Service-->>Middleware: User object
    Middleware->>Middleware: req.user = user
    Middleware->>Route: next()
```

## Caching

All API responses include `no-cache` headers:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

## Next Steps

- [Explore the Module System](module-system.md)
- [Review Dependency Rules](dependency-rules.md)
