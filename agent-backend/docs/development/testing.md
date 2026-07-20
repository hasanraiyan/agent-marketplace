# Testing Guide

## Test Runner

Tests use **Jest** with **Supertest** for HTTP integration testing.

## Running Tests

```bash
# Full test suite with coverage
pnpm test

# Watch mode (auto-rerun on changes)
pnpm run test:watch

# AI stack smoke test (no API keys required)
pnpm run ai:verify
```

## Test Configuration

From `jest.config.cjs`:

```javascript
module.exports = {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {},
  setupFilesAfterSetup: ['./tests/jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
};
```

Tests use `cross-env NODE_ENV=test` and `--experimental-vm-modules` for ES Module support.

## Test Structure

Tests are located in `agent-backend/tests/` and follow the naming convention `<module>.<layer>.test.js`:

```
tests/
├── agentController.test.js
├── agentRepository.test.js
├── agentService.test.js
├── agentValidator.test.js
├── healthController.test.js
├── healthRepository.test.js
├── healthService.test.js
├── threadController.test.js
├── threadRepository.test.js
├── mcp.service.test.js
├── mcp.tools.test.js
├── knowledgeService.test.js
├── knowledgeController.test.js
├── errorHandler.test.js
├── ... etc
```

## Test File Pattern

### Controller Tests

```javascript
import request from 'supertest';
import app from '../src/index.js';

describe('GET /api/v1/health', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('uptime');
  });
});
```

### Service Tests

```javascript
import service from '../src/modules/<module>/<module>.service.js';

describe('MyService.create', () => {
  it('should create entity with valid data', async () => {
    const result = await service.create({ name: 'Test' }, userId);
    expect(result).toHaveProperty('_id');
    expect(result.name).toBe('Test');
  });

  it('should throw on duplicate name', async () => {
    await service.create({ name: 'Test' }, userId);
    await expect(
      service.create({ name: 'Test' }, userId)
    ).rejects.toThrow();
  });
});
```

### Repository Tests

```javascript
import repository from '../src/modules/<module>/<module>.repository.js';

describe('MyRepository', () => {
  it('should create and find by id', async () => {
    const created = await repository.create({ name: 'Test', ownerId: userId });
    const found = await repository.findById(created._id);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Test');
  });
});
```

## Test Setup

From `tests/jest.setup.js`:

```javascript
// Global test setup
// - Sets NODE_ENV=test
// - Connects to test database
// - Cleans up between tests (if configured)
```

## What to Test

| Layer | What to Test |
|-------|-------------|
| **Controller** | HTTP status codes, response format, auth enforcement |
| **Service** | Business logic, validation rules, error handling |
| **Repository** | CRUD operations, query filters, data integrity |
| **Validator** | Valid inputs pass, invalid inputs fail, edge cases |
| **Middleware** | Auth rejection, rate limiting, error formatting |

## Test Coverage

Tests produce coverage reports in the `coverage/` directory. Run coverage with:

```bash
pnpm test
```
