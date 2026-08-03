import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (blueprint Phase 9, PR-35): proves
 * developerMcp.routes.js actually wires developerMachineAuthMiddleware +
 * Zod validation + the controller together.
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
jest.unstable_mockModule('../src/modules/mcp/mcp.service.js', () => ({
  default: {
    createMcp: jest.fn(),
    getMcpById: jest.fn(),
    updateMcp: jest.fn(),
    deleteMcp: jest.fn(),
    discoverMcps: jest.fn(),
    countDiscoverMcps: jest.fn(),
    toSafeJson: jest.fn((mcp) => mcp),
    getMcpUsage: jest.fn(),
  },
}));
jest.unstable_mockModule('../src/modules/idempotency/idempotencyKey.model.js', () => ({
  default: { findOne: jest.fn(), create: jest.fn() },
}));

const projectCredentialService = (
  await import('../src/modules/projects/projectCredential.service.js')
).default;
const projectService = (await import('../src/modules/projects/project.service.js')).default;
const mcpService = (await import('../src/modules/mcp/mcp.service.js')).default;
const idempotencyKeyModel = (await import('../src/modules/idempotency/idempotencyKey.model.js'))
  .default;
const { default: developerMcpRouter } =
  await import('../src/modules/developer/developerMcp.routes.js');

describe('developerMcp.routes.js — mount integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/developer/mcps', developerMcpRouter);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mcpService.toSafeJson.mockImplementation((mcp) => mcp);
    projectCredentialService.verifyCredential.mockResolvedValue({
      credentialId: 'cred-1',
      project: 'project-1',
    });
    projectService.getProjectById.mockResolvedValue({ _id: 'project-1', status: 'ACTIVE' });
    idempotencyKeyModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    idempotencyKeyModel.create.mockResolvedValue({});
  });

  test('401s without a Project credential, never reaching the controller', async () => {
    const res = await request(app)
      .post('/api/v1/developer/mcps')
      .send({ name: 'Test MCP', transport: 'http', url: 'https://example.com/mcp' });

    expect(res.status).toBe(401);
    expect(mcpService.createMcp).not.toHaveBeenCalled();
  });

  test('400s on an invalid body (url is not a valid URL)', async () => {
    const res = await request(app)
      .post('/api/v1/developer/mcps')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'Test MCP', transport: 'http', url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(mcpService.createMcp).not.toHaveBeenCalled();
  });

  test('creates an Mcp for a valid credential + valid body', async () => {
    mcpService.createMcp.mockResolvedValue({ _id: 'm1', name: 'Test MCP' });

    const res = await request(app)
      .post('/api/v1/developer/mcps')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ name: 'Test MCP', transport: 'http', url: 'https://example.com/mcp' });

    expect(res.status).toBe(201);
    expect(mcpService.createMcp).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: 'Test MCP' }),
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' })
    );
  });

  test('POST / with a repeated Idempotency-Key replays the cached response, never calling the service twice', async () => {
    mcpService.createMcp.mockResolvedValue({ _id: 'm1', name: 'Test MCP' });
    const body = { name: 'Test MCP', transport: 'http', url: 'https://example.com/mcp' };

    const first = await request(app)
      .post('/api/v1/developer/mcps')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('Idempotency-Key', 'test-key-1')
      .send(body);
    expect(first.status).toBe(201);
    expect(mcpService.createMcp).toHaveBeenCalledTimes(1);

    idempotencyKeyModel.findOne.mockReturnValue({
      lean: () => Promise.resolve({ statusCode: first.status, body: first.body }),
    });

    const second = await request(app)
      .post('/api/v1/developer/mcps')
      .set('Authorization', 'Bearer pk_test.secret')
      .set('Idempotency-Key', 'test-key-1')
      .send(body);

    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    expect(mcpService.createMcp).toHaveBeenCalledTimes(1);
  });

  test('GET / (discover) reaches the controller and returns a pagination envelope', async () => {
    mcpService.discoverMcps.mockResolvedValue([{ _id: 'm1' }]);
    mcpService.countDiscoverMcps.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/developer/mcps')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(mcpService.discoverMcps).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'project-1', principalType: 'ProjectMachine' }),
      expect.any(Object),
      expect.any(Object)
    );
    expect(res.body).toEqual({
      success: true,
      data: {
        items: [{ _id: 'm1' }],
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      },
    });
  });

  test('GET /:mcpId reaches the controller and returns the Mcp', async () => {
    mcpService.getMcpById.mockResolvedValue({ _id: 'm1' });

    const res = await request(app)
      .get('/api/v1/developer/mcps/m1')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(mcpService.getMcpById).toHaveBeenCalledWith('m1', undefined, expect.any(Object));
  });

  test('GET /:mcpId/usage reaches the controller and returns usage', async () => {
    mcpService.getMcpUsage.mockResolvedValue({
      agentCount: 1,
      agents: [{ _id: 'a1', name: 'Agent One' }],
    });

    const res = await request(app)
      .get('/api/v1/developer/mcps/m1/usage')
      .set('Authorization', 'Bearer pk_test.secret');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { agentCount: 1, agents: [{ _id: 'a1', name: 'Agent One' }] },
    });
    expect(mcpService.getMcpUsage).toHaveBeenCalledWith('m1', undefined, expect.any(Object));
  });

  test('POST /bulk-delete reaches the controller and returns { deleted, failed }', async () => {
    mcpService.deleteMcp.mockImplementation(async (id) => {
      if (id === 'm2') throw new Error('MCP server not found');
      return true;
    });

    const res = await request(app)
      .post('/api/v1/developer/mcps/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ ids: ['m1', 'm2'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { deleted: ['m1'], failed: [{ id: 'm2', reason: expect.any(String) }] },
    });
  });

  test('POST /bulk-delete 400s on an empty ids array, never reaching the controller', async () => {
    const res = await request(app)
      .post('/api/v1/developer/mcps/bulk-delete')
      .set('Authorization', 'Bearer pk_test.secret')
      .send({ ids: [] });

    expect(res.status).toBe(400);
    expect(mcpService.deleteMcp).not.toHaveBeenCalled();
  });
});
