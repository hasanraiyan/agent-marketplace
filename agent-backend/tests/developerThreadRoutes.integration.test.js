import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 9, PR-40): proves
 * developerThread.routes.js actually wires developerMachineAuthMiddleware +
 * the ProjectRuntime-only guard + Zod validation + the controller together.
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
jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: { findById: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: { canUserExecuteAgent: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: {
    getMessages: jest.fn(),
    cleanupThreads: jest.fn(),
    listWorkspaceFiles: jest.fn(),
    getWorkspaceFile: jest.fn(),
    writeWorkspaceFile: jest.fn(),
    deleteWorkspaceFile: jest.fn(),
  },
}));
jest.unstable_mockModule('../src/modules/threads/thread.service.js', () => ({
  default: {
    createThread: jest.fn(),
    getThreadById: jest.fn(),
    getThreadsForSubject: jest.fn(),
    countThreadsForSubject: jest.fn(),
    updateThreadTitle: jest.fn(),
    updateThread: jest.fn(),
    deleteThread: jest.fn(),
  },
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
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const checkpointService = (await import('../src/modules/threads/checkpoint.service.js')).default;
const threadService = (await import('../src/modules/threads/thread.service.js')).default;
const idempotencyKeyModel = (await import('../src/modules/idempotency/idempotencyKey.model.js'))
  .default;
const { default: developerThreadRouter } =
  await import('../src/modules/developer/developerThread.routes.js');

describe('developerThread.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/threads', developerThreadRouter);
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
    checkpointService.cleanupThreads.mockResolvedValue();
    idempotencyKeyModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    idempotencyKeyModel.create.mockResolvedValue({});
  });

  test('401s without a Project credential, never reaching the controller', async () => {
    const res = await request(app).get('/api/v1/developer/threads');

    expect(res.status).toBe(401);
    expect(threadService.getThreadsForSubject).not.toHaveBeenCalled();
  });

  test('400s (EXTERNAL_USER_REQUIRED) for a bare ProjectMachineContext, no asserted external user', async () => {
    const res = await request(app)
      .get('/api/v1/developer/threads')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/external user/i);
    expect(threadService.getThreadsForSubject).not.toHaveBeenCalled();
  });

  test('lists Threads for a valid ProjectRuntimeContext, wrapped in a pagination envelope', async () => {
    threadService.getThreadsForSubject.mockResolvedValue([{ _id: 't1' }]);
    threadService.countThreadsForSubject.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/developer/threads')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(threadService.getThreadsForSubject).toHaveBeenCalledWith(
      undefined,
      expect.any(Object),
      expect.objectContaining({
        domain: 'project-1',
        principalType: 'ProjectRuntime',
        externalUserId: 'sabik',
      })
    );
    expect(res.body).toEqual({
      success: true,
      data: {
        items: [{ _id: 't1' }],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      },
    });
  });

  test('400s on an invalid body (missing agentId)', async () => {
    const res = await request(app)
      .post('/api/v1/developer/threads')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({});

    expect(res.status).toBe(400);
    expect(threadService.createThread).not.toHaveBeenCalled();
  });

  test('creates a Thread for a valid credential + external user + executable Agent', async () => {
    agentRepository.findById.mockResolvedValue({ _id: 'agent_1' });
    agentService.canUserExecuteAgent.mockReturnValue(true);
    threadService.createThread.mockResolvedValue({ _id: 't1' });

    const res = await request(app)
      .post('/api/v1/developer/threads')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ agentId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(201);
    expect(threadService.createThread).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ agentId: '507f1f77bcf86cd799439011' }),
      expect.objectContaining({ principalType: 'ProjectRuntime' })
    );
  });

  test('POST / with a repeated Idempotency-Key replays the cached response, never calling the service twice', async () => {
    agentRepository.findById.mockResolvedValue({ _id: 'agent_1' });
    agentService.canUserExecuteAgent.mockReturnValue(true);
    threadService.createThread.mockResolvedValue({ _id: 't1' });
    const body = { agentId: '507f1f77bcf86cd799439011' };

    const first = await request(app)
      .post('/api/v1/developer/threads')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .set('Idempotency-Key', 'test-key-1')
      .send(body);
    expect(first.status).toBe(201);
    expect(threadService.createThread).toHaveBeenCalledTimes(1);

    idempotencyKeyModel.findOne.mockReturnValue({
      lean: () => Promise.resolve({ statusCode: first.status, body: first.body }),
    });

    const second = await request(app)
      .post('/api/v1/developer/threads')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .set('Idempotency-Key', 'test-key-1')
      .send(body);

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(threadService.createThread).toHaveBeenCalledTimes(1);
  });

  test('GET /:threadId reaches the controller and returns the Thread', async () => {
    threadService.getThreadById.mockResolvedValue({ _id: 't1' });

    const res = await request(app)
      .get('/api/v1/developer/threads/t1')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(threadService.getThreadById).toHaveBeenCalledWith('t1', undefined, expect.any(Object));
  });

  test('PATCH /:threadId archives a Thread via isArchived alone', async () => {
    threadService.updateThread.mockResolvedValue({ _id: 't1', isArchived: true });

    const res = await request(app)
      .patch('/api/v1/developer/threads/t1')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ isArchived: true });

    expect(res.status).toBe(200);
    expect(threadService.updateThread).toHaveBeenCalledWith(
      't1',
      undefined,
      { isArchived: true },
      expect.any(Object)
    );
  });

  test('PATCH /:threadId 400s on an invalid body (isArchived not a boolean)', async () => {
    const res = await request(app)
      .patch('/api/v1/developer/threads/t1')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ isArchived: 'yes' });

    expect(res.status).toBe(400);
    expect(threadService.updateThread).not.toHaveBeenCalled();
  });

  test('POST /bulk-delete reaches the controller and returns { deleted, failed }', async () => {
    threadService.deleteThread.mockImplementation(async (id) => {
      if (id === 't2') throw new Error('Thread not found');
      return { threadId: 'uuid-1' };
    });

    const res = await request(app)
      .post('/api/v1/developer/threads/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ ids: ['t1', 't2'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { deleted: ['t1'], failed: [{ id: 't2', reason: expect.any(String) }] },
    });
  });

  test('POST /bulk-delete 400s on an empty ids array, never reaching the controller', async () => {
    const res = await request(app)
      .post('/api/v1/developer/threads/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ ids: [] });

    expect(res.status).toBe(400);
    expect(threadService.deleteThread).not.toHaveBeenCalled();
  });

  test('GET /:threadId/files reaches the controller and returns the files map', async () => {
    checkpointService.listWorkspaceFiles.mockResolvedValue({ '/notes.md': { content: 'hi' } });

    const res = await request(app)
      .get('/api/v1/developer/threads/t1/files')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { '/notes.md': { content: 'hi' } } });
    expect(checkpointService.listWorkspaceFiles).toHaveBeenCalledWith(
      't1',
      undefined,
      expect.any(Object)
    );
  });

  test('GET /:threadId/file 400s without a path query param, never reaching the service', async () => {
    const res = await request(app)
      .get('/api/v1/developer/threads/t1/file')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(400);
    expect(checkpointService.getWorkspaceFile).not.toHaveBeenCalled();
  });

  test('GET /:threadId/file returns the file for a valid path', async () => {
    checkpointService.getWorkspaceFile.mockResolvedValue({ content: 'hi' });

    const res = await request(app)
      .get('/api/v1/developer/threads/t1/file')
      .query({ path: '/notes.md' })
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(checkpointService.getWorkspaceFile).toHaveBeenCalledWith(
      't1',
      '/notes.md',
      undefined,
      expect.any(Object)
    );
  });

  test('PUT /:threadId/file 400s without both path and content', async () => {
    const res = await request(app)
      .put('/api/v1/developer/threads/t1/file')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ path: '/notes.md' });

    expect(res.status).toBe(400);
    expect(checkpointService.writeWorkspaceFile).not.toHaveBeenCalled();
  });

  test('PUT /:threadId/file writes the file via the service', async () => {
    checkpointService.writeWorkspaceFile.mockResolvedValue({ content: 'hello' });

    const res = await request(app)
      .put('/api/v1/developer/threads/t1/file')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ path: '/notes.md', content: 'hello' });

    expect(res.status).toBe(200);
    expect(checkpointService.writeWorkspaceFile).toHaveBeenCalledWith(
      't1',
      '/notes.md',
      'hello',
      undefined,
      expect.any(Object)
    );
  });

  test('DELETE /:threadId/file 400s without a path query param', async () => {
    const res = await request(app)
      .delete('/api/v1/developer/threads/t1/file')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(400);
    expect(checkpointService.deleteWorkspaceFile).not.toHaveBeenCalled();
  });

  test('DELETE /:threadId/file deletes the file via the service', async () => {
    checkpointService.deleteWorkspaceFile.mockResolvedValue();

    const res = await request(app)
      .delete('/api/v1/developer/threads/t1/file')
      .query({ path: '/notes.md' })
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik');

    expect(res.status).toBe(200);
    expect(checkpointService.deleteWorkspaceFile).toHaveBeenCalledWith(
      't1',
      '/notes.md',
      undefined,
      expect.any(Object)
    );
  });
});
