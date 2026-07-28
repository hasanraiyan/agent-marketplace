# 01 - Current Architecture (Historical Reference)

> **⚠️ SUPERSEDED — July 2026**
>
> This document describes the backend architecture as it existed before the modular refactoring that
> moved from a technical-layer structure (`routes/`, `controllers/`, `services/`, `models/`) to a
> domain-based module structure (`src/modules/<domain>/`).
>
> While the layering concepts (Route → Controller → Service → Repository → Model) and the dependency
> direction rules remain valid, the specific file paths and structural observations in this document
> **no longer reflect the current codebase**.
>
> For current architecture, see:
>
> - `architecture/06-target-architecture.md` — The target modular design (largely achieved)
> - `architecture/09-refactoring-progress.md` — Current refactoring status
> - `product-research/00-product-overview/current-product-state.md` — Product architecture overview
> - `AGENTS.md` — AI agent guide with current directory structure
>
> This document is preserved for historical reference to understand the migration journey.

---

## 1. Architectural Style

The application is structured as a **monolithic layering (N-Tier)** backend with a partial separation of concerns:

- **Routing Layer**: Exposes Express routers and registers routes under `/api/v1/...`.
- **Controller Layer**: Handles incoming HTTP requests, maps parameters, triggers services or repositories, and formats JSON responses.
- **Service Layer**: Houses core business logic (e.g. LangChain/LangGraph agent building, email sending, background job routines).
- **Repository / Data Access Layer**: Partially abstracts database queries from models.
- **Database Model Layer**: Mongoose models that communicate directly with MongoDB.

### Structural Observations

- **Intended Architecture**: High cohesion, low coupling, with a repository pattern abstracting Mongoose.
- **Actual Implementation**: Inconsistent application of layers. Several controllers and routers bypass services and repository layers entirely, querying Mongoose models directly.
- **Module Cohesion**: Directory-based grouping by layer (e.g. all routes in `/routes`, all controllers in `/controllers`) rather than by domain/feature. This is a typical "package-by-technical-layer" structure rather than "package-by-feature".

---

## 2. Application Bootstrap & Server Startup

The entry point is `src/index.js` which performs the following tasks:

1. **Initialize Logger**: Retrieves a logger instance from `loggerService`.
2. **Initialize Express Application**: Creates an instance of `express()`.
3. **Attach Middleware**:
   - Global CORS: `cors()`.
   - Cache-Control headers to prevent proxy/browser caching.
   - HTTP request logging middleware.
   - Clerk Middleware for auth verification (excluding Clerk raw webhooks at `/api/v1/webhooks`).
   - Express body parsing middleware (`express.json()` and raw stream handling).
4. **Register Routes**: Mounts domain routers at `/api/v1/<resource>`.
5. **Serve Static Uploads**: Mounts `/uploads` to serve static files.
6. **Error Handling**: Attaches the global `errorHandler` middleware.
7. **Start Server & Connect DB**: Inside an async `startServer()` function:
   - Connects to MongoDB via the `database` configuration singleton.
   - Starts background cron jobs via `startAllCronJobs()`.
   - Sets up graceful shutdown handling for `SIGINT`/`SIGTERM` process events.
   - Listens on the configured `PORT`.

---

## 3. Route Registration Strategy

Routes are registered statically in `src/index.js` using explicit `app.use('/api/v1/<domain>', router)` statements.

- Routers are defined as native `express.Router()` instances in `src/routes/*.routes.js`.
- Validation middlewares (`validateBody`, `validateQuery`, etc.) and rate limiting middlewares are attached directly at the route definition.
- **Inconsistent Practices**: Clerk webhooks (`webhook.routes.js`) have all database logic and webhook signature verification written inline in the route handler instead of separating routes, controllers, and services.

---

## 4. Controller Structure

Controllers are written as ES classes or objects containing handler methods:

- Many controllers return an instance of the class (e.g., `export default new AgentController();`) or an object map (e.g., `export default { getProfile, ... }`).
- Controllers are responsible for:
  - Extracting request parameters and body data.
  - Executing schema validation (often redundantly, even when validation middleware is attached to the route).
  - Invoking services (e.g., `agentService.createAgent`) or repositories (`userRepository.update`).
  - Formatting responses (often using `successFormatter` or directly returning `res.json`).
- **Architectural Smell**: Direct import and query of Mongoose models (like `MemoryFile`, `Agent`, `Skill`, `Provider`, `Mcp`, `McpUserConnection`, `Conversation`) inside controller actions, completely bypassing the repository and service layers.

---

## 5. Service Structure

Services (located in `src/services/`) are class singletons containing business logic:

- They are mostly independent of Express, receiving raw arguments instead of `req`/`res` objects.
- Some services handle complex orchestration (e.g., `knowledge.service.js` managing file processing, chunking, and Qdrant vector index storage, or `agent.service.js` orchestrating slug generation, validation, and serialization).
- **Inconsistent Practices**: Not all domains have corresponding services (e.g., `profile` lacks a service, and its deletion logic is written inside the controller, mixing database transactions and cleanups inside the HTTP layer).

