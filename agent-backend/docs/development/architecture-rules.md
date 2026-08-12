# Architecture Rules

This document captures the architectural constraints that every developer must follow when modifying the codebase.

## Layer Boundaries

### ✅ Allowed

- **Route** → Controller, Middleware
- **Controller** → Service
- **Service** → Service (cross-module), Repository
- **Repository** → Model
- **Any** → Config (`src/config/`)
- **Any** → Utils (`src/utils/`)

### ❌ Forbidden

- **Route** → Model, Repository, Service (directly)
- **Controller** → Model, Repository
- **Repository** → Service, Controller
- **Model** → Any layer above

## Module Boundaries

### ✅ Allowed

- Import another module via its barrel (`index.js`)
- Import another module's service
- Import another module's repository (if no service exists)

### ❌ Forbidden

- Import another module's internal files (bypassing `index.js`)
- Import a model from one module into another module's controller
- Circular dependencies between modules

## Cross-Module Data Access

**Always access another module's data through its service or repository, never through its model directly.**

```javascript
// ✅ Correct
import { providerService } from '../providers/index.js';
const provider = await providerService.getDefault(userId);

// ❌ Incorrect
import Provider from '../providers/provider.model.js';
const provider = await Provider.findOne({ ownerId: userId, isDefault: true });
```

## File Naming Convention

All module files follow: `<module>.<layer>.js`

| Layer      | File Name                |
| ---------- | ------------------------ |
| Routes     | `<module>.routes.js`     |
| Controller | `<module>.controller.js` |
| Service    | `<module>.service.js`    |
| Repository | `<module>.repository.js` |
| Model      | `<module>.model.js`      |
| Validator  | `<module>.validator.js`  |
| Factory    | `<module>.factory.js`    |
| Barrel     | `index.js`               |

## Response Format

All endpoints must use the standard formatters from `src/utils/formatters/`:

```javascript
import { formatters } from '../../utils/index.js';

// Success
res.json(formatters.formatSuccess(data, 'Message'));

// Created
res.status(201).json(formatters.formatSuccess(result, 'Created'));

// Paginated list
res.json(formatters.formatList(items, total, page, limit));
```

## Error Handling

- Services throw errors; controllers catch and pass to `next(err)`
- Use custom error classes: `NotFoundError`, `ValidationError`, `BaseError`
- Never catch errors in services to format them — let them propagate

## Authentication Rules

| Route Type                        | Middleware                           |
| --------------------------------- | ------------------------------------ |
| Public                            | No middleware                        |
| Public with optional user context | `optionalAuthMiddleware`             |
| User-only                         | `authMiddleware`                     |
| Admin-only                        | `authMiddleware` + `adminMiddleware` |

## Rate Limiting Rules

| Operation                          | Rate Limit      |
| ---------------------------------- | --------------- |
| Chat/streaming                     | 20 requests/min |
| Mutations (create, update, delete) | 30 requests/min |

## Code Organization

1. **One class per file** — Each file exports a single class or function
2. **Singleton pattern** — Services, repositories are singletons exported as default
3. **Named exports for configs** — Named exports for validators and constants
4. **ES Modules** — All files use `import`/`export` syntax
5. **No `require()`** — The project uses ES Modules exclusively

## Testing Rules

1. Every module should have controller, service, and repository tests
2. Tests must be independent — no shared state between tests
3. Use `supertest` for integration tests, direct function calls for unit tests
4. Mock external services (Qdrant, Resend, Clerk) in tests

## Documentation Rules

1. Every module must have a documentation file in `docs/modules/`
2. New endpoints must be added to the API route table
3. Environment variables must be documented in `docs/operations/environment-variables.md`
4. Keep Mermaid diagrams in sync with actual implementation
