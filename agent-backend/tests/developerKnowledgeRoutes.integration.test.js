import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 9, PR-32): proves
 * developerKnowledge.routes.js actually wires developerMachineAuthMiddleware
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
jest.unstable_mockModule('../src/modules/knowledge/knowledge.service.js', () => ({
  default: {
    createKnowledgeBase: jest.fn(),
    getKnowledgeBase: jest.fn(),
    updateKnowledgeBase: jest.fn(),
    deleteKnowledgeBase: jest.fn(),
    discoverKnowledgeBases: jest.fn(),
    uploadFiles: jest.fn(),
    searchKnowledgeBase: jest.fn(),
    deleteDocumentFromKb: jest.fn(),
    listDocumentSources: jest.fn(),
    getKnowledgeBaseUsage: jest.fn(),
  },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const knowledgeService = (await import('../src/modules/knowledge/knowledge.service.js')).default;
const { default: developerKnowledgeRouter } =
  await import('../src/modules/developer/developerKnowledge.routes.js');

describe('developerKnowledge.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/knowledge', developerKnowledgeRouter);
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
    const res = await request(app).post('/api/v1/developer/knowledge').send({ name: 'test-kb' });

    expect(res.status).toBe(401);
    expect(knowledgeService.createKnowledgeBase).not.toHaveBeenCalled();
  });

  test('400s on an invalid body (name missing)', async () => {
    const res = await request(app)
      .post('/api/v1/developer/knowledge')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ providerId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(400);
    expect(knowledgeService.createKnowledgeBase).not.toHaveBeenCalled();
  });

  test('creates a Knowledge Base for a valid credential + valid body', async () => {
    knowledgeService.createKnowledgeBase.mockResolvedValue({ _id: 'kb1', name: 'test-kb' });

    const res = await request(app)
      .post('/api/v1/developer/knowledge')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'test-kb', providerId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(201);
    expect(knowledgeService.createKnowledgeBase).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: 'test-kb' }),
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('GET / (discover) reaches the controller and returns the list', async () => {
    knowledgeService.discoverKnowledgeBases.mockResolvedValue([{ _id: 'kb1' }]);

    const res = await request(app)
      .get('/api/v1/developer/knowledge')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(knowledgeService.discoverKnowledgeBases).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' }),
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('GET /:kbId reaches the controller and returns the KB', async () => {
    knowledgeService.getKnowledgeBase.mockResolvedValue({ _id: 'kb1' });

    const res = await request(app)
      .get('/api/v1/developer/knowledge/kb1')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(knowledgeService.getKnowledgeBase).toHaveBeenCalledWith(
      'kb1',
      undefined,
      expect.any(Object)
    );
  });

  test('GET /:kbId/usage reaches the controller and returns usage', async () => {
    knowledgeService.getKnowledgeBaseUsage.mockResolvedValue({
      agentCount: 1,
      agents: [{ _id: 'a1', name: 'Agent One' }],
    });

    const res = await request(app)
      .get('/api/v1/developer/knowledge/kb1/usage')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] },
    });
    expect(knowledgeService.getKnowledgeBaseUsage).toHaveBeenCalledWith(
      'kb1',
      undefined,
      expect.any(Object)
    );
  });

  test('POST /bulk-delete reaches the controller and returns { deleted, failed }', async () => {
    knowledgeService.deleteKnowledgeBase.mockImplementation(async (id) => {
      if (id === 'kb2') throw new Error('Knowledge base not found');
      return true;
    });

    const res = await request(app)
      .post('/api/v1/developer/knowledge/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ ids: ['kb1', 'kb2'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { deleted: ['kb1'], failed: [{ id: 'kb2', reason: expect.any(String) }] },
    });
  });

  test('POST /bulk-delete 400s on an empty ids array, never reaching the controller', async () => {
    const res = await request(app)
      .post('/api/v1/developer/knowledge/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ ids: [] });

    expect(res.status).toBe(400);
    expect(knowledgeService.deleteKnowledgeBase).not.toHaveBeenCalled();
  });

  test('POST /:kbId/documents uploads a real multipart file to the controller (PR-47b)', async () => {
    knowledgeService.uploadFiles.mockResolvedValue({ files: [{ name: 'verify.txt' }] });

    const res = await request(app)
      .post('/api/v1/developer/knowledge/kb1/documents')
      .set('Authorization', 'Bearer pk_test.secret')
      .attach('files', Buffer.from('hello world'), 'verify.txt');

    expect(res.status).toBe(200);
    expect(knowledgeService.uploadFiles).toHaveBeenCalledWith(
      'kb1',
      undefined,
      expect.arrayContaining([expect.objectContaining({ originalname: 'verify.txt' })]),
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('POST /:kbId/documents 400s with no files attached', async () => {
    const res = await request(app)
      .post('/api/v1/developer/knowledge/kb1/documents')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(400);
    expect(knowledgeService.uploadFiles).not.toHaveBeenCalled();
  });

  test('GET /:kbId/documents reaches the controller and returns the list', async () => {
    knowledgeService.listDocumentSources.mockResolvedValue(['verify.txt']);

    const res = await request(app)
      .get('/api/v1/developer/knowledge/kb1/documents')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(knowledgeService.listDocumentSources).toHaveBeenCalledWith(
      'kb1',
      undefined,
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('DELETE /:kbId/documents/:sourceName reaches the controller', async () => {
    knowledgeService.deleteDocumentFromKb.mockResolvedValue({ removedChunks: 1 });

    const res = await request(app)
      .delete('/api/v1/developer/knowledge/kb1/documents/verify.txt')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(knowledgeService.deleteDocumentFromKb).toHaveBeenCalledWith(
      'kb1',
      undefined,
      'verify.txt',
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('POST /:kbId/search reaches the controller and returns results', async () => {
    knowledgeService.searchKnowledgeBase.mockResolvedValue([{ text: 'apples' }]);

    const res = await request(app)
      .post('/api/v1/developer/knowledge/kb1/search')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ query: 'apples' });

    expect(res.status).toBe(200);
    expect(knowledgeService.searchKnowledgeBase).toHaveBeenCalledWith(
      'kb1',
      'apples',
      { topK: undefined },
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('document routes 401 without a Project credential, never reaching the controller', async () => {
    const res = await request(app).get('/api/v1/developer/knowledge/kb1/documents');

    expect(res.status).toBe(401);
    expect(knowledgeService.listDocumentSources).not.toHaveBeenCalled();
  });
});
