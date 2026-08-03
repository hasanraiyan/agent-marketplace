import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 9, PR-26): proves
 * developerAgent.routes.js actually wires developerMachineAuthMiddleware
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
jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: {
    createDeveloperAgent: jest.fn(),
    getDeveloperAgentById: jest.fn(),
    updateAgent: jest.fn(),
    deleteAgent: jest.fn(),
    discoverAgents: jest.fn(),
    countDiscoverAgents: jest.fn(),
  },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const { default: developerAgentRouter } =
  await import('../src/modules/developer/developerAgent.routes.js');

describe('developerAgent.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/agents', developerAgentRouter);
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
    const res = await request(app)
      .post('/api/v1/developer/agents')
      .send({ name: 'Bot', systemPrompt: 'You are helpful, assist users well.', providerId: 'p1' });

    expect(res.status).toBe(401);
    expect(agentService.createDeveloperAgent).not.toHaveBeenCalled();
  });

  test('400s on an invalid body (missing required systemPrompt/providerId)', async () => {
    const res = await request(app)
      .post('/api/v1/developer/agents')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'Bot' });

    expect(res.status).toBe(400);
    expect(agentService.createDeveloperAgent).not.toHaveBeenCalled();
  });

  test('creates an Agent for a valid credential + valid body', async () => {
    agentService.createDeveloperAgent.mockResolvedValue({ _id: 'a1', name: 'Bot' });

    const res = await request(app)
      .post('/api/v1/developer/agents')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'Bot', systemPrompt: 'You are helpful, assist users well.', providerId: 'p1' });

    expect(res.status).toBe(201);
    expect(agentService.createDeveloperAgent).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' }),
      expect.objectContaining({ name: 'Bot' })
    );
  });

  test('GET /:agentId reaches the controller and returns the Agent', async () => {
    agentService.getDeveloperAgentById.mockResolvedValue({ _id: 'a1', name: 'Bot' });

    const res = await request(app)
      .get('/api/v1/developer/agents/a1')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(agentService.getDeveloperAgentById).toHaveBeenCalledWith('a1', expect.any(Object));
  });

  test('GET / (discover) reaches the controller and returns a pagination envelope', async () => {
    agentService.discoverAgents.mockResolvedValue([{ _id: 'a1' }]);
    agentService.countDiscoverAgents.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/developer/agents')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(agentService.discoverAgents).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' }),
      expect.any(Object),
      expect.any(Object)
    );
    expect(res.body).toEqual({
      success: true,
      data: {
        items: [{ _id: 'a1' }],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      },
    });
  });

  test('a ProjectRuntimeContext (x-persona-external-user-id present) is passed through to the service', async () => {
    const { default: externalUserService } =
      await import('../src/modules/externalUsers/externalUser.service.js');
    externalUserService.resolveOrCreate.mockResolvedValue({});
    agentService.createDeveloperAgent.mockResolvedValue({ _id: 'a1' });

    await request(app)
      .post('/api/v1/developer/agents')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-persona-external-user-id', 'sabik')
      .send({ name: 'Bot', systemPrompt: 'You are helpful, assist users well.', providerId: 'p1' });

    expect(agentService.createDeveloperAgent).toHaveBeenCalledWith(
      expect.objectContaining({ principalType: 'ProjectRuntime', externalUserId: 'sabik' }),
      expect.anything()
    );
  });

  test('POST /bulk-delete reaches the controller and returns { deleted, failed }', async () => {
    agentService.deleteAgent.mockImplementation(async (id) => {
      if (id === 'a2') throw new Error('Agent not found');
      return true;
    });

    const res = await request(app)
      .post('/api/v1/developer/agents/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ ids: ['a1', 'a2'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { deleted: ['a1'], failed: [{ id: 'a2', reason: expect.any(String) }] },
    });
  });

  test('POST /bulk-delete 400s on an empty ids array, never reaching the controller', async () => {
    const res = await request(app)
      .post('/api/v1/developer/agents/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ ids: [] });

    expect(res.status).toBe(400);
    expect(agentService.deleteAgent).not.toHaveBeenCalled();
  });
});