---

## 6. Database Architecture

- **Database Engine**: MongoDB.
- **ODM**: Mongoose 9.
- **Repository Pattern**: Partially implemented in `src/repositories/`. The intent is for controllers and services to only talk to repositories.
- **Actual State**:
  - Inconsistent utilization. Some repositories act as thin wrappers around Mongoose models, while others (like `userRepository`) contain significant query logic.
  - Leakage: Controllers import models directly.
  - Field-level encryption: Custom AES-256-GCM encryption is handled inside models or repositories using `src/utils/encryption.js` (e.g. for API keys or secrets).

---

## 7. Authentication & Authorization

- **Auth Provider**: Clerk (using `@clerk/express`).
- **Session Verification**: Handled by the global `clerkMiddleware()` populated in the Express request context.
- **Database Syncing**: Custom synchronization in `auth.middleware.js` and `optionalAuthMiddleware.js` automatically queries Clerk API and creates/updates a local `User` record if it doesn't exist.
- **Authorization**: Handled by `admin.middleware.js` (checking if `req.user.role === 'admin'`) and manual visibility checks in services (e.g. checking if `agent.ownerId === userId` or if `agent.visibility === 'public'`).
- **Security Middleware**: CORS enabled, but there is no rate limiting on the Clerk webhook endpoints, nor is there robust CSRF protection since Clerk handles tokens.

---

## 8. Validation Architecture

- **Library**: Zod.
- **Implementation**: Request validation is handled in two ways:
  1. Via `validateBody`/`validateQuery` middleware utilizing the `schemaValidator` utility.
  2. Inside controllers where `schema.parse(req.body)` is explicitly run.
- **Architectural Smell**: Redundant validation (e.g., both validation middleware and controllers validating the same payload against the same Zod schema).

---

## 9. Error-Handling Architecture

- **Hierarchy**: Custom errors extend `BaseError.js`, which extends the native `Error` class and encapsulates `statusCode` and an error `code` (e.g., `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`).
- **Interceptors**: Global `errorHandler.js` intercepts all uncaught errors, logs them using the injected logger, formats them via `errorFormatter.formatError()`, and sends standardized JSON error payloads.
- **Limitations**: Async handlers in Express require explicit `try/catch` and calling `next(error)`. If any async operation fails without a `try/catch`, it will trigger an unhandled promise rejection.

---

## 10. Configuration Architecture

- **Source**: Environment variables (`.env` and `.env.test`).
- **Parser**: `src/config/index.js` loads env vars via `dotenv`, parses values (such as port numbers, database keys, and nested JSON structures), and exports a unified config object.
- **Status**: Clean separation. Environment variables are not accessed directly in source code outside of `src/config/index.js` and early webhooks setup.

---

## 11. External Integration Architecture

The application integrates with several external services:

- **Clerk**: Identity management and user authentication.
- **Resend**: Transactional email service (using `Mailgen` templates inside `mail.service.js`).
- **Qdrant**: Vector database for AI knowledge bases.
- **AI Providers**: LangChain/LangGraph/Deep Agents wrappers communicating with OpenAI and Anthropic.
- **Svix**: Signature verification for incoming Clerk webhook payloads.

---

## Summary Matrix

| Concern            | What Actually Exists                                          | What Appears Intended                                                       | Inconsistencies / Smells                                                 | Missing Features                                                          |
| :----------------- | :------------------------------------------------------------ | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| **Layering**       | Partial layering; some queries are direct to Mongoose models. | Clean separation of Router -> Controller -> Service -> Repository -> Model. | Direct model queries inside controllers (e.g., `profile.controller.js`). | Clear service layer for profile management.                               |
| **Routing**        | File-based routes inside `/routes`.                           | Routers only handle routing and middleware bindings.                        | Webhook routes have business logic and database queries inline.          | Decoupled controllers and services for Webhook.                           |
| **Validation**     | Zod schemas inside `/validators/`.                            | Middleware validates requests before controller execution.                  | Redundant validation parsing in both routing middleware and controllers. | Unified validation error messaging.                                       |
| **Database**       | Repositories + Direct Mongoose queries.                       | Repository abstraction hides the database details.                          | Mixed repository usage; some controllers bypass repositories.            | Full abstraction of database queries.                                     |
| **Error Handling** | BaseError with subclasses + global handler.                   | Standardized API errors with proper HTTP statuses.                          | Requires manual try/catch blocks in every controller action.             | express-async-errors or central route wrapping to catch unhandled errors. |
| **Authentication** | Clerk Middleware + local sync.                                | Automatic authentication verification and user profile syncing.             | Sync logic is copy-pasted/duplicated in two auth middlewares.            | Consolidated user syncing logic.                                          |
