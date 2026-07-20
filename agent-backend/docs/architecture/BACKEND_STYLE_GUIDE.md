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

| Category        | Technology           |
| --------------- | -------------------- |
| Runtime         | Node.js (ES Modules) |
| Framework       | Express 5            |
| Database        | MongoDB + Mongoose   |
| Validation      | Zod                  |
| Auth            | JWT + bcrypt         |
| Email           | Resend + Mailgen     |
| Testing         | Jest + Supertest     |
| Formatting      | Prettier             |
| Git Hooks       | Husky + lint-staged  |
| Package Manager | pnpm                 |
| API Docs        | Swagger (OpenAPI)    |

---

## Project Structure

```
src/
├── config/              # Environment & service configs
│   ├── index.js         # Main config (env parsing, defaults)
│   ├── database.js      # MongoDB singleton connection
│   ├── jwt.config.js    # JWT settings
│   └── mail.config.js   # Email provider setup
│
├── controllers/         # HTTP request handlers
│   ├── auth.controller.js
│   └── healthController.js
│
├── middlewares/         # Express middleware
│   ├── errorHandler.js
│   ├── auth.middleware.js
│   ├── validationMiddleware.js
│   └── rateLimiter.middleware.js
│
├── models/              # Mongoose schemas + Zod schemas
│   ├── User.js
│   └── index.js
│
├── repositories/        # Database access layer
│   ├── userRepository.js
│   ├── healthRepository.js
│   ├── rateLimiter.repository.js
│   └── index.js
│
├── routes/              # Express routers
│   ├── auth.routes.js
│   └── health.js
│
├── services/            # Business logic layer
│   ├── auth.service.js
│   ├── mail.service.js
│   ├── healthService.js
│   └── rateLimiter.service.js
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
├── validators/          # Zod schemas for request bodies
│   └── auth.validator.js
│
├── docs/                # OpenAPI/Swagger spec
│   └── openapi.js
│
└── index.js             # App entry point
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

### 2. Models (`src/models/`)

- Define **both** Mongoose schemas and Zod schemas in the same file.
- Zod schemas are used for request validation; Mongoose schemas for DB operations.
- Sensitive fields use `select: false` in Mongoose.
- Export both named and default exports.

```js
// Example pattern
export const UserRole = z.enum(['normal', 'admin']);
export const userSchema = z.object({ ... });
const userMongooseSchema = new mongoose.Schema({ ... });
const User = mongoose.model('User', userMongooseSchema);
export default User;
```

### 3. Repositories (`src/repositories/`)

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

### 4. Services (`src/services/`)

- **Business logic only** — no HTTP concerns (no req/res).
- Can be plain functions (e.g., `auth.service.js`) or classes (e.g., `rateLimiter.service.js`).
- Depend on repositories via injection or import.
- Never import controllers or routes.

### 5. Controllers (`src/controllers/`)

- Async functions with `(req, res, next)` signature.
- Wrap everything in `try/catch`, pass errors to `next(error)`.
- Use `successFormatter.formatSuccess()` for responses.
- Use `loggerService.getLogger()` for logging.
- Call services and repositories — never models directly.

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

### 6. Routes (`src/routes/`)

- Use `express.Router()`.
- Stack middleware before the controller: `rateLimiter → validateBody → authMiddleware → controller`.
- Export the router as default.

```js
router.post(
  '/register',
  rateLimiter('register', RATE_LIMITS.REGISTER),
  validateBody(registerSchema),
  authController.register
);
```

### 7. Middlewares (`src/middlewares/`)

- **errorHandler.js** — Final middleware. Logs errors, formats responses via `errorFormatter`.
- **auth.middleware.js** — Verifies JWT, attaches `req.user`.
- **validationMiddleware.js** — Validates req body/query/params with Zod.
- **rateLimiter.middleware.js** — Per-endpoint rate limiting with presets.

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

Defined in `src/validators/` for request bodies and in `src/models/` for data models.

```js
export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});
```

### Validation Middleware

```js
import { validateBody } from '../middlewares/validationMiddleware.js';

// In route definition:
router.post('/register', validateBody(registerSchema), authController.register);
```

### Schema Validator Utilities

- `validateSchema(schema, data, options)` — Throws `ValidationError` on failure.
- `safeValidateSchema(schema, data, options)` — Returns `{ success, data, details }`.
- `createValidator(schema, options)` — Creates reusable validator function.

---

## Authentication & Authorization

### Flow

1. Client sends `Authorization: Bearer <token>` header.
2. `auth.middleware.js` extracts and verifies JWT.
3. Finds user in DB, attaches to `req.user`.
4. Controller uses `req.user.id` for operations.

### Token Types

| Token         | Secret               | Expiry | Purpose            |
| ------------- | -------------------- | ------ | ------------------ |
| Access Token  | `JWT_SECRET`         | 15m    | API authentication |
| Refresh Token | `JWT_REFRESH_SECRET` | 7d     | Token renewal      |

### Password Handling

- Hashed with `bcrypt` (10 salt rounds).
- Stored with `select: false` in Mongoose schema.
- Retrieved explicitly with `.select('+password')`.

### Role-Based Access

```js
export const UserRole = z.enum(['normal', 'admin']);
// Admin users created only via CLI script
```

---

## Rate Limiting

### Architecture

```
Middleware → Service → Repository (Store)
```

### Presets

```js
export const RATE_LIMITS = {
  LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  REGISTER: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  FORGOT_PASSWORD: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  RESET_PASSWORD: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  RESEND_OTP: { maxRequests: 3, windowMs: 5 * 60 * 1000 },
  VERIFY_OTP: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
};
```

### Usage

```js
rateLimiter('login', RATE_LIMITS.LOGIN);
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

