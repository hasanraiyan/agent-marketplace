# How to Add Validation

Request validation uses **Zod** schemas applied via the `validationMiddleware`.

## Validation Schema Pattern

Create validators in `<module>.validator.js`:

```javascript
import { z } from 'zod';

// Create schema — all fields required (unless optional)
export const createEntitySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(150).optional(),
  tags: z.array(z.string()).max(10).optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
  config: z.object({
    setting1: z.boolean(),
    setting2: z.string().max(500),
  }).optional(),
});

// Update schema — all fields optional
export const updateEntitySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(150).optional(),
});

// Search schema — with pagination defaults
export const searchEntitySchema = z.object({
  query: z.string().optional(),
  category: z.enum(['a', 'b', 'c']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
```

## Applying Validation in Routes

```javascript
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createEntitySchema, searchEntitySchema } from './<module>.validator.js';

// Body validation
router.post('/', validateBody(createEntitySchema), controller.create);

// Query validation
router.get('/', validateQuery(searchEntitySchema), controller.search);
```

## Validation Middleware

The `validateBody(schema)` function:
1. Parses `req.body` against the Zod schema
2. On success: replaces `req.body` with validated data
3. On failure: throws `ValidationError` with field-level details

```javascript
// On validation failure, returns:
{
  "success": false,
  "status": "error",
  "statusCode": 400,
  "message": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "errors": [
      { "field": "body.email", "message": "Invalid email format" },
      { "field": "body.name", "message": "Required" }
    ]
  }
}
```

## Schema Validation Utilities

### validateSchema
Throws `ValidationError` on failure:

```javascript
import { validateSchema } from '../../utils/validators/schemaValidator.js';

const validated = validateSchema(mySchema, data, { stripUnknown: true });
```

### safeValidateSchema
Returns result object instead of throwing:

```javascript
import { safeValidateSchema } from '../../utils/validators/schemaValidator.js';

const result = safeValidateSchema(mySchema, data);
if (result.success) {
  // result.data
} else {
  // result.details — array of { field, message, code }
}
```

### Common Schema Reusables

```javascript
import { schemas } from '../../utils/validators/schemaValidator.js';

schemas.nonEmptyString;      // z.string().min(1)
schemas.email;               // z.string().email()
schemas.password;            // z.string().min(8)
schemas.url;                 // z.string().url()
schemas.objectId;            // z.string().regex(/^[0-9a-fA-F]{24}$/)
schemas.positiveNumber;      // z.number().positive()
schemas.integer;             // z.number().int()
```

## Best Practices

1. **Create schemas in validators** — not in the route or controller
2. **Export named schemas** — `export const createSchema = ...`
3. **Use `.optional()` for update schemas** — all fields should be optional
4. **Set sensible defaults** — `default(1)` for page, `default(10)` for limit
5. **Use `z.coerce.number()` for query params** — query strings are always strings
6. **Validate enums with `z.enum()`** — catches typos early
7. **Keep validation in the module** — don't create global validators
