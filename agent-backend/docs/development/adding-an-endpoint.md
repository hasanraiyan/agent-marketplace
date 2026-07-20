# How to Add an Endpoint

This guide walks through adding a new API endpoint to an existing module.

## Step 1: Add the Route

In `<module>.routes.js`, add a new route:

```javascript
// GET /api/v1/<module>/search
router.get(
  '/search',
  authMiddleware,
  controller.search
);

// POST /api/v1/<module> (with validation and rate limiting)
router.post(
  '/',
  authMiddleware,
  rateLimiter('MUTATE', RATE_LIMITS.MUTATE),
  validateBody(createSchema),
  controller.create
);
```

### Route Middleware Order

Always apply middleware in this order:
1. **Auth** — `authMiddleware` or `optionalAuthMiddleware`
2. **Rate Limiter** — For mutation endpoints
3. **Validation** — `validateBody(schema)` or `validateQuery(schema)`
4. **Controller** — The handler function

### OpenAPI Documentation (Add Above Every Route Handler)

Every route handler needs an `@openapi` JSDoc block directly above it.
The spec is auto-generated at startup by `swagger-jsdoc` — there is **no**
separate OpenAPI file to update. Add the annotation at the same time you
write the route, not later.

```javascript
/**
 * @openapi
 * /api/v1/<module>/search:
 *   post:
 *     tags: [ModuleName]
 *     summary: What this endpoint does
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/search', authMiddleware, controller.search);
```

### Annotation Rules

| Rule | Example |
|------|---------|
| **Auth-required endpoints** | `security: [{ clerkAuth: [] }]` |
| **Public endpoints** (webhooks, OAuth callbacks) | Omit `security` key entirely |
| **Path parameters** | `/users/{id}` — use `{param}` syntax |
| **Header parameters** | `in: header` for things like `x-agent-id` |
| **Multipart uploads** | `content: multipart/form-data` |
| **Response codes** | 201 for create, 400/401/403/404/503 as appropriate |
| **Shared schemas** | `$ref: '#/components/schemas/SchemaName'` |
| **YAML indentation** | Exactly 2 spaces per level |
| **Tags** | Match module name: `[Agents]`, `[MCP]`, `[Knowledge]` |

## Step 2: Add Validation (if needed)

In `<module>.validator.js`, add Zod schemas:

```javascript
export const searchSchema = z.object({
  query: z.string().optional(),
  category: z.enum(['productivity', 'coding', 'creative']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});
```

## Step 3: Add Controller Method

In `<module>.controller.js`, add the handler:

```javascript
async search(req, res, next) {
  try {
    const { query, category, page, limit } = req.body;
    const userId = req.user?._id;

    const result = await service.search({ query, category, page, limit }, userId);
    res.json(formatters.formatList(result.items, result.total, page, limit));
  } catch (err) {
    next(err);
  }
}
```

## Step 4: Add Service Method

In `<module>.service.js`, add the business logic:

```javascript
async search(filters, userId) {
  const { query, category, page, limit } = filters;
  const skip = (page - 1) * limit;

  const filter = {};
  if (category) filter.category = category;
  if (query) filter.name = { $regex: query, $options: 'i' };

  // Respect visibility rules
  filter.$or = [
    { ownerId: userId },
    { visibility: 'public' },
  ];

  const [items, total] = await Promise.all([
    repository.search(filter, skip, limit),
    repository.count(filter),
  ]);

  return { items, total };
}
```

## Step 5: Add Repository Method

In `<module>.repository.js`, add the data access:

```javascript
async search(filter, skip, limit) {
  return Model.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

async count(filter) {
  return Model.countDocuments(filter);
}
```

## Step 6: Add Tests

In `tests/<module>Controller.test.js`:

```javascript
describe('GET /api/v1/<module>/search', () => {
  it('should return filtered results', async () => {
    const res = await request(app)
      .post('/api/v1/<module>/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'coding', page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.pagination).toHaveProperty('total');
  });
});
```

## Endpoint Checklist

- [ ] Route defined in `.routes.js`
- [ ] `@openapi` JSDoc block added above the route handler
- [ ] Validation schema created (if accepting input)
- [ ] Controller method created
- [ ] Service method created
- [ ] Repository method created (if accessing DB)
- [ ] Auth middleware applied correctly (`authMiddleware` or `optionalAuthMiddleware`)
- [ ] Security key in `@openapi` block matches auth middleware (`[{ clerkAuth: [] }]` for auth, omit for public)
- [ ] Rate limiting applied for mutations
- [ ] Tests written and passing
- [ ] Error cases handled (not found, unauthorized, validation failure)
- [ ] Response uses standard formatter
- [ ] Verify path appears in `/docs` after starting the server
