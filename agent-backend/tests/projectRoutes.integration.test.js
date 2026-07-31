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

const projectMembershipRepository = (
  await import('../src/modules/projects/projectMembership.repository.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
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
});
