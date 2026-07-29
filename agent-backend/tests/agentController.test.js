import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/agents/agent.service.js', () => ({
  default: {
    createAgent: jest.fn(),
    getAgentById: jest.fn(),
    getAgentBySlug: jest.fn(),
    updateAgent: jest.fn(),
    deleteAgent: jest.fn(),
    searchAgents: jest.fn(),
    countAgents: jest.fn(),
  },
  personaExecutionContext: (userId) => ({ domain: 'persona', personaUserId: userId }),
}));

jest.unstable_mockModule('../src/modules/agents/agent.validator.js', () => ({
  createAgentSchema: { parse: jest.fn().mockImplementation((data) => data) },
  updateAgentSchema: { parse: jest.fn().mockImplementation((data) => data) },
  searchAgentSchema: {
    parse: jest
      .fn()
      .mockImplementation((data) => ({ page: 1, limit: 10, sortBy: 'newest', ...data })),
  },
  countAgentSchema: { parse: jest.fn().mockImplementation((data) => data) },
}));

const agentService = (await import('../src/modules/agents/agent.service.js')).default;
const agentController = (await import('../src/modules/agents/agent.controller.js')).default;

describe('Agent Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { id: 'user123' },
      body: {},
      params: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();
  });

  test('search passes body fields as filters and pagination', async () => {
    mockReq.body = { category: 'coding', page: 1, limit: 10, sortBy: 'newest' };
    agentService.searchAgents.mockResolvedValue(['mock1']);

    await agentController.search(mockReq, mockRes, mockNext);

    expect(agentService.searchAgents).toHaveBeenCalledWith(
      { category: 'coding' }, // filters
      { page: 1, limit: 10, sortBy: 'newest' }, // mapped pagination
      'user123'
    );
    expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: ['mock1'] });
  });

  test('search catches 403 authorization logic correctly', async () => {
    agentService.searchAgents.mockRejectedValue(new Error('Not authorized to search'));

    await agentController.search(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not authorized to search',
    });
  });

  test('getOne catches privacy 404', async () => {
    mockReq.params.id = 'agent1';
    agentService.getAgentById.mockRejectedValue(new Error('Agent not found or is private'));

    await agentController.getOne(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });
});
