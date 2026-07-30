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
});
