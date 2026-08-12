import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test: proves developerStore.routes.js actually
 * wires developerMachineAuthMiddleware + Zod validation + the controller
 * together, and — the one thing genuinely different from every other
 * developer*.routes.js file — that config CRUD works with a bare Project
 * (ProjectMachineContext) credential while file CRUD on an externalUser-
 * scoped store 400s without an asserted external user, decided per-request
 * by the controller rather than a static router-level guard.
 */

jest.unstable_mockModule('../src/modules/projects/projectCredential.service.js', () => ({
  default: { verifyCredential: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: { getProjectById: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/externalUsers/externalUser.service.js', () => ({
  default: { resolveOrCreate: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/stores/store.service.js', () => ({
  default: {
    createStore: jest.fn(),
    listStores: jest.fn(),
    countStores: jest.fn(),
    getStoreById: jest.fn(),
    updateStore: jest.fn(),
    deleteStore: jest.fn(),
    listStoreFiles: jest.fn(),
    getStoreFile: jest.fn(),
    writeStoreFile: jest.fn(),
    deleteStoreFile: jest.fn(),
  },
  EXTERNAL_USER_REQUIRED_MESSAGE:
    'This store requires an asserted external user (x-persona-external-user-id)',
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const externalUserService = (await import('../src/modules/externalUsers/externalUser.service.js'))
  .default;
const storeService = (await import('../src/modules/stores/store.service.js')).default;
const { default: developerStoreRouter } =
  await import('../src/modules/developer/developerStore.routes.js');

describe('developerStore.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/stores', developerStoreRouter);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred-1',
      project: 'project-1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project-1', status: 'ACTIVE' });
    externalUserService.resolveOrCreate.mockResolvedValue({});
  });

  test('401s without a Project credential', async () => {
    const res = await request(app).get('/api/v1/developer/stores');
    expect(res.status).toBe(401);
    expect(storeService.listStores).not.toHaveBeenCalled();
  });

  test('config CRUD works with a bare Project (machine) credential — no external user needed', async () => {
    storeService.createStore.mockResolvedValue({ _id: 's1', name: 'notes', scope: 'domain' });

    const res = await request(app)
      .post('/api/v1/developer/stores')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'notes', scope: 'domain' });

    expect(res.status).toBe(201);
    expect(storeService.createStore).toHaveBeenCalledWith('project-1', {
      name: 'notes',
      scope: 'domain',
    });
  });

  test('create 400s on an invalid name (Zod validation)', async () => {
    const res = await request(app)
      .post('/api/v1/developer/stores')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'Not Valid!', scope: 'domain' });

    expect(res.status).toBe(400);
    expect(storeService.createStore).not.toHaveBeenCalled();
  });

  test("a domain-scoped store's file route works with a bare machine credential", async () => {
    storeService.getStoreFile.mockResolvedValue({ path: '/a.md', content: 'hi' });

    const res = await request(app)
      .get('/api/v1/developer/stores/s1/file')
      .query({ path: '/a.md' })
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(storeService.getStoreFile).toHaveBeenCalledWith('project-1', 's1', undefined, '/a.md');
  });

  test("an externalUser-scoped store's file route 400s with no asserted external user", async () => {
    storeService.getStoreFile.mockRejectedValue(
      new Error('This store requires an asserted external user (x-persona-external-user-id)')
    );

    const res = await request(app)
      .get('/api/v1/developer/stores/s2/file')
      .query({ path: '/a.md' })
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EXTERNAL_USER_REQUIRED');
  });

  test('the same route succeeds once x-persona-external-user-id is asserted', async () => {
    storeService.getStoreFile.mockResolvedValue({ path: '/a.md', content: 'founder data' });

    const res = await request(app)
      .get('/api/v1/developer/stores/s2/file')
      .query({ path: '/a.md' })
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(storeService.getStoreFile).toHaveBeenCalledWith('project-1', 's2', 'sabik', '/a.md');
  });
});
