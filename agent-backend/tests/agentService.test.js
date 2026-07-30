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

jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const providerRepository = (await import('../src/modules/providers/provider.repository.js'))
  .default;
const User = (await import('../src/modules/users/user.model.js')).default;
const { default: agentService, personaExecutionContext } =
  await import('../src/modules/agents/agent.service.js');

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

  describe('personaExecutionContext', () => {
    test('wraps a Persona userId with the Persona Domain', () => {
      expect(personaExecutionContext(mockUserId)).toEqual({
        domain: 'persona',
        personaUserId: mockUserId,
      });
    });

    test('tolerates a falsy userId (anonymous/guest access)', () => {
      expect(personaExecutionContext(undefined)).toEqual({
        domain: 'persona',
        personaUserId: undefined,
      });
    });
  });

  describe('canUserExecuteAgent — domain check (AD-04, blueprint §12)', () => {
    test('allows access when the agent has no domain set (pre-backfill data)', () => {
      const agent = { ...mockAgent, domain: undefined };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(mockUserId))).toBe(
        true
      );
    });

    test('allows access when the context carries no domain', () => {
      const agent = { ...mockAgent, domain: 'persona' };
      expect(agentService.canUserExecuteAgent(agent, { personaUserId: mockUserId })).toBe(true);
    });

    test('allows access when the agent and context Domains match', () => {
      const agent = { ...mockAgent, domain: 'persona' };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(mockUserId))).toBe(
        true
      );
    });

    test('denies access — not-found, not forbidden — when the agent and context Domains differ, even for the owner', () => {
      const agent = { ...mockAgent, domain: 'some-other-project-id' };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(mockUserId))).toBe(
        false
      );
    });

    test('denies access when the agent and context Domains differ, for a public agent', () => {
      const agent = { ...mockAgent, domain: 'some-other-project-id', visibility: 'public' };
      expect(agentService.canUserExecuteAgent(agent, personaExecutionContext(guestUserId))).toBe(
        false
      );
    });
  });

  describe('provider ownership validation (AD-06 §23) — createAgent/updateAgent', () => {
    test('createAgent allows attaching a providerId the requesting user owns', async () => {
      providerRepository.findById.mockResolvedValue({ _id: 'prov_1', ownerId: mockUserId });
      agentRepository.findOne.mockResolvedValue({ _id: 'main_agent' });
      agentRepository.findBySlug.mockResolvedValue(null);
      agentRepository.create.mockResolvedValue(mockAgent);

      await agentService.createAgent(mockUserId, { name: 'My Bot', providerId: 'prov_1' });

      expect(providerRepository.findById).toHaveBeenCalledWith('prov_1');
      expect(agentRepository.create).toHaveBeenCalled();
    });

    test('createAgent rejects a providerId owned by a different user', async () => {
      providerRepository.findById.mockResolvedValue({ _id: 'prov_1', ownerId: 'someone_else' });

      await expect(
        agentService.createAgent(mockUserId, { name: 'My Bot', providerId: 'prov_1' })
      ).rejects.toThrow('Invalid provider');
      expect(agentRepository.create).not.toHaveBeenCalled();
    });

    test('createAgent rejects a providerId that does not exist', async () => {
      providerRepository.findById.mockResolvedValue(null);

      await expect(
        agentService.createAgent(mockUserId, { name: 'My Bot', providerId: 'nonexistent' })
      ).rejects.toThrow('Invalid provider');
    });

    test('createAgent skips the provider check entirely when no providerId is given', async () => {
      agentRepository.findOne.mockResolvedValue({ _id: 'main_agent' });
      agentRepository.findBySlug.mockResolvedValue(null);
      agentRepository.create.mockResolvedValue(mockAgent);

      await agentService.createAgent(mockUserId, { name: 'My Bot' });

      expect(providerRepository.findById).not.toHaveBeenCalled();
      expect(agentRepository.create).toHaveBeenCalled();
    });

    test('updateAgent allows attaching a providerId the requesting user owns', async () => {
      agentRepository.findById.mockResolvedValue(mockAgent);
      providerRepository.findById.mockResolvedValue({ _id: 'prov_2', ownerId: mockUserId });
      agentRepository.update.mockResolvedValue({ ...mockAgent, providerId: 'prov_2' });

      await agentService.updateAgent('agent_1', mockUserId, { providerId: 'prov_2' });

      expect(providerRepository.findById).toHaveBeenCalledWith('prov_2');
      expect(agentRepository.update).toHaveBeenCalled();
    });

    test('updateAgent rejects a providerId owned by a different user', async () => {
      agentRepository.findById.mockResolvedValue(mockAgent);
      providerRepository.findById.mockResolvedValue({ _id: 'prov_2', ownerId: 'someone_else' });

      await expect(
        agentService.updateAgent('agent_1', mockUserId, { providerId: 'prov_2' })
      ).rejects.toThrow('Invalid provider');
      expect(agentRepository.update).not.toHaveBeenCalled();
    });

    test('updateAgent skips the provider check when providerId is not part of the update', async () => {
      agentRepository.findById.mockResolvedValue(mockAgent);
      agentRepository.update.mockResolvedValue(mockAgent);

      await agentService.updateAgent('agent_1', mockUserId, { name: 'Renamed' });

      expect(providerRepository.findById).not.toHaveBeenCalled();
      expect(agentRepository.update).toHaveBeenCalled();
    });
  });
});
