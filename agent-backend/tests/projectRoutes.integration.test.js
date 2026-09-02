import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 8, PR-19): proves the
 * nested `/:projectId` sub-router's `mergeParams: true` actually propagates
 * `projectId` through `projectAdminAuthMiddleware` into the controller —
 * something the controller/middleware unit tests alone can't catch, since
 * they construct `req.params`/`req.projectAdminContext` by hand.
 */

jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { _id: 'user_123' };
    next();
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectMembership.repository.js', () => ({
  default: {
    findByProjectAndUser: jest.fn(),
    findByUser: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: {
    createProject: jest.fn(),
    listProjectsForUser: jest.fn(),
    getProjectById: jest.fn(),
    updateMetadata: jest.fn(),
    suspendProject: jest.fn(),
    reactivateProject: jest.fn(),
    requestDeletion: jest.fn(),
    cancelDeletion: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/projects/projectInvitation.service.js', () => ({
  default: {
    createInvitation: jest.fn(),
    listInvitations: jest.fn(),
    revokeInvitation: jest.fn(),
  },
}));

// Developer Platform (blueprint Phase 11, PR-55): project.routes.js now
// wires in the resource-browsing controller methods, which import these
// services for real — mcp.service.js in particular transitively pulls in
// agent.factory.js's heavy LangChain/DeepAgents chain (the same problem
// PR-31 hit and solved by mocking at this boundary instead).
jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: { discoverAgents: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/skills/skill.service.js', () => ({
  default: { discoverSkills: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/knowledge/knowledge.service.js', () => ({
  default: { discoverKnowledgeBases: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/mcp/mcp.service.js', () => ({
  default: { discoverMcps: jest.fn(), toSafeJson: jest.fn((mcp) => mcp) },
}));
// REST API Tool Builder (PERSONA_REST_TOOL_REQUEST.md) — same boundary-
// mocking reason as mcp.service.js above (restApiTool.service.js
// transitively pulls in agent.factory.js's heavy LangChain/DeepAgents chain).
jest.unstable_mockModule('../src/modules/restApiTools/restApiTool.service.js', () => ({
  default: {
    discoverRestApiTools: jest.fn(),
    createRestApiTool: jest.fn(),
    updateRestApiTool: jest.fn(),
    deleteRestApiTool: jest.fn(),
    getRestApiToolById: jest.fn(),
    getRestApiToolUsage: jest.fn(),
    testCall: jest.fn(),
    toSafeJson: jest.fn((tool) => tool),
  },
}));
jest.unstable_mockModule('../src/modules/projects/projectSecret.service.js', () => ({
  default: {
    listSecrets: jest.fn(),
    createSecret: jest.fn(),
    updateSecret: jest.fn(),
    deleteSecret: jest.fn(),
    getSecretUsage: jest.fn(),
    toSafeJson: jest.fn((secret) => secret),
  },
}));
jest.unstable_mockModule('../src/modules/providers/provider.service.js', () => ({
  default: { listProvidersForProject: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/stores/store.service.js', () => ({
  default: {
    listStores: jest.fn(),
    createStore: jest.fn(),
    updateStore: jest.fn(),
    deleteStore: jest.fn(),
  },
}));

// project.controller.js imports user.repository.js for real — members
// routes only touch it when exercised, so the suite needs it mocked to
// avoid a real DB hit for the /members/search tests below.
jest.unstable_mockModule('../src/modules/users/user.repository.js', () => ({
  default: {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    searchByEmailPrefix: jest.fn(),
  },
}));

const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const projectInvitationService = (
  await import('../src/modules/projects/projectInvitation.service.js')
).default;
const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const { default: projectRouter } = await import('../src/modules/projects/project.routes.js');

describe('project.routes.js — nested :projectId param propagation', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/projects', projectRouter);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /:projectId reaches the controller with the correct project id, via mergeParams', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project_abc', name: 'Beyond Campus' });

    const res = await request(app).get('/api/v1/projects/project_abc');

    expect(res.status).toBe(200);
    expect(projectMembershipRepository.findByProjectAndUser).toHaveBeenCalledWith(
      'project_abc',
      'user_123'
    );
    expect(projectService.getProjectById).toHaveBeenCalledWith('project_abc');
    expect(res.body.data).toEqual({ _id: 'project_abc', name: 'Beyond Campus' });
  });

  test('GET /:projectId returns 404 when the caller has no membership for that Project', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/projects/not-my-project');

    expect(res.status).toBe(404);
    expect(projectService.getProjectById).not.toHaveBeenCalled();
  });

  test('POST /:projectId/suspend reaches the controller with the correct project id + caller (blueprint Phase 10, PR-49)', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    projectService.suspendProject.mockResolvedValue({ _id: 'project_abc', status: 'SUSPENDED' });

    const res = await request(app).post('/api/v1/projects/project_abc/suspend');

    expect(res.status).toBe(200);
    expect(projectService.suspendProject).toHaveBeenCalledWith('user_123', 'project_abc');
  });

  test('POST /:projectId/reactivate reaches the controller with the correct project id (blueprint Phase 10, PR-49)', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    projectService.reactivateProject.mockResolvedValue({ _id: 'project_abc', status: 'ACTIVE' });

    const res = await request(app).post('/api/v1/projects/project_abc/reactivate');

    expect(res.status).toBe(200);
    expect(projectService.reactivateProject).toHaveBeenCalledWith('project_abc', 'user_123');
  });

  test('suspend/reactivate 404 when the caller has no membership for that Project', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    const suspendRes = await request(app).post('/api/v1/projects/not-my-project/suspend');
    const reactivateRes = await request(app).post('/api/v1/projects/not-my-project/reactivate');

    expect(suspendRes.status).toBe(404);
    expect(reactivateRes.status).toBe(404);
    expect(projectService.suspendProject).not.toHaveBeenCalled();
    expect(projectService.reactivateProject).not.toHaveBeenCalled();
  });

  test('POST /:projectId/delete reaches the controller with the correct project id (blueprint Phase 10, PR-52)', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    projectService.requestDeletion.mockResolvedValue({ _id: 'project_abc', status: 'DELETING' });

    const res = await request(app).post('/api/v1/projects/project_abc/delete');

    expect(res.status).toBe(200);
    expect(projectService.requestDeletion).toHaveBeenCalledWith('project_abc', 'user_123');
  });

  test('POST /:projectId/cancel-deletion reaches the controller with the correct project id (blueprint Phase 10, PR-52)', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    projectService.cancelDeletion.mockResolvedValue({ _id: 'project_abc', status: 'ACTIVE' });

    const res = await request(app).post('/api/v1/projects/project_abc/cancel-deletion');

    expect(res.status).toBe(200);
    expect(projectService.cancelDeletion).toHaveBeenCalledWith('project_abc', 'user_123');
  });

  test('delete/cancel-deletion 404 when the caller has no membership for that Project', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    const deleteRes = await request(app).post('/api/v1/projects/not-my-project/delete');
    const cancelRes = await request(app).post('/api/v1/projects/not-my-project/cancel-deletion');

    expect(deleteRes.status).toBe(404);
    expect(cancelRes.status).toBe(404);
    expect(projectService.requestDeletion).not.toHaveBeenCalled();
    expect(projectService.cancelDeletion).not.toHaveBeenCalled();
  });

  test('GET / (list mine) does not require projectAdminAuthMiddleware at all', async () => {
    projectService.listProjectsForUser.mockResolvedValue([{ _id: 'p1' }]);

    const res = await request(app).get('/api/v1/projects');

    expect(res.status).toBe(200);
    expect(projectMembershipRepository.findByProjectAndUser).not.toHaveBeenCalled();
    expect(res.body.data).toEqual([{ _id: 'p1' }]);
  });

  test('GET /:projectId/agents reaches the controller with the correct project id (blueprint Phase 11, PR-55)', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    agentService.discoverAgents.mockResolvedValue([{ _id: 'agent1' }]);

    const res = await request(app).get('/api/v1/projects/project_abc/agents');

    expect(res.status).toBe(200);
    expect(agentService.discoverAgents).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'project_abc', principalType: 'ProjectAdmin' }),
      expect.any(Object),
      expect.any(Object)
    );
    expect(res.body.data).toEqual([{ _id: 'agent1' }]);
  });

  test('GET /:projectId/agents 404s when the caller has no membership for that Project', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/projects/not-my-project/agents');

    expect(res.status).toBe(404);
    expect(agentService.discoverAgents).not.toHaveBeenCalled();
  });

  test('GET /:projectId/members/search reaches the controller and returns matching users', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    const userRepository = (await import('../src/modules/users/user.repository.js')).default;
    userRepository.searchByEmailPrefix.mockResolvedValue([
      { id: 'u1', name: 'Sabik', email: 'sabik@beyond.campus' },
    ]);

    const res = await request(app).get('/api/v1/projects/project_abc/members/search?q=sabik@');

    expect(res.status).toBe(200);
    expect(userRepository.searchByEmailPrefix).toHaveBeenCalledWith('sabik@');
    expect(res.body.data).toEqual([{ id: 'u1', name: 'Sabik', email: 'sabik@beyond.campus' }]);
  });

  test('GET /:projectId/members/search 404s when the caller has no membership', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/projects/not-my-project/members/search?q=a@');

    expect(res.status).toBe(404);
  });

  test('POST /:projectId/members rejects a body with both personaUserId and email (exactly-one rule)', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });

    const res = await request(app)
      .post('/api/v1/projects/project_abc/members')
      .send({ personaUserId: 'user_x', email: 'x@example.com' });

    expect(res.status).toBe(400);
  });

  test('POST /:projectId/members rejects a body with neither personaUserId nor email', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });

    const res = await request(app).post('/api/v1/projects/project_abc/members').send({});

    expect(res.status).toBe(400);
  });

  test('POST /:projectId/members/invitations reaches the controller and responds 201', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    projectInvitationService.createInvitation.mockResolvedValue({
      email: 'new@beyond.campus',
      status: 'pending',
    });

    const res = await request(app)
      .post('/api/v1/projects/project_abc/members/invitations')
      .send({ email: 'new@beyond.campus' });

    expect(res.status).toBe(201);
    expect(projectInvitationService.createInvitation).toHaveBeenCalledWith(
      'project_abc',
      'new@beyond.campus',
      'user_123'
    );
  });

  test('invitation routes 404 when the caller has no membership', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue(null);

    const createRes = await request(app)
      .post('/api/v1/projects/not-my-project/members/invitations')
      .send({ email: 'new@beyond.campus' });
    const listRes = await request(app).get('/api/v1/projects/not-my-project/members/invitations');
    const revokeRes = await request(app).delete(
      '/api/v1/projects/not-my-project/members/invitations/inv_1'
    );

    expect(createRes.status).toBe(404);
    expect(listRes.status).toBe(404);
    expect(revokeRes.status).toBe(404);
    expect(projectInvitationService.createInvitation).not.toHaveBeenCalled();
  });

  test('GET/DELETE /:projectId/members/invitations reach the controller', async () => {
    projectMembershipRepository.findByProjectAndUser.mockResolvedValue({
      project: 'project_abc',
      personaUserId: 'user_123',
      role: 'Admin',
    });
    projectInvitationService.listInvitations.mockResolvedValue([{ email: 'a@b.c' }]);
    projectInvitationService.revokeInvitation.mockResolvedValue({ status: 'revoked' });

    const listRes = await request(app).get('/api/v1/projects/project_abc/members/invitations');
    const revokeRes = await request(app).delete(
      '/api/v1/projects/project_abc/members/invitations/inv_1'
    );

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([{ email: 'a@b.c' }]);
    expect(revokeRes.status).toBe(200);
    expect(projectInvitationService.revokeInvitation).toHaveBeenCalledWith(
      'project_abc',
      'inv_1',
      'user_123'
    );
  });
});
