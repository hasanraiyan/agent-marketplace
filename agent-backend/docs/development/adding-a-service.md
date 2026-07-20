# How to Add a Service

Services contain **business logic** and **cross-module coordination**.

## Service Pattern

```javascript
import repository from './<module>.repository.js';
import otherService from '../other-module/other.service.js';
import { NotFoundError } from '../../utils/errors/index.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

class MyService {
  async create(data, userId) {
    // 1. Validate business rules
    this._validateBusinessRules(data);

    // 2. Check for conflicts
    const existing = await repository.findByName(data.name, userId);
    if (existing) {
      throw new BaseError('Entity with this name already exists', 409, 'CONFLICT');
    }

    // 3. Cross-module coordination
    const provider = await otherService.getDefault(userId);

    // 4. Create with enriched data
    return repository.create({
      ...data,
      ownerId: userId,
      providerId: provider._id,
    });
  }

  _validateBusinessRules(data) {
    if (data.something && !data.somethingElse) {
      throw new ValidationError('When something is set, somethingElse must also be set');
    }
  }
}

export default new MyService();
```

## Service Best Practices

### 1. Business Logic Only
Services should contain business rules, not HTTP concerns. Don't access `req`, `res`, or `next` in services.

### 2. Throw Errors, Don't Catch
Let errors propagate to the controller → global error handler.

```javascript
// ✅ Correct
async getById(id) {
  const entity = await repository.findById(id);
  if (!entity) throw new NotFoundError('Entity not found');
  return entity;
}

// ❌ Incorrect — catching and formatting in service
async getById(id) {
  try {
    return await repository.findById(id);
  } catch (err) {
    return { error: 'Not found' }; // DON'T
  }
}
```

### 3. Cross-Module via Services Only
Access other modules through their services, not repositories or models.

```javascript
// ✅ Correct
import { providerService } from '../providers/index.js';
const provider = await providerService.getDefault(userId);

// ❌ Incorrect — bypassing other module's service
import { providerRepository } from '../providers/index.js';
const provider = await providerRepository.findByUser(userId);
```

### 4. Use Singleton Pattern
```javascript
export default new MyService();
```

### 5. Log Important Operations
```javascript
logger.info('Entity created', { entityId: result._id, userId });
logger.error('Failed to create entity', { error: err.message, data });
```

## When to Create a Service

Create a service when you have:
- Business rules to enforce
- Cross-module coordination
- Data transformation logic
- Complex validation beyond Zod schemas

If a module only does simple CRUD with no business logic, consider calling the repository directly from the controller.
