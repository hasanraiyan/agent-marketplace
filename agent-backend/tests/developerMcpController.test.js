import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/mcp/mcp.service.js', () => ({
  default: {
    createMcp: jest.fn(),
    getMcpById: jest.fn(),
    updateMcp: jest.fn(),
    deleteMcp: jest.fn(),
    discoverMcps: jest.fn(),
    toSafeJson: jest.fn((mcp) => mcp),
  },
}));

const mcpService = (await import('../src/modules/mcp/mcp.service.js')).default;
const developerMcpController = (await import('../src/modules/developer/developerMcp.controller.js'))
  .default;

describe('Developer Mcp Controller', () => {
  const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mcpService.toSafeJson.mockImplementation((mcp) => mcp);
    mockReq = { projectContext: machineContext, body: {}, params: {}, query: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('discover', () => {
    test('discovers via mcpService.discoverMcps, formatting each result via toSafeJson', async () => {
      mockReq.query = { search: 'support', scope: 'mine' };
      mcpService.discoverMcps.mockResolvedValue([{ _id: 'm1', apiKeyEncrypted: 'secret' }]);

      await developerMcpController.discover(mockReq, mockRes, next);

      expect(mcpService.discoverMcps).toHaveBeenCalledWith(
        machineContext,
        { search: 'support', scope: 'mine' },
        { page: 1, limit: 20 }
      );
      expect(mcpService.toSafeJson).toHaveBeenCalledWith({ _id: 'm1', apiKeyEncrypted: 'secret' });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      mcpService.discoverMcps.mockRejectedValue(err);

      await developerMcpController.discover(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('create', () => {
    test('creates via mcpService.createMcp using req.projectContext', async () => {
      mockReq.body = { name: 'Support MCP', transport: 'http', url: 'https://example.com/mcp' };
      mcpService.createMcp.mockResolvedValue({ _id: 'm1', name: 'Support MCP' });

      await developerMcpController.create(mockReq, mockRes, next);

      expect(mcpService.createMcp).toHaveBeenCalledWith(
        undefined,
        { name: 'Support MCP', transport: 'http', url: 'https://example.com/mcp' },
        machineContext
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('maps a duplicate-key error to 409', async () => {
      const dupError = new Error('duplicate');
      dupError.code = 11000;
      mcpService.createMcp.mockRejectedValue(dupError);

      await developerMcpController.create(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(next).not.toHaveBeenCalled();
    });

    test('passes non-duplicate errors to next', async () => {
      const err = new Error('API key is required when auth type is apiKey');
      mcpService.createMcp.mockRejectedValue(err);

      await developerMcpController.create(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('getOne', () => {
    test('returns the Mcp using the :mcpId param and req.projectContext', async () => {
      mockReq.params = { mcpId: 'm1' };
      mcpService.getMcpById.mockResolvedValue({ _id: 'm1' });

      await developerMcpController.getOne(mockReq, mockRes, next);

      expect(mcpService.getMcpById).toHaveBeenCalledWith('m1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { _id: 'm1' } });
    });

    test('passes a NotFoundError straight through to next (no special-casing needed)', async () => {
      mockReq.params = { mcpId: 'm1' };
      const err = new Error('MCP server not found');
      mcpService.getMcpById.mockRejectedValue(err);

      await developerMcpController.getOne(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('updates via mcpService.updateMcp, forwarding req.projectContext', async () => {
      mockReq.params = { mcpId: 'm1' };
      mockReq.body = { description: 'new description' };
      mcpService.updateMcp.mockResolvedValue({ _id: 'm1' });

      await developerMcpController.update(mockReq, mockRes, next);

      expect(mcpService.updateMcp).toHaveBeenCalledWith(
        'm1',
        undefined,
        { description: 'new description' },
        machineContext
      );
    });

    test('maps a duplicate-key error to 409', async () => {
      mockReq.params = { mcpId: 'm1' };
      const dupError = new Error('duplicate');
      dupError.code = 11000;
      mcpService.updateMcp.mockRejectedValue(dupError);

      await developerMcpController.update(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });
  });

  describe('remove', () => {
    test('deletes via mcpService.deleteMcp, forwarding req.projectContext', async () => {
      mockReq.params = { mcpId: 'm1' };
      mcpService.deleteMcp.mockResolvedValue(true);

      await developerMcpController.remove(mockReq, mockRes, next);

      expect(mcpService.deleteMcp).toHaveBeenCalledWith('m1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'MCP server deleted successfully',
      });
    });
  });
});
