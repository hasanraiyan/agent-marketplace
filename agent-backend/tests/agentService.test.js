import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/repositories/agentRepository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
  },
}));

const agentRepository = (await import('../src/repositories/agentRepository.js')).default;
const agentService = (await import('../src/services/agent.service.js')).default;

describe('Agent Service', () => {
  let mockAgent;
  const mockUserId = 'user_123';
  const guestUserId = 'guest_999';

  beforeEach(() => {
    jest.clearAllMocks();

    mockAgent = {
      _id: 'agent_1',
      ownerId: mockUserId,
      name: 'JS Expert',
      slug: 'js-expert-xyz',
      systemPrompt: 'Secret stuff',
      providerId: 'prov_1',
      visibility: 'public',
      toObject: function() { return { ...this }; }
    };
  });

  describe('slug generation', () => {
    test('should generate slug successfully', async () => {
      agentRepository.findBySlug.mockResolvedValue(null);
      agentRepository.create.mockResolvedValue(mockAgent);

      await agentService.createAgent(mockUserId, { name: 'My Special Bot!!!' });
      
      expect(agentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        ownerId: mockUserId,
        name: 'My Special Bot!!!',
        slug: expect.stringMatching(/^my-special-bot-[0-9a-f]{6}$/)
      }));
    });
  });

  describe('security parsing (_formatSafe)', () => {
    test('should keep secrets if requesting user is owner', async () => {
      agentRepository.findById.mockResolvedValue(mockAgent);
      
      const result = await agentService.getAgentById('agent_1', mockUserId);
      expect(result.systemPrompt).toBeDefined();
      expect(result.providerId).toBeDefined();
    });

    test('should strip secrets if requesting user is NOT owner', async () => {
      agentRepository.findById.mockResolvedValue(mockAgent); // is public
      
      const result = await agentService.getAgentById('agent_1', guestUserId);
      expect(result.systemPrompt).toBeUndefined();
      expect(result.providerId).toBeUndefined();
    });
    
    test('should throw error if guest tries to view private agent', async () => {
      mockAgent.visibility = 'private';
      agentRepository.findById.mockResolvedValue(mockAgent); 
      
      await expect(
        agentService.getAgentById('agent_1', guestUserId)
      ).rejects.toThrow('Agent not found or is private');
    });
  });

  describe('search rules', () => {
    test('standard marketplace search forces public visibility', async () => {
      agentRepository.search.mockResolvedValue([mockAgent]);
      
      await agentService.searchAgents({ category: 'coding' }, { page: 1 }, null);

      expect(agentRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'coding',
          visibility: 'public'
        }),
        expect.anything()
      );
    });

    test('user searching their own dashboard gets all visibilities', async () => {
      agentRepository.search.mockResolvedValue([mockAgent]);
      
      await agentService.searchAgents({ ownerId: mockUserId }, { page: 1 }, mockUserId);

      expect(agentRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: mockUserId,
        }), // Visibility constraint shouldn't be overridden
        expect.anything()
      );
    });
    
    test('user searching someone elses dashboard throws on private', async () => {
      await expect(
        agentService.searchAgents({ ownerId: 'some_other_dev', visibility: 'private' }, { page: 1 }, mockUserId)
      ).rejects.toThrow('Not authorized to search other users private agents');
    });
  });
});
