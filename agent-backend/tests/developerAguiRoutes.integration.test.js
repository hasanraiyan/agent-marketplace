import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 8, PR-23b): proves
 * developerAgui.routes.js actually wires developerMachineAuthMiddleware
 * into the same request the controller runs in — the unit tests for each
 * piece don't prove the mount itself is correct.
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
jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: { buildAgent: jest.fn() },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const { default: developerAguiRouter } =
  await import('../src/modules/developer/developerAgui.routes.js');

describe('developerAgui.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/agui', developerAguiRouter);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('401s without a Project credential, never reaching the controller', async () => {
    const res = await request(app).post('/api/v1/developer/agui').send({ messages: [] });

    expect(res.status).toBe(401);
    expect(agentRepository.findById).not.toHaveBeenCalled();
  });

  test('400s for a valid credential with no asserted external user (ProjectMachineContext)', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred-1',
      project: 'project-1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project-1', status: 'ACTIVE' });

    const res = await request(app)
      .post('/api/v1/developer/agui')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-agent-id', 'agent-1')
      .send({ messages: [] });

    expect(res.status).toBe(400);
    expect(agentRepository.findById).not.toHaveBeenCalled();
  });

  test('404s for a nonexistent agentId with a valid ProjectRuntimeContext', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred-1',
      project: 'project-1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project-1', status: 'ACTIVE' });
    agentRepository.findById.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/developer/agui')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('x-agent-id', 'agent-1')
      .set('x-persona-external-user-id', 'sabik')
      .send({ messages: [] });

    expect(res.status).toBe(404);
    expect(agentFactory.buildAgent).not.toHaveBeenCalled();
  });

  test('GET / returns protocol info without requiring any headers beyond the credential', async () => {
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred-1',
      project: 'project-1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project-1', status: 'ACTIVE' });

    const res = await request(app)
      .get('/api/v1/developer/agui')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ protocol: 'ag-ui', transport: 'sse', status: 'ok' });
  });
});
