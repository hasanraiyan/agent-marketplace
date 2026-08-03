import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (Feature 6, audit log read endpoint):
 * proves developerAuditLog.routes.js actually wires
 * developerMachineAuthMiddleware + the controller together.
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
jest.unstable_mockModule('../src/modules/audit/auditLog.service.js', () => ({
  default: {
    listForDomain: jest.fn(),
    countForDomain: jest.fn(),
  },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const auditLogService = (await import('../src/modules/audit/auditLog.service.js')).default;
const { default: developerAuditLogRouter } =
  await import('../src/modules/developer/developerAuditLog.routes.js');

describe('developerAuditLog.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/audit-logs', developerAuditLogRouter);
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
    const res = await request(app).get('/api/v1/developer/audit-logs');

    expect(res.status).toBe(401);
    expect(auditLogService.listForDomain).not.toHaveBeenCalled();
  });

  test('GET / reaches the controller and returns a pagination envelope for a ProjectMachineContext', async () => {
    auditLogService.listForDomain.mockResolvedValue([{ eventType: 'credential.created' }]);
    auditLogService.countForDomain.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/developer/audit-logs')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(auditLogService.listForDomain).toHaveBeenCalledWith(
      'project-1',
      expect.any(Object),
      expect.any(Object)
    );
    expect(res.body).toEqual({
      success: true,
      data: {
        items: [{ eventType: 'credential.created' }],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      },
    });
  });

  test('GET / with a ProjectRuntimeContext gets a silent empty envelope, never calling the service', async () => {
    const { default: externalUserService } =
      await import('../src/modules/externalUsers/externalUser.service.js');
    externalUserService.resolveOrCreate.mockResolvedValue({});

    const res = await request(app)
      .get('/api/v1/developer/audit-logs')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(auditLogService.listForDomain).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      success: true,
      data: { items: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } },
    });
  });

  test('GET /?eventType=... forwards the filter to the service', async () => {
    auditLogService.listForDomain.mockResolvedValue([]);
    auditLogService.countForDomain.mockResolvedValue(0);

    await request(app)
      .get('/api/v1/developer/audit-logs')
      .query({ eventType: 'credential.revoked', page: 2, limit: 5 })
      .set('Authorization', 'Bearer pk_test.secret');

    expect(auditLogService.listForDomain).toHaveBeenCalledWith(
      'project-1',
      { eventType: 'credential.revoked' },
      { page: 2, limit: 5 }
    );
  });
});
