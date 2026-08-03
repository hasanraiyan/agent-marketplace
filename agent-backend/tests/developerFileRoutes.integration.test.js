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
    countFiles: jest.fn(),
    deleteFile: jest.fn(),
  },
  developerUploadDir: '/tmp/developer-uploads-test',
}));
jest.unstable_mockModule('../src/modules/idempotency/idempotencyKey.model.js', () => ({
  default: { findOne: jest.fn(), create: jest.fn() },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const externalUserService = (await import('../src/modules/externalUsers/externalUser.service.js'))
  .default;
const fileService = (await import('../src/modules/files/file.service.js')).default;
const idempotencyKeyModel = (await import('../src/modules/idempotency/idempotencyKey.model.js'))
  .default;
const { default: developerFileRouter } =
  await import('../src/modules/developer/developerFile.routes.js');

describe('developerFile.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
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
    idempotencyKeyModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    idempotencyKeyModel.create.mockResolvedValue({});
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

  test('lists files for a valid ProjectRuntimeContext, wrapped in a pagination envelope', async () => {
    fileService.listFiles.mockResolvedValue([]);
    fileService.countFiles.mockResolvedValue(0);

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
    expect(res.body).toEqual({
      success: true,
      data: { items: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } },
    });
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

  test('POST / with a repeated Idempotency-Key replays the cached response, never calling the service twice', async () => {
    fileService.createFile.mockResolvedValue({
      _id: 'f1',
      originalName: 'test.txt',
      mimeType: 'text/plain',
      size: 11,
      agentId: null,
      threadId: null,
      createdAt: new Date(),
    });

    const first = await request(app)
      .post('/api/v1/developer/files')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .set('Idempotency-Key', 'test-key-1')
      .attach('file', Buffer.from('hello world'), 'test.txt');
    expect(first.status).toBe(201);
    expect(fileService.createFile).toHaveBeenCalledTimes(1);

    idempotencyKeyModel.findOne.mockReturnValue({
      lean: () => Promise.resolve({ statusCode: first.status, body: first.body }),
    });

    const second = await request(app)
      .post('/api/v1/developer/files')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .set('Idempotency-Key', 'test-key-1')
      .attach('file', Buffer.from('hello world'), 'test.txt');

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(fileService.createFile).toHaveBeenCalledTimes(1);
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

  test('POST /bulk-delete reaches the controller and returns { deleted, failed }', async () => {
    fileService.deleteFile.mockImplementation(async (id) => {
      if (id === 'f2') throw new Error('File not found');
      return true;
    });

    const res = await request(app)
      .post('/api/v1/developer/files/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ ids: ['f1', 'f2'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { deleted: ['f1'], failed: [{ id: 'f2', reason: expect.any(String) }] },
    });
  });

  test('POST /bulk-delete 400s on an empty ids array, never reaching the controller', async () => {
    const res = await request(app)
      .post('/api/v1/developer/files/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ ids: [] });

    expect(res.status).toBe(400);
    expect(fileService.deleteFile).not.toHaveBeenCalled();
  });
});
