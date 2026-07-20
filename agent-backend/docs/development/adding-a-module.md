# How to Add a New Module

This guide walks through creating a new domain module from scratch.

## Step 1: Create Module Directory

```bash
mkdir src/modules/<module-name>
```

## Step 2: Create Files

Create the following files in your module directory. Not every module needs all files — use only what's necessary.

### 2.1 Model (`<module>.model.js`)

If your module owns data in MongoDB:

```javascript
import mongoose from 'mongoose';

const mySchema = new mongoose.Schema(
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
    // ... other fields
  },
  { timestamps: true }
);

export default mongoose.model('MyEntity', mySchema);
```

### 2.2 Validator (`<module>.validator.js`)

If your module has request validation:

```javascript
import { z } from 'zod';

export const createSchema = z.object({
  name: z.string().min(2).max(100),
  // ... other fields
});

export const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  // ... other fields
});
```

### 2.3 Repository (`<module>.repository.js`)

```javascript
import MyEntity from './<module>.model.js';

class MyRepository {
  async create(data) {
    return MyEntity.create(data);
  }

  async findById(id) {
    return MyEntity.findById(id);
  }

  async findByOwner(ownerId) {
    return MyEntity.find({ ownerId });
  }

  async update(id, data) {
    return MyEntity.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return MyEntity.findByIdAndDelete(id);
  }
}

export default new MyRepository();
```

### 2.4 Service (`<module>.service.js`)

```javascript
import repository from './<module>.repository.js';

class MyService {
  async create(data, userId) {
    // Business logic here
    return repository.create({ ...data, ownerId: userId });
  }

  async getById(id, userId) {
    const entity = await repository.findById(id);
    if (!entity || entity.ownerId.toString() !== userId.toString()) {
      throw new NotFoundError('Entity not found');
    }
    return entity;
  }

  // ... other methods
}

export default new MyService();
```

### 2.5 Controller (`<module>.controller.js`)

```javascript
import service from './<module>.service.js';
import { formatters } from '../../utils/index.js';

class MyController {
  async create(req, res, next) {
    try {
      const result = await service.create(req.body, req.user._id);
      res.status(201).json(formatters.formatSuccess(result, 'Created'));
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await service.getById(req.params.id, req.user._id);
      res.json(formatters.formatSuccess(result, 'Retrieved'));
    } catch (err) {
      next(err);
    }
  }

  // ... other methods
}

export default new MyController();
```

### 2.6 Routes (`<module>.routes.js`)

```javascript
import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createSchema, updateSchema } from './<module>.validator.js';
import controller from './<module>.controller.js';

const router = express.Router();

router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/<module-name>:
 *   get:
 *     tags: [ModuleName]
 *     summary: List all entities
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: List of entities
 *       401:
 *         description: Unauthorized
 */
router.get('/', controller.getAll);

/**
 * @openapi
 * /api/v1/<module-name>/{id}:
 *   get:
 *     tags: [ModuleName]
 *     summary: Get entity by ID
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entity details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Entity not found
 */
router.get('/:id', controller.getById);

/**
 * @openapi
 * /api/v1/<module-name>:
 *   post:
 *     tags: [ModuleName]
 *     summary: Create a new entity
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Entity created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', mutateLimiter, validateBody(createSchema), controller.create);

/**
 * @openapi
 * /api/v1/<module-name>/{id}:
 *   patch:
 *     tags: [ModuleName]
 *     summary: Update an entity
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Entity updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Entity not found
 *   delete:
 *     tags: [ModuleName]
 *     summary: Delete an entity
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entity deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Entity not found
 */
router.patch('/:id', mutateLimiter, validateBody(updateSchema), controller.update);
router.delete('/:id', mutateLimiter, controller.remove);

export default router;
```

> **Every route handler needs an `@openapi` JSDoc block.** Add one above each route — the spec is auto-generated from these annotations at startup. See [adding-an-endpoint.md](./adding-an-endpoint.md) for detailed annotation rules and a reference table.

### 2.7 Barrel Exports (`index.js`)

```javascript
export { default as myRouter } from './<module>.routes.js';
export { default as myService } from './<module>.service.js';
export { default as myRepository } from './<module>.repository.js';
// Export model only if it needs to be accessed externally
export { default as MyEntity } from './<module>.model.js';
```

## Step 3: Register Routes

In `src/index.js`, import and mount the router:

```javascript
import { myRouter } from './modules/<module-name>/index.js';

// Register route (choose appropriate prefix)
app.use('/api/v1/<module-name>', myRouter);
```

## Step 4: Add Tests

```bash
touch tests/<module-name>Controller.test.js
touch tests/<module-name>Service.test.js
touch tests/<module-name>Repository.test.js
```

## Step 5: Add Documentation

```bash
touch docs/modules/<module-name>.md
```

## Step 6: Verification Checklist

- [ ] All files created in `src/modules/<module-name>/`
- [ ] Barrel exports in `index.js`
- [ ] Routes registered in `src/index.js`
- [ ] `@openapi` JSDoc block added above every route handler
- [ ] Security key in `@openapi` block matches auth middleware (`[{ clerkAuth: [] }]` for auth, omit for public)
- [ ] Authentication middleware applied appropriately
- [ ] Rate limiting applied to mutation endpoints
- [ ] Validation schemas created and applied
- [ ] Tests written and passing
- [ ] Module documentation added to `docs/modules/<module-name>.md`
- [ ] Module linked from `docs/README.md`
- [ ] Verify new paths appear in `/docs` after starting the server
