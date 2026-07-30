import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 9, PR-47d): proves
 * developerFile.routes.js actually wires developerMachineAuthMiddleware +
 * the ProjectRuntime-only guard + multer + the controller together.
 * Mirrors developerThreadRoutes.integration.test.js's pattern exactly.
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
jest.unstable_mockModule('../src/modules/files/file.service.js', () => ({
  default: {
    createFile: jest.fn(),
    getFileForDownload: jest.fn(),
    listFiles: jest.fn(),
    deleteFile: jest.fn(),
  },
  developerUploadDir: '/tmp/developer-uploads-test',
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const externalUserService = (await import('../src/modules/externalUsers/externalUser.service.js'))
  .default;
const fileService = (await import('../src/modules/files/file.service.js')).default;
const { default: developerFileRouter } =
  await import('../src/modules/developer/developerFile.routes.js');

describe('developerFile.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use('/api/v1/developer/files', developerFileRouter);
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

  test('401s without a Project credential, never reaching the controller', async () => {
    const res = await request(app).get('/api/v1/developer/files');

    expect(res.status).toBe(401);
    expect(fileService.listFiles).not.toHaveBeenCalled();
  });

  test('400s (EXTERNAL_USER_REQUIRED) for a bare ProjectMachineContext, no asserted external user', async () => {
    const res = await request(app)
      .get('/api/v1/developer/files')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/external user/i);
    expect(fileService.listFiles).not.toHaveBeenCalled();
  });

  test('lists files for a valid ProjectRuntimeContext', async () => {
    fileService.listFiles.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/developer/files')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(fileService.listFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      }),
      expect.any(Object)
    );
  });

  test('uploads a real multipart file for a valid ProjectRuntimeContext', async () => {
    fileService.createFile.mockResolvedValue({
      _id: 'f1',
      originalName: 'test.txt',
      mimeType: 'text/plain',
      size: 11,
      agentId: null,
      threadId: null,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/developer/files')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .attach('file', Buffer.from('hello world'), 'test.txt');

    expect(res.status).toBe(201);
    expect(fileService.createFile).toHaveBeenCalledWith(
      expect.objectContaining({ principalType: 'ProjectRuntime', externalUserId: 'sabik' }),
      expect.objectContaining({ originalname: 'test.txt' }),
      expect.any(Object)
    );
  });

  test('GET /:fileId reaches the controller and streams via res.download', async () => {
    fileService.getFileForDownload.mockResolvedValue({
      storageKey: 'uuid-1.txt',
      originalName: 'test.txt',
    });

    const res = await request(app)
      .get('/api/v1/developer/files/f1')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    // res.download() on a nonexistent path 500s in this mocked-fs-free test
    // — what matters here is that the mediated access check ran and the
    // route reached the controller at all, not the actual file bytes.
    expect(fileService.getFileForDownload).toHaveBeenCalledWith('f1', expect.any(Object));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(400);
  });
});
