import { jest } from '@jest/globals';

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

jest.unstable_mockModule('../src/modules/mcp/mcp.service.js', () => ({
  default: {
    getUserConnectionStatus: jest.fn(),
    getUserAuthorizationUrl: jest.fn(),
  },
}));

const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const mcpService = (await import('../src/modules/mcp/mcp.service.js')).default;
const developerAgentController = (
  await import('../src/modules/developer/developerAgent.controller.js')
).default;

describe('Developer Agent Controller', () => {
  const machineContext = { domain: 'project-1', principalType: 'ProjectMachine' };

  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { projectContext: machineContext, body: {}, params: {}, query: {} };
    mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('discover', () => {
    test('discovers via agentService.discoverAgents using req.projectContext and query params, wrapped in a pagination envelope', async () => {
      mockReq.query = { page: '2', limit: '10', search: 'support', category: 'productivity' };
      agentService.discoverAgents.mockResolvedValue([{ _id: 'a1' }]);
      agentService.countDiscoverAgents.mockResolvedValue(1);

      await developerAgentController.discover(mockReq, mockRes, next);

      expect(agentService.discoverAgents).toHaveBeenCalledWith(
        machineContext,
        { search: 'support', category: 'productivity', scope: undefined },
        { page: 2, limit: 10 }
      );
      expect(agentService.countDiscoverAgents).toHaveBeenCalledWith(machineContext, {
        search: 'support',
        category: 'productivity',
        scope: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          items: [{ _id: 'a1' }],
          pagination: { total: 1, page: 2, limit: 10, pages: 1 },
        },
      });
    });

    test('defaults page/limit when omitted', async () => {
      agentService.discoverAgents.mockResolvedValue([]);
      agentService.countDiscoverAgents.mockResolvedValue(0);

      await developerAgentController.discover(mockReq, mockRes, next);

      expect(agentService.discoverAgents).toHaveBeenCalledWith(machineContext, expect.any(Object), {
        page: 1,
        limit: 20,
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      agentService.discoverAgents.mockRejectedValue(err);

      await developerAgentController.discover(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('create', () => {
    test('creates via agentService.createDeveloperAgent using req.projectContext, never a client-supplied context', async () => {
      mockReq.body = { name: 'Support Bot' };
      agentService.createDeveloperAgent.mockResolvedValue({ _id: 'a1', name: 'Support Bot' });

      await developerAgentController.create(mockReq, mockRes, next);

      expect(agentService.createDeveloperAgent).toHaveBeenCalledWith(machineContext, {
        name: 'Support Bot',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: 'a1', name: 'Support Bot' },
      });
    });

    test('passes errors to next', async () => {
      const err = new Error('boom');
      agentService.createDeveloperAgent.mockRejectedValue(err);

      await developerAgentController.create(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('getOne', () => {
    test('returns the Agent using the :agentId param and req.projectContext', async () => {
      mockReq.params = { agentId: 'a1' };
      agentService.getDeveloperAgentById.mockResolvedValue({ _id: 'a1' });

      await developerAgentController.getOne(mockReq, mockRes, next);

      expect(agentService.getDeveloperAgentById).toHaveBeenCalledWith('a1', machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: { _id: 'a1' } });
    });

    test('collapses "Agent not found or is private" to a 404, existence-hiding', async () => {
      mockReq.params = { agentId: 'a1' };
      agentService.getDeveloperAgentById.mockRejectedValue(
        new Error('Agent not found or is private')
      );

      await developerAgentController.getOne(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    test('passes other errors to next unchanged', async () => {
      mockReq.params = { agentId: 'a1' };
      const err = new Error('database exploded');
      agentService.getDeveloperAgentById.mockRejectedValue(err);

      await developerAgentController.getOne(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('getMcpConnections', () => {
    test('returns connection status for every user-authMode oauth MCP, skipping owner-mode and non-oauth ones', async () => {
      mockReq.params = { agentId: 'a1' };
      mockReq.query = { returnTo: 'https://example.com/copilot' };
      agentService.getDeveloperAgentById.mockResolvedValue({
        _id: 'a1',
        mcps: [
          { _id: 'm1', name: 'User MCP', description: 'desc', authType: 'oauth', authMode: 'user' },
          { _id: 'm2', name: 'Owner MCP', authType: 'oauth', authMode: 'owner' },
          { _id: 'm3', name: 'No auth MCP', authType: 'none' },
        ],
      });
      mcpService.getUserConnectionStatus.mockResolvedValue({ connected: false });
      mcpService.getUserAuthorizationUrl.mockResolvedValue('https://mcp.example.com/authorize?x=1');

      await developerAgentController.getMcpConnections(mockReq, mockRes, next);

      expect(agentService.getDeveloperAgentById).toHaveBeenCalledWith('a1', machineContext);
      // Only the single user-authMode oauth MCP is checked -- owner-mode and non-oauth MCPs
      // are filtered out before any per-user lookup.
      expect(mcpService.getUserConnectionStatus).toHaveBeenCalledTimes(1);
      expect(mcpService.getUserConnectionStatus).toHaveBeenCalledWith(
        'm1',
        undefined,
        machineContext
      );
      expect(mcpService.getUserAuthorizationUrl).toHaveBeenCalledWith(
        'm1',
        undefined,
        'https://example.com/copilot',
        machineContext
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            mcpId: 'm1',
            name: 'User MCP',
            description: 'desc',
            connected: false,
            authorizeUrl: 'https://mcp.example.com/authorize?x=1',
          },
        ],
      });
    });

    test('does not fetch an authorizeUrl when already connected', async () => {
      mockReq.params = { agentId: 'a1' };
      agentService.getDeveloperAgentById.mockResolvedValue({
        _id: 'a1',
        mcps: [{ _id: 'm1', name: 'User MCP', authType: 'oauth', authMode: 'user' }],
      });
      mcpService.getUserConnectionStatus.mockResolvedValue({ connected: true });

      await developerAgentController.getMcpConnections(mockReq, mockRes, next);

      expect(mcpService.getUserAuthorizationUrl).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            mcpId: 'm1',
            name: 'User MCP',
            description: '',
            connected: true,
            authorizeUrl: null,
          },
        ],
      });
    });

    test('collapses "Agent not found or is private" to a 404, existence-hiding', async () => {
      mockReq.params = { agentId: 'a1' };
      agentService.getDeveloperAgentById.mockRejectedValue(
        new Error('Agent not found or is private')
      );

      await developerAgentController.getMcpConnections(mockReq, mockRes, next);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    test('passes other errors to next unchanged', async () => {
      mockReq.params = { agentId: 'a1' };
      const err = new Error('database exploded');
      agentService.getDeveloperAgentById.mockRejectedValue(err);

      await developerAgentController.getMcpConnections(mockReq, mockRes, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('update', () => {
    test('updates via agentService.updateAgent, forwarding req.projectContext as the 4th positional arg', async () => {
      mockReq.params = { agentId: 'a1' };
      mockReq.body = { name: 'New Name' };
      agentService.updateAgent.mockResolvedValue({ _id: 'a1', name: 'New Name' });

      await developerAgentController.update(mockReq, mockRes, next);

      expect(agentService.updateAgent).toHaveBeenCalledWith(
        'a1',
        undefined,
        { name: 'New Name' },
        machineContext
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: 'a1', name: 'New Name' },
      });
    });
  });

  describe('remove', () => {
    test('deletes via agentService.deleteAgent, forwarding req.projectContext', async () => {
      mockReq.params = { agentId: 'a1' };
      agentService.deleteAgent.mockResolvedValue(true);

      await developerAgentController.remove(mockReq, mockRes, next);

      expect(agentService.deleteAgent).toHaveBeenCalledWith('a1', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Agent deleted successfully',
      });
    });
  });

  describe('bulkDelete', () => {
    test('deletes each id via agentService.deleteAgent, splitting deleted/failed', async () => {
      mockReq.body = { ids: ['a1', 'a2'] };
      agentService.deleteAgent.mockImplementation(async (id) => {
        if (id === 'a2') throw new Error('Agent not found');
        return true;
      });

      await developerAgentController.bulkDelete(mockReq, mockRes, next);

      expect(agentService.deleteAgent).toHaveBeenCalledWith('a1', undefined, machineContext);
      expect(agentService.deleteAgent).toHaveBeenCalledWith('a2', undefined, machineContext);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          deleted: ['a1'],
          failed: [{ id: 'a2', reason: expect.any(String) }],
        },
      });
    });
  });
});
