import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/users/user.model.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const User = (await import('../src/modules/users/user.model.js')).default;
const agentService = (await import('../src/modules/agents/agent.service.js')).default;

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
      toObject: function () {
        return { ...this };
      },
    };

    User.findById.mockResolvedValue({ id: mockUserId, username: 'alice', name: 'Alice A' });
  });

  describe('slug generation (sub-agent)', () => {
    test('should generate a random-suffixed slug for a sub-agent', async () => {
      // A Main Agent already exists, so this create() call is a sub-agent.
      agentRepository.findOne.mockResolvedValue({ _id: 'main_agent' });
      agentRepository.findBySlug.mockResolvedValue(null);
      agentRepository.create.mockResolvedValue(mockAgent);

      await agentService.createAgent(mockUserId, { name: 'My Special Bot!!!' });

      expect(agentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: mockUserId,
          name: 'My Special Bot!!!',
          isMainAgent: false,
          slug: expect.stringMatching(/^my-special-bot-[0-9a-f]{6}$/),
        })
      );
    });
  });

  describe('main agent (clone) creation', () => {
    test('first active agent becomes the Main Agent, locked to the username', async () => {
      agentRepository.findOne.mockResolvedValue(null);
      agentRepository.findBySlug.mockResolvedValue(null);
      agentRepository.create.mockResolvedValue(mockAgent);

      await agentService.createAgent(mockUserId, { name: 'Whatever the user typed' });

      expect(agentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: mockUserId,
          isMainAgent: true,
          name: 'alice',
          slug: 'alice',
        })
      );
    });

    test('falls back to the user name when no Clerk username is set', async () => {
      User.findById.mockResolvedValue({ id: mockUserId, username: null, name: 'Bob B' });
      agentRepository.findOne.mockResolvedValue(null);
      agentRepository.findBySlug.mockResolvedValue(null);
      agentRepository.create.mockResolvedValue(mockAgent);

      await agentService.createAgent(mockUserId, { name: 'Ignored' });

      expect(agentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isMainAgent: true, name: 'Bob B', slug: 'bob-b' })
      );
    });

    test('creating a sub-agent when a Main Agent already exists does not override name', async () => {
      agentRepository.findOne.mockResolvedValue({ _id: 'main_agent', isMainAgent: true });
      agentRepository.findBySlug.mockResolvedValue(null);
      agentRepository.create.mockResolvedValue(mockAgent);

      await agentService.createAgent(mockUserId, { name: 'Research Helper' });

      expect(agentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isMainAgent: false, name: 'Research Helper' })
      );
    });

    test('surfaces a 409 when a race condition creates two Main Agents', async () => {
      agentRepository.findOne.mockResolvedValue(null);
      agentRepository.findBySlug.mockResolvedValue(null);
      const dupError = new Error('duplicate key');
      dupError.code = 11000;
      dupError.keyPattern = { ownerId: 1, isMainAgent: 1, isActive: 1 };
      agentRepository.create.mockRejectedValue(dupError);

      await expect(agentService.createAgent(mockUserId, { name: 'Ignored' })).rejects.toMatchObject(
        {
          statusCode: 409,
        }
      );
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

      await expect(agentService.getAgentById('agent_1', guestUserId)).rejects.toThrow(
        'Agent not found or is private'
      );
    });
  });

  describe('search rules', () => {
    test('standard marketplace search forces public visibility', async () => {
      agentRepository.search.mockResolvedValue([mockAgent]);

      await agentService.searchAgents({ category: 'coding' }, { page: 1 }, null);

      expect(agentRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'coding',
          visibility: 'public',
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
        agentService.searchAgents(
          { ownerId: 'some_other_dev', visibility: 'private' },
          { page: 1 },
          mockUserId
        )
      ).rejects.toThrow('Not authorized to search other users private agents');
    });

    test('general marketplace search defaults to the Persona Domain (AD-03) when no domain filter is given', async () => {
      agentRepository.search.mockResolvedValue([mockAgent]);

      await agentService.searchAgents({ category: 'coding' }, { page: 1 }, null);

      expect(agentRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'persona' }),
        expect.anything()
      );
    });

    test('general marketplace search respects an explicit domain filter', async () => {
      agentRepository.search.mockResolvedValue([mockAgent]);

      await agentService.searchAgents(
        { category: 'coding', domain: 'some-project-id' },
        { page: 1 },
        null
      );

      expect(agentRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({ domain: 'some-project-id' }),
        expect.anything()
      );
    });
  });
});