### Example: Adding a "Profile" feature

#### 1. Define the Model (`src/models/Profile.js`)

```js
import mongoose from 'mongoose';
import { z } from 'zod';

export const profileSchema = z.object({
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});

const profileMongooseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bio: { type: String, maxlength: 500 },
    avatar: { type: String },
  },
  { timestamps: true, versionKey: false }
);

const Profile = mongoose.model('Profile', profileMongooseSchema);
export default Profile;
```

#### 2. Create the Repository (`src/repositories/profileRepository.js`)

```js
import Profile from '../models/Profile.js';
import { NotFoundError } from '../utils/errors/index.js';

class ProfileRepository {
  async create(userId, data) {
    const profile = new Profile({ userId, ...data });
    return await profile.save();
  }

  async findByUserId(userId) {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      throw new NotFoundError(`Profile for user ${userId} not found`);
    }
    return profile;
  }

  async update(userId, data) {
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { ...data, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!profile) {
      throw new NotFoundError(`Profile for user ${userId} not found`);
    }
    return profile;
  }
}

const profileRepository = new ProfileRepository();
export default profileRepository;
```

#### 3. Create the Service (`src/services/profileService.js`)

```js
import profileRepository from '../repositories/profileRepository.js';

export const getProfile = async (userId) => {
  return await profileRepository.findByUserId(userId);
};

export const updateProfile = async (userId, data) => {
  return await profileRepository.update(userId, data);
};

export default { getProfile, updateProfile };
```

#### 4. Create the Controller (`src/controllers/profile.controller.js`)

```js
import profileService from '../services/profileService.js';
import { successFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

export const getProfile = async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.user.id);
    res.json(successFormatter.formatSuccess(profile));
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const profile = await profileService.updateProfile(req.user.id, req.body);
    logger.info('Profile updated', { userId: req.user.id });
    res.json(successFormatter.formatSuccess(profile, 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

export default { getProfile, updateProfile };
```

#### 5. Create the Validator (`src/validators/profile.validator.js`)

```js
import { z } from 'zod';

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
});
```

#### 6. Create the Routes (`src/routes/profile.routes.js`)

```js
import express from 'express';
import profileController from '../controllers/profile.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { updateProfileSchema } from '../validators/profile.validator.js';

const router = express.Router();

router.get('/', authMiddleware, profileController.getProfile);
router.patch(
  '/',
  authMiddleware,
  validateBody(updateProfileSchema),
  profileController.updateProfile
);

export default router;
```

#### 7. Register Routes (`src/index.js`)

```js
import profileRouter from './routes/profile.routes.js';

app.use('/api/v1/profile', profileRouter);
```

#### 8. Update Models Index (`src/models/index.js`)

```js
import Profile, { profileSchema } from './Profile.js';

export { User, userSchema, UserRole, Profile, profileSchema };
```

#### 9. Update Repositories Index (`src/repositories/index.js`)

```js
import profileRepository from './profileRepository.js';

export { healthRepository, userRepository, InMemoryRateLimitStore, profileRepository };
```

#### 10. Write Tests

Create `tests/profileRepository.test.js`, `tests/profileService.test.js`, `tests/profileController.test.js`, etc.

---

## Route Checklist

When adding a new route, verify:

- [ ] Zod validator schema created in `src/validators/`
- [ ] `validateBody(schema)` middleware added to route
- [ ] Rate limiter added if applicable (`rateLimiter('endpoint', RATE_LIMITS.PRESET)`)
- [ ] Auth middleware added if route requires authentication
- [ ] Controller uses `try/catch` with `next(error)`
- [ ] Response uses `successFormatter.formatSuccess()`
- [ ] Errors use custom error classes (`BaseError`, `NotFoundError`, etc.)
- [ ] Logging added for important actions (`logger.info`, `logger.error`)
- [ ] Route registered in `src/index.js`
- [ ] OpenAPI spec updated in `src/docs/openapi.js`
- [ ] Tests written for repository, service, and controller
- [ ] Prettier formatting applied (`pnpm format`)

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

// From specific modules
import { NotFoundError } from '../utils/errors/index.js';
import { successFormatter } from '../utils/formatters/index.js';

// Config
import config from '../config/index.js';
import database from '../config/database.js';

// Singleton repositories/services
import userRepository from '../repositories/userRepository.js';
import rateLimiterService from '../services/rateLimiter.service.js';
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

_Last updated: April 2026_
