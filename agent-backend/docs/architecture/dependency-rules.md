# Dependency Rules

## Layer Dependency Matrix

| From ↓ \ To →  | Route | Controller | Service | Repository | Model | Middleware | Validator |
| -------------- | ----- | ---------- | ------- | ---------- | ----- | ---------- | --------- |
| **Route**      | ❌    | ✅         | ❌      | ❌         | ❌    | ✅         | ❌        |
| **Controller** | ❌    | ❌         | ✅      | ❌         | ❌    | ❌         | ❌        |
| **Service**    | ❌    | ❌         | ✅      | ✅         | ❌    | ❌         | ❌        |
| **Repository** | ❌    | ❌         | ❌      | ❌         | ✅    | ❌         | ❌        |
| **Model**      | ❌    | ❌         | ❌      | ❌         | ❌    | ❌         | ❌        |

**Legend:** ✅ Allowed | ❌ Forbidden

## Allowed Dependencies

### Route → Controller ✅

Routes call controller methods to handle requests.

```javascript
// ✅ Correct
router.post('/', controller.create);
```

### Route → Middleware ✅

Routes apply middleware (auth, rate limiting, validation).

```javascript
// ✅ Correct
router.post('/', authMiddleware, rateLimiter('MUTATE'), controller.create);
```

### Controller → Service ✅

Controllers call services for business logic.

```javascript
// ✅ Correct
controller.create = async (req, res, next) => {
  const result = await service.create(req.body, req.user._id);
  res.status(201).json(result);
};
```

### Service → Repository ✅

Services call repositories for data access.

```javascript
// ✅ Correct
service.getById = async (id, userId) => {
  return repository.findById(id, userId);
};
```

### Service → Another Service ✅

Services may call other module services for cross-domain operations.

```javascript
// ✅ Correct — Cross-module service call
service.create = async (data, userId) => {
  const provider = await providerService.getDefault(userId);
  return repository.create({ ...data, providerId: provider._id });
};
```

### Repository → Model ✅

Repositories use Mongoose models for database operations.

```javascript
// ✅ Correct
repository.findById = async (id) => {
  return Model.findById(id);
};
```

## Forbidden Dependencies

### Route → Model ❌

Routes must never directly access database models.

```javascript
// ❌ INCORRECT — Route bypassing service layer
router.get('/:id', async (req, res) => {
  const agent = await Agent.findById(req.params.id); // DON'T
  res.json(agent);
});
```

### Controller → Model ❌

Controllers must never directly access database models.

```javascript
// ❌ INCORRECT — Controller bypassing service layer
controller.getById = async (req, res) => {
  const agent = await Agent.findById(req.params.id); // DON'T
  res.json(agent);
};
```

### Controller → Repository ❌

Controllers must never directly access repositories.

```javascript
// ❌ INCORRECT — Controller bypassing service layer
controller.getById = async (req, res) => {
  const agent = await agentRepository.findById(req.params.id); // DON'T
  res.json(agent);
};
```

### Repository → Controller/Service ❌

Repositories must never access higher layers.

```javascript
// ❌ INCORRECT — Circular dependency
repository.findById = async (id) => {
  const result = await Model.findById(id);
  await service.logAccess(id); // DON'T — service depends on repository
  return result;
};
```

### Route → Service (direct) ❌

Routes should call controllers, not services directly.

```javascript
// ❌ INCORRECT — Route bypassing controller
router.post('/', service.create); // DON'T
```

## Cross-Module Rules

### Allowed ✅

- Import another module's service layer
- Import another module's repository (when there's no service)
- Import models from `index.js` barrel exports for type references

### Forbidden ❌

- Import another module's internal files (bypassing `index.js`)
- Import another module's model directly in a controller
- Circular module imports (A → B → A)

## Configuration Dependency Rules

### All modules → `src/config/` ✅

Any module may import configuration.

```javascript
// ✅ Correct
import config from '../../config/index.js';
```

### All modules → `src/utils/` ✅

Any module may import shared utilities.

```javascript
// ✅ Correct
import { loggerService } from '../../utils/index.js';
import BaseError from '../../utils/errors/BaseError.js';
```

## Enforcement

These rules are enforced through:

1. **Code reviews** — All PRs must respect layer boundaries
2. **No architectural enforcement tool** — Currently relies on developer discipline
3. **Convention** — Consistent file structure makes violations easy to spot

## Rationale

| Rule                       | Reason                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| No route → model           | Routes would contain business logic or data access — hard to test and reuse        |
| No controller → model      | Controllers would bypass service validation and business rules                     |
| No controller → repository | Same as above; services exist for a reason                                         |
| No repository → service    | Would create circular dependency — repositories must be self-contained             |
| Barrel exports only        | Protects internal implementation; modules can refactor without affecting consumers |
