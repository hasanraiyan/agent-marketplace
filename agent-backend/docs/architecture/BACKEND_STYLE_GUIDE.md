# The Backend Blueprint

### Architecture, Patterns & Conventions for Building Production APIs

> **Author:** Raiyan Hasan

> This document covers the architecture, coding patterns, conventions, and workflows used in this backend style. Every new team member should follow these patterns to maintain consistency.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Architecture Pattern](#architecture-pattern)
4. [Layer-by-Layer Breakdown](#layer-by-layer-breakdown)
5. [SOLID Principles in Use](#solid-principles-in-use)
6. [Coding Conventions](#coding-conventions)
7. [Error Handling](#error-handling)
8. [Response Format](#response-format)
9. [Validation](#validation)
10. [Authentication & Authorization](#authentication--authorization)
11. [Rate Limiting](#rate-limiting)
12. [Database Patterns](#database-patterns)
13. [Logging](#logging)
14. [Email Service](#email-service)
15. [Encryption](#encryption)
16. [Testing](#testing)
17. [Environment Setup](#environment-setup)
18. [Scripts & Commands](#scripts--commands)
19. [Adding a New Feature (Step-by-Step)](#adding-a-new-feature-step-by-step)
20. [Route Checklist](#route-checklist)

---

## Tech Stack

| Category        | Technology                     |
| --------------- | ------------------------------ |
| Runtime         | Node.js (ES Modules)           |
| Framework       | Express 5                      |
| Database        | MongoDB + Mongoose             |
| Validation      | Zod                            |
| Auth            | Clerk (external auth provider) |
| Email           | Resend + Mailgen               |
| Testing         | Jest + Supertest               |
| Formatting      | Prettier                       |
| Git Hooks       | Husky + lint-staged            |
| Package Manager | pnpm                           |
| API Docs        | Swagger (OpenAPI)              |

---

## Project Structure

```
src/
├── config/              # Environment & service configs
│   ├── index.js         # Main config (env parsing, defaults)
│   ├── database.js      # MongoDB singleton connection
│   ├── jwt.config.js    # JWT / OAuth state signing config
│   └── mail.config.js   # Email provider setup
│
├── middlewares/         # Express middleware
│   ├── errorHandler.js
│   └── validationMiddleware.js
│
├── modules/             # Domain modules
│   ├── agents/          # AI agent CRUD, factory, search
│   ├── agui/            # AG-UI SSE streaming protocol
│   ├── auth/            # Clerk authentication middleware
│   ├── cron/            # Scheduled background jobs
│   ├── health/          # Health check endpoints
│   ├── knowledge/       # RAG knowledge bases (Qdrant)
│   ├── mail/            # Email sending (Resend)
│   ├── mcp/             # MCP server connectors + OAuth
│   ├── memory/          # File-based persistent memory
│   ├── providers/       # LLM provider credentials
│   ├── rateLimiter/     # API rate limiting
│   ├── skills/          # Agent skill library
│   ├── threads/         # Conversation threads + checkpoints
│   ├── tools/           # Agent tool registration
│   ├── upload/          # File uploads
│   ├── users/           # User profiles + admin
│   └── webhooks/        # Clerk webhook ingestion
│
├── utils/               # Shared utilities
│   ├── errors/          # Custom error classes
│   ├── formatters/      # Response formatters
│   ├── logger/          # Logger abstraction
│   ├── validators/      # Zod validation helpers
│   ├── encryption.js    # AES-256-GCM encryption
│   ├── constants.js
│   └── index.js         # Central re-exports
│
└── index.js             # App entry point
```

Every module follows a consistent layered structure:

```
src/modules/<module>/
├── index.js                  # Barrel exports
├── <module>.routes.js        # Express Router
├── <module>.controller.js    # HTTP handlers
├── <module>.service.js       # Business logic
├── <module>.repository.js    # Database access
├── <module>.model.js         # Mongoose schema
└── <module>.validator.js     # Zod validation schemas (if needed)
```

---

## Architecture Pattern

The backend follows a **layered architecture** with clear separation of concerns:

```
HTTP Request
    ↓
Routes (express.Router)
    ↓
Middleware (validation, rate limiting, auth)
    ↓
Controller (handles req/res, calls services)
    ↓
Service (business logic)
    ↓
Repository (database operations)
    ↓
Model (Mongoose schema)
```

### Key Rules

- **Controllers** only handle HTTP concerns (req/res). They never talk to models directly.
- **Services** contain business logic. They call repositories and other services.
- **Repositories** are the only layer that talks to the database. They use Mongoose models.
- **Models** define Mongoose schemas and export associated Zod schemas for validation.
- **Routes** wire controllers with middleware in a declarative style.

---

## Layer-by-Layer Breakdown

### 1. Config (`src/config/`)

- `index.js` — Central config object. Parses env vars, provides defaults. All other configs import from here.
- `database.js` — Singleton `Database` class. Manages MongoDB connection lifecycle.
- `jwt.config.js` — Re-exports JWT settings from main config.
- `mail.config.js` — Initializes email provider and template generator instances.

**Pattern**: Config is a plain object, not a class. Singleton for database.

### 2. Models (`src/modules/<module>/<module>.model.js`)

- Define Mongoose schemas in the model file within the owning module.
- Zod schemas for request validation live in the module's validator file.
- Sensitive fields use `select: false` in Mongoose.
- Export the model as default export.

```js
// Example pattern
export const UserRole = z.enum(['normal', 'admin']);
export const userSchema = z.object({ ... });
const userMongooseSchema = new mongoose.Schema({ ... });
const User = mongoose.model('User', userMongooseSchema);
export default User;
```

### 3. Repositories (`src/modules/<module>/<module>.repository.js`)

- **Classes** for complex repos, plain objects for simple ones.
- Exported as **singleton instances**.
- Throw custom errors (`NotFoundError`, `ValidationError`) — never return null/undefined for missing data.
- Handle pagination, filtering, and database-specific error codes (e.g., `11000` for duplicates).

```js
// Pattern: all find methods throw NotFoundError if nothing found
async findById(id) {
  const user = await User.findById(id);
  if (!user) {
    throw new NotFoundError(`User with id ${id} not found`);
  }
  return user;
}
```

### 4. Services (`src/modules/<module>/<module>.service.js`)

- **Business logic only** — no HTTP concerns (no req/res).
- Can be plain functions (e.g., `health.service.js`) or classes (e.g., `rateLimiter.service.js`).
- Depend on repositories via injection or import.
- Never import controllers or routes.
- Access other modules' data through their services (not repositories or models).

### 5. Controllers (`src/modules/<module>/<module>.controller.js`)

- Async functions with `(req, res, next)` signature.
- Wrap everything in `try/catch`, pass errors to `next(error)`.
- Use `successFormatter.formatSuccess()` for responses.
- Use `loggerService.getLogger()` for logging.
- Call services — never models or repositories directly.

```js
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    // ... business logic
    res.status(201).json(successFormatter.formatSuccess(data, message, 201));
  } catch (error) {
    next(error);
  }
};
```

### 6. Routes (`src/modules/<module>/<module>.routes.js`)

- Use `express.Router()`.
- Stack middleware before the controller: `auth → rateLimiter → validateBody → controller`.
- Export the router as default.
- Import auth middleware from `../auth/auth.middleware.js`.
- Import rate limiter from `../rateLimiter/rateLimiter.middleware.js`.

```js
router.post(
  '/',
  authMiddleware,
  rateLimiter('MUTATE', RATE_LIMITS.MUTATE),
  validateBody(createSchema),
  controller.create
);
```

### 7. Middlewares (`src/middlewares/` and `src/modules/<module>/`)

- **errorHandler.js** (`src/middlewares/`) — Final middleware. Logs errors, formats responses via `errorFormatter`.
- **validationMiddleware.js** (`src/middlewares/`) — Validates req body/query/params with Zod.
- **auth.middleware.js** (`src/modules/auth/`) — Verifies Clerk session, attaches `req.user`.
- **rateLimiter.middleware.js** (`src/modules/rateLimiter/`) — Per-endpoint rate limiting with presets.
- **admin.middleware.js** (`src/modules/users/`) — Admin role authorization check.

---

## SOLID Principles in Use

| Principle                 | How It's Applied                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| **Single Responsibility** | Each layer has one job. Controllers handle HTTP, services handle logic, repos handle DB.            |
| **Open/Closed**           | New error types extend `BaseError`. New rate limit presets added without changing middleware logic. |
| **Liskov Substitution**   | `InMemoryRateLimitStore` can be replaced with Redis store without changing service code.            |
| **Interface Segregation** | Separate `successFormatter` and `errorFormatter`. Small, focused utilities.                         |
| **Dependency Inversion**  | Logger is injected via `loggerService.getLogger()`. Store abstraction in rate limiter.              |

---

## Coding Conventions

### Style

- **ES Modules** — Use `import`/`export`, not `require`/`module.exports`.
- **File extensions** — Always include `.js` in import paths.
- **Single quotes** — `'hello'` not `"hello"`.
- **Semicolons** — Always.
- **Trailing commas** — ES5 style.
- **Print width** — 100 characters.
- **Tab width** — 2 spaces.
- **Prettier** — Auto-formats on save and pre-commit via Husky.

### Naming

| Type      | Convention              | Example                         |
| --------- | ----------------------- | ------------------------------- |
| Files     | kebab-case or camelCase | `auth.controller.js`, `User.js` |
| Classes   | PascalCase              | `UserRepository`, `BaseError`   |
| Functions | camelCase               | `hashPassword`, `getHealth`     |
| Constants | UPPER_SNAKE_CASE        | `RATE_LIMITS`, `SALT_ROUNDS`    |
| Variables | camelCase               | `userData`, `isConnected`       |
| Exports   | Named + default         | Both exported from most files   |

### JSDoc

- All classes and public methods have JSDoc comments.
- Include `@param`, `@returns`, and `@throws` where applicable.

```js
/**
 * Find user by ID
 * @param {string} id - User ID
 * @returns {Promise<Object>} User object
 */
async findById(id) { ... }
```

### Export Pattern

Every module exports both named and default:

```js
// Named exports
export { hashPassword, comparePassword };

// Default export (object grouping)
export default {
  hashPassword,
  comparePassword,
};
```

Index files re-export everything:

```js
export { default as successFormatter } from './successFormatter.js';
export { default as errorFormatter } from './errorFormatter.js';
```

---

## Error Handling

### Custom Error Hierarchy

```
Error
└── BaseError (statusCode, code, name, toJSON())
    ├── ValidationError
    ├── NotFoundError
    └── RateLimitError
```

### BaseError Pattern

```js
class BaseError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}
```

### Usage in Controllers

```js
throw new BaseError('Email already registered', 409, 'CONFLICT');
throw new NotFoundError(`User with id ${id} not found`);
```

### Error Middleware

All errors flow to `errorHandler.js` which:

1. Logs the error
2. Determines status code
3. Formats via `errorFormatter`
4. Sends JSON response

---

## Response Format

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "timestamp": "2026-04-03T00:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "status": "error",
  "statusCode": 400,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2026-04-03T00:00:00.000Z"
}
```

### Formatters

- `successFormatter.formatSuccess(data, message, code)` — For successful responses.
- `successFormatter.formatList(items, total, page, limit)` — For paginated lists.
- `errorFormatter.formatError(error, statusCode)` — For error responses.

---

## Validation

### Zod Schemas

Defined in each module's validator file (`src/modules/<module>/<module>.validator.js`).

```js
export const createSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
});
```

### Validation Middleware

```js
import { validateBody } from '../../middlewares/validationMiddleware.js';

// In route definition:
router.post('/', validateBody(createSchema), controller.create);
```

### Schema Validator Utilities

- `validateSchema(schema, data, options)` — Throws `ValidationError` on failure.
- `safeValidateSchema(schema, data, options)` — Returns `{ success, data, details }`.
- `createValidator(schema, options)` — Creates reusable validator function.

---

## Authentication & Authorization

### Flow

1. Client authenticates via **Clerk** (handles login, signup, session management).
2. Clerk session token is verified by `auth.middleware.js` (`src/modules/auth/`).
3. User is auto-synced to local MongoDB via `authService.syncUser(clerkId)`.
4. User object is attached to `req.user`.
5. Controller uses `req.user._id` for operations.

### Middleware Levels

| Middleware               | File                                           | Behavior                                               |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
| `authMiddleware`         | `src/modules/auth/auth.middleware.js`          | Required — returns 401 if no valid session             |
| `optionalAuthMiddleware` | `src/modules/auth/optional-auth.middleware.js` | Sets `req.user` if authenticated, continues if not     |
| `adminMiddleware`        | `src/modules/users/admin.middleware.js`        | Checks `role === 'admin'` (use after `authMiddleware`) |

### Role-Based Access

```js
// src/modules/users/user.model.js
export const UserRole = z.enum(['normal', 'admin']);
```

### Webhook-Based User Sync

Clerk sends lifecycle events (user.created, user.updated, user.deleted) to:

```
POST /api/v1/webhooks/clerk
```

Verified with Svix signatures. See `src/modules/webhooks/`.

---

## Rate Limiting

### Architecture

```
Middleware → Service → Repository (Store)
```

### Presets

```js
export const RATE_LIMITS = {
  CHAT: { maxRequests: 20, windowMs: 60 * 1000 }, // Chat/streaming
  MUTATE: { maxRequests: 30, windowMs: 60 * 1000 }, // Create/update/delete
};
```

### Usage

```js
import rateLimiter, { RATE_LIMITS } from '../modules/rateLimiter/rateLimiter.middleware.js';

router.post('/', rateLimiter('MUTATE', RATE_LIMITS.MUTATE), controller.create);
```

### Headers

Responses include rate limit headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (when limited)

---

## Database Patterns

### Connection

- Singleton `Database` class in `src/config/database.js`.
- Auto-connects on server start.
- Event listeners for `connected`, `error`, `disconnected`.
- Graceful shutdown on `SIGINT`/`SIGTERM`.

### Schema Design

- Timestamps enabled (`{ timestamps: true }`).
- `versionKey: false` (no `__v`).
- `toJSON`/`toObject` transforms: `_id` → `id`, remove `__v`.
- Indexes defined on frequently queried fields.
- Sensitive fields use `select: false`.

### Repository Pattern

- All DB operations go through repositories.
- Methods throw errors instead of returning null.
- Pagination uses `skip`/`limit` with `Promise.all` for count + data.
- Soft delete via `isActive` flag.

---

## Logging

### Logger Abstraction

```js
import { loggerService } from '../utils/index.js';
const logger = loggerService.getLogger();

logger.info('User registered', { userId: user.id, email });
logger.error('Failed to send email', { to, error: error.message });
logger.warn('Email provider not configured', { to });
logger.debug('Debug info', { data });
```

### ConsoleLogger

- Default implementation using `console.*`.
- Debug only active when `DEBUG` or `NODE_ENV=development`.
- Swappable via `loggerService.setLogger(newLogger)`.

### Log Format

```
[INFO] 2026-04-03T00:00:00.000Z - User registered { userId: '...', email: '...' }
```

---

## Email Service

### Stack

- **Resend** — Email delivery API.
- **Mailgen** — HTML email template generator.

### Pattern

- Graceful degradation: if API key is missing, logs warning and skips.
- Fire-and-forget in controllers (`.catch()` for logging, never blocks response).

```js
sendVerificationEmail(email, otp).catch((err) =>
  logger.error('Fire-and-forget verification email failed', { email, error: err.message })
);
```

### Email Types

- Verification email (with OTP)
- Welcome email
- Password reset email (with OTP)

---

## Encryption

### Algorithm

- AES-256-GCM with versioned tokens.
- Token format: `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>`
- Base64URL encoding for safe storage.

### Key Management

- Multiple keys supported via `DB_ENCRYPTION_KEYS` (JSON object).
- Active key specified via `DB_ENCRYPTION_ACTIVE_KEY_ID`.
- Key rotation: `needsReencryption()` detects old-key encrypted data.

### Usage

```js
import { encrypt, decrypt, needsReencryption } from '../utils/encryption.js';

const encrypted = encrypt(sensitiveValue);
const decrypted = decrypt(encryptedToken);
```

---

## Testing

### Framework

- **Jest** with `--experimental-vm-modules` for ESM support.
- **Supertest** for HTTP integration tests.

### Structure

```
tests/
├── jest.setup.js          # Test setup
├── *.test.js              # Test files mirror src structure
```

### Commands

```bash
pnpm test          # Run all tests with coverage
pnpm test:watch    # Watch mode
```

### Test Patterns

- Unit tests for individual functions/services.
- Integration tests for full request/response cycles.
- Mock repositories when testing services.
- Mock services when testing controllers.

---

## Environment Setup

### Required Env Vars

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/myapp

# JWT
JWT_SECRET=<generate with: pnpm keygen:secrets:jwt>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<generate with: pnpm keygen:secrets:jwt>
JWT_REFRESH_EXPIRES_IN=7d

# Email (optional for local dev)
RESEND_API_KEY=
MAIL_FROM=My App <noreply@myapp.com>

# Encryption (optional)
DB_ENCRYPTION_KEYS={"key1":"base64:..."}
DB_ENCRYPTION_ACTIVE_KEY_ID=key1

# Frontend URL
WEBSITE_URL=https://myapp.example.com/
```

### First-Time Setup

```bash
# Install dependencies
pnpm install

# Generate secrets
pnpm keygen:secrets:jwt
pnpm keygen:secrets:encryption

# Copy env example
cp .env.example .env

# Create admin user
pnpm admin:create
```

---

## Scripts & Commands

| Command                          | Description                      |
| -------------------------------- | -------------------------------- |
| `pnpm start`                     | Start production server          |
| `pnpm dev`                       | Start with nodemon (auto-reload) |
| `pnpm test`                      | Run all tests with coverage      |
| `pnpm test:watch`                | Run tests in watch mode          |
| `pnpm format`                    | Format all files with Prettier   |
| `pnpm format:check`              | Check formatting without changes |
| `pnpm keygen:secrets:jwt`        | Generate JWT secrets             |
| `pnpm keygen:secrets:encryption` | Generate encryption key          |
| `pnpm admin:create`              | Create admin user via CLI        |

---

## Adding a New Feature (Step-by-Step)

### Example: Adding a "Widgets" module

#### 1. Create Module Directory

```bash
mkdir src/modules/widgets
```

#### 2. Define the Model (`src/modules/widgets/widget.model.js`)

```js
import mongoose from 'mongoose';

const widgetSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    config: {
      type: Map,
      of: String,
      default: new Map(),
    },
  },
  { timestamps: true }
);

widgetSchema.index({ ownerId: 1, name: 1 }, { unique: true });

const Widget = mongoose.model('Widget', widgetSchema);
export default Widget;
```

#### 3. Create the Validator (`src/modules/widgets/widget.validator.js`)

```js
import { z } from 'zod';

export const createWidgetSchema = z.object({
  name: z.string().min(2).max(100),
  config: z.record(z.string()).optional(),
});

export const updateWidgetSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  config: z.record(z.string()).optional(),
});
```

#### 4. Create the Repository (`src/modules/widgets/widget.repository.js`)

```js
import Widget from './widget.model.js';

class WidgetRepository {
  async create(data) {
    return Widget.create(data);
  }

  async findById(id) {
    return Widget.findById(id);
  }

  async findByOwner(ownerId, skip = 0, limit = 10) {
    return Widget.find({ ownerId }).sort({ createdAt: -1 }).skip(skip).limit(limit);
  }

  async count(ownerId) {
    return Widget.countDocuments({ ownerId });
  }

  async update(id, data) {
    return Widget.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return Widget.findByIdAndDelete(id);
  }
}

export default new WidgetRepository();
```

#### 5. Create the Service (`src/modules/widgets/widget.service.js`)

```js
import widgetRepository from './widget.repository.js';

class WidgetService {
  async create(data, userId) {
    return widgetRepository.create({ ...data, ownerId: userId });
  }

  async getAll(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      widgetRepository.findByOwner(userId, skip, limit),
      widgetRepository.count(userId),
    ]);
    return { items, total };
  }

  async getById(id, userId) {
    const widget = await widgetRepository.findById(id);
    if (!widget || widget.ownerId.toString() !== userId.toString()) {
      throw new NotFoundError('Widget not found');
    }
    return widget;
  }

  async update(id, userId, data) {
    await this.getById(id, userId); // ownership check
    return widgetRepository.update(id, data);
  }

  async delete(id, userId) {
    await this.getById(id, userId); // ownership check
    return widgetRepository.delete(id);
  }
}

export default new WidgetService();
```

#### 6. Create the Controller (`src/modules/widgets/widget.controller.js`)

```js
import widgetService from './widget.service.js';
import { formatters } from '../../utils/index.js';

class WidgetController {
  async create(req, res, next) {
    try {
      const result = await widgetService.create(req.body, req.user._id);
      res.status(201).json(formatters.formatSuccess(result, 'Created'));
    } catch (err) {
      next(err);
    }
  }

  async getAll(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await widgetService.getAll(req.user._id, +page, +limit);
      res.json(formatters.formatList(result.items, result.total, +page || 1, +limit || 10));
    } catch (err) {
      next(err);
    }
  }
}

export default new WidgetController();
```

#### 7. Create the Routes (`src/modules/widgets/widget.routes.js`)

```js
import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createWidgetSchema, updateWidgetSchema } from './widget.validator.js';
import controller from './widget.controller.js';

const router = express.Router();

router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', mutateLimiter, validateBody(createWidgetSchema), controller.create);
router.patch('/:id', mutateLimiter, validateBody(updateWidgetSchema), controller.update);
router.delete('/:id', mutateLimiter, controller.delete);

export default router;
```

#### 8. Create Barrel Exports (`src/modules/widgets/index.js`)

```js
export { default as widgetRouter } from './widget.routes.js';
export { default as widgetService } from './widget.service.js';
```

#### 9. Register Routes (`src/index.js`)

```js
import { widgetRouter } from './modules/widgets/index.js';

app.use('/api/v1/widgets', widgetRouter);
```

#### 10. Write Tests

```bash
touch tests/widgetController.test.js
tests/widgetService.test.js
tests/widgetRepository.test.js
```

#### 11. Add Documentation

```bash
touch docs/modules/widgets.md
```

---

## Route Checklist

When adding a new route, verify:

- [ ] Zod validator schema created in module's validator file
- [ ] `validateBody(schema)` middleware added to route
- [ ] Rate limiter added for mutation endpoints
- [ ] Auth middleware applied (`authMiddleware` or `optionalAuthMiddleware`)
- [ ] Controller uses `try/catch` with `next(error)`
- [ ] Response uses `formatters.formatSuccess()`
- [ ] Errors use custom error classes (`BaseError`, `NotFoundError`, etc.)
- [ ] Logging added for important actions (`logger.info`, `logger.error`)
- [ ] Route registered in `src/index.js`
- [ ] Tests written for repository, service, and controller
- [ ] Prettier formatting applied (`pnpm format`)
- [ ] Module documentation added to `docs/modules/<module>.md`

---

## Git Workflow

- Branch protection on `main` — CI must pass before merge.
- Pre-commit hooks: Prettier auto-formats staged files.
- CI runs `pnpm test` on every push/PR.

```bash
# Create feature branch
git checkout -b feature/new-feature

# Commit (prettier runs automatically on staged files)
git add .
git commit -m "feat: add profile management endpoints"

# Push and create PR
git push -u origin feature/new-feature
```

---

## Quick Reference

### Import Patterns

```js
// From utils (central index)
import { loggerService, errors, formatters } from '../utils/index.js';

// From specific utilities
import { NotFoundError } from '../utils/errors/index.js';
import { formatters } from '../../utils/index.js';

// Config
import config from '../../config/index.js';
import database from '../../config/database.js';

// Within a module — relative imports
import repository from './<module>.repository.js';
import service from '../other-module/other.service.js';

// Cross-module — via barrel exports
import { agentService } from '../agents/index.js';
import { authMiddleware } from '../auth/index.js';
import { rateLimiterService } from '../rateLimiter/index.js';
```

### Common Error Codes

| Code               | Status | Usage                            |
| ------------------ | ------ | -------------------------------- |
| `UNAUTHORIZED`     | 401    | Invalid/missing auth             |
| `FORBIDDEN`        | 403    | Insufficient permissions         |
| `NOT_FOUND`        | 404    | Resource not found               |
| `CONFLICT`         | 409    | Duplicate resource (e.g., email) |
| `VALIDATION_ERROR` | 400    | Invalid input data               |
| `RATE_LIMITED`     | 429    | Too many requests                |
| `INTERNAL_ERROR`   | 500    | Unexpected server error          |

---

_Last updated: July 2026_
