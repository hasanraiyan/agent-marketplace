import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 8, PR-20): proves
 * developerMachineAuthMiddleware — already unit-tested in
 * developerMachineAuthMiddleware.test.js — is actually reachable end-to-end
 * once mounted at /api/v1/developer, not just correct in isolation.
 */

jest.unstable_mockModule('../src/modules/projects/projectCredential.service.js', () => ({
  default: {
    verifyCredential: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: {
    getProjectById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/externalUsers/externalUser.service.js', () => ({
  default: {
    resolveOrCreate: jest.fn(),
  },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const externalUserService = (await import('../src/modules/externalUsers/externalUser.service.js'))
  .default;
const { default: developerRouter } = await import('../src/modules/developer/developer.routes.js');

describe('developer.routes.js — GET /whoami', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use('/api/v1/developer', developerRouter);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns a ProjectMachineContext for a valid credential on an ACTIVE Project', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred_1',
      project: 'project_1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project_1', status: 'ACTIVE' });

    const res = await request(app)
      .get('/api/v1/developer/whoami')
      .set('Authorization', 'Bearer pk_test.secret-value');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      domain: 'project_1',
      principalType: 'ProjectMachine',
      credentialId: 'cred_1',
    });
  });

  test('returns a ProjectRuntimeContext when x-persona-external-user-id is also presented', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred_1',
      project: 'project_1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project_1', status: 'ACTIVE' });
    externalUserService.resolveOrCreate.mockResolvedValue({});

    const res = await request(app)
      .get('/api/v1/developer/whoami')
      .set('Authorization', 'Bearer pk_test.secret-value')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      domain: 'project_1',
      principalType: 'ProjectRuntime',
      credentialId: 'cred_1',
      externalUserId: 'sabik',
    });
  });

  test('401s without ever reaching the controller when no credential is presented', async () => {
    const res = await request(app).get('/api/v1/developer/whoami');

    expect(res.status).toBe(401);
    expect(projectCredentialService.verifyCredential).not.toHaveBeenCalled();
  });

  test('401s for an invalid credential', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/developer/whoami')
      .set('Authorization', 'Bearer pk_test.wrong-secret');

    expect(res.status).toBe(401);
  });

  test('403s for a valid credential on a SUSPENDED Project', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred_1',
      project: 'project_1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project_1', status: 'SUSPENDED' });

    const res = await request(app)
      .get('/api/v1/developer/whoami')
      .set('Authorization', 'Bearer pk_test.secret-value');

    expect(res.status).toBe(403);
  });
});
