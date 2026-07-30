import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 9, PR-38): proves
 * developerProvider.routes.js actually wires developerMachineAuthMiddleware
 * + Zod validation + the controller together.
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
jest.unstable_mockModule('../src/modules/providers/provider.service.js', () => ({
  default: {
    createProvider: jest.fn(),
    getProviderById: jest.fn(),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
  },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const providerService = (await import('../src/modules/providers/provider.service.js')).default;
const { default: developerProviderRouter } =
  await import('../src/modules/developer/developerProvider.routes.js');

describe('developerProvider.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/providers', developerProviderRouter);
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
  });

  test('401s without a Project credential, never reaching the controller', async () => {
    const res = await request(app).post('/api/v1/developer/providers').send({
      label: 'Test Provider',
      baseURL: 'https://api.example.com',
      apiKey: 'key',
      defaultModel: 'gpt-4o',
    });

    expect(res.status).toBe(401);
    expect(providerService.createProvider).not.toHaveBeenCalled();
  });

  test('400s on an invalid body (baseURL is not a valid URL)', async () => {
    const res = await request(app)
      .post('/api/v1/developer/providers')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({
        label: 'Test Provider',
        baseURL: 'not-a-url',
        apiKey: 'key',
        defaultModel: 'gpt-4o',
      });

    expect(res.status).toBe(400);
    expect(providerService.createProvider).not.toHaveBeenCalled();
  });

  test('creates a Provider for a valid credential + valid body', async () => {
    providerService.createProvider.mockResolvedValue({ id: 'p1', label: 'Test Provider' });

    const res = await request(app)
      .post('/api/v1/developer/providers')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({
        label: 'Test Provider',
        baseURL: 'https://api.example.com',
        apiKey: 'key',
        defaultModel: 'gpt-4o',
      });

    expect(res.status).toBe(201);
    expect(providerService.createProvider).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ label: 'Test Provider' }),
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('400s and skips the service when the request asserts an external user', async () => {
    const res = await request(app)
      .post('/api/v1/developer/providers')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({
        label: 'Test Provider',
        baseURL: 'https://api.example.com',
        apiKey: 'key',
        defaultModel: 'gpt-4o',
      });

    expect(res.status).toBe(400);
    expect(providerService.createProvider).not.toHaveBeenCalled();
  });

  test('GET /:providerId reaches the controller and returns the Provider', async () => {
    providerService.getProviderById.mockResolvedValue({ id: 'p1' });

    const res = await request(app)
      .get('/api/v1/developer/providers/p1')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(providerService.getProviderById).toHaveBeenCalledWith(
      'p1',
      undefined,
      expect.any(Object)
    );
  });
});
