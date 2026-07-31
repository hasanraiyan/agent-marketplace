import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 10, PR-50): proves
 * admin.routes.js's new Project suspend/restore routes actually wire
 * authMiddleware + adminMiddleware + the controller together, and reject
 * a non-admin caller before reaching project.service.js.
 */

jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { id: 'user_123', role: req.headers['x-test-role'] || 'admin' };
    next();
  },
}));

jest.unstable_mockModule('../src/modules/projects/project.service.js', () => ({
  default: {
    platformSuspendProject: jest.fn(),
    platformRestoreProject: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/users/user.repository.js', () => ({
  default: { findById: jest.fn(), delete: jest.fn(), findAll: jest.fn() },
}));
jest.unstable_mockModule('../src/modules/users/user.service.js', () => ({
  default: { deleteUser: jest.fn() },
}));

const projectService = (await import('../src/modules/projects/project.service.js')).default;
const { default: adminRouter } = await import('../src/modules/users/admin.routes.js');

describe('admin.routes.js — Project suspend/restore (blueprint Phase 10, PR-50)', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRouter);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /projects/:projectId/suspend reaches the controller for an admin', async () => {
    projectService.platformSuspendProject.mockResolvedValue({
      _id: 'project_1',
      status: 'SUSPENDED',
    });

    const res = await request(app).post('/api/v1/admin/projects/project_1/suspend');

    expect(res.status).toBe(200);
    expect(projectService.platformSuspendProject).toHaveBeenCalledWith('project_1');
  });

  test('POST /projects/:projectId/restore reaches the controller for an admin', async () => {
    projectService.platformRestoreProject.mockResolvedValue({ _id: 'project_1', status: 'ACTIVE' });

    const res = await request(app).post('/api/v1/admin/projects/project_1/restore');

    expect(res.status).toBe(200);
    expect(projectService.platformRestoreProject).toHaveBeenCalledWith('project_1');
  });

  test('403s for a non-admin caller, never reaching the service', async () => {
    const res = await request(app)
      .post('/api/v1/admin/projects/project_1/suspend')
      .set('x-test-role', 'normal');

    expect(res.status).toBe(403);
    expect(projectService.platformSuspendProject).not.toHaveBeenCalled();
  });
});
