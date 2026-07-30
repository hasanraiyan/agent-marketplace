import { jest } from '@jest/globals';

// Mock dependencies before importing the service
jest.unstable_mockModule('../src/modules/providers/provider.repository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    clearDefaultKeys: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.repository.js', () => ({
  default: {
    count: jest.fn(),
    findAgentsUsingProvider: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: {
    invalidate: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    needsReencryption: jest.fn().mockReturnValue(false),
  },
}));

const providerRepository = (await import('../src/modules/providers/provider.repository.js'))
  .default;
const agentRepository = (await import('../src/modules/agents/agent.repository.js')).default;
const agentFactory = (await import('../src/modules/agents/agent.factory.js')).default;
const encryption = (await import('../src/utils/encryption.js')).default;
const { ARCHITECT_AGENT_ID } = await import('../src/modules/tools/index.js');
const providerService = (await import('../src/modules/providers/provider.service.js')).default;

describe('Provider Service', () => {
  let mockProvider;
  let mockUserId;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserId = '507f1f77bcf86cd799439011';
    mockProvider = {
      _id: '507f1f77bcf86cd799439022',
      ownerId: mockUserId,
      label: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKeyEncrypted: 'encrypted-token',
      defaultModel: 'gpt-4o',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('createProvider', () => {
    test('should encrypt api key and create provider', async () => {
      encryption.encrypt.mockReturnValue('encrypted-token');
      providerRepository.create.mockResolvedValue(mockProvider);

      const providerData = {
        label: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'raw-api-key',
        defaultModel: 'gpt-4o',
        isDefault: false,
      };

      const result = await providerService.createProvider(mockUserId, providerData);

      expect(encryption.encrypt).toHaveBeenCalledWith('raw-api-key');
      expect(providerRepository.create).toHaveBeenCalledWith({
        label: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o',
        isDefault: false,
        ownerType: 'PersonaUser',
        ownerId: mockUserId,
        apiKeyEncrypted: 'encrypted-token',
      });

      // Ensure API key is stripped from return
      expect(result.apiKey).toBeUndefined();
      expect(result.id).toBe(mockProvider._id);
      expect(result.label).toBe(mockProvider.label);
    });

    test('should clear default keys if new provider isDefault', async () => {
      encryption.encrypt.mockReturnValue('encrypted-token');
      providerRepository.create.mockResolvedValue(mockProvider);

      await providerService.createProvider(mockUserId, {
        label: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'key',
        defaultModel: 'gpt',
        isDefault: true,
      });

      expect(providerRepository.clearDefaultKeys).toHaveBeenCalledWith({ ownerId: mockUserId });
    });
  });

  describe('updateProvider', () => {
    test('should throw if provider not found', async () => {
      providerRepository.findById.mockResolvedValue(null);

      await expect(providerService.updateProvider(mockUserId, 'invalid-id', {})).rejects.toThrow(
        'Provider not found'
      );
    });

    test('should throw if unauthorized', async () => {
      providerRepository.findById.mockResolvedValue({
        ...mockProvider,
        ownerId: 'different-user-id', // Simulated unauthorized
      });

      await expect(
        providerService.updateProvider(mockUserId, mockProvider._id, {})
      ).rejects.toThrow('Unauthorized to update this provider');
    });

    test('should encrypt new apiKey if provided', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      encryption.encrypt.mockReturnValue('new-encrypted-token');
      providerRepository.update.mockResolvedValue({
        ...mockProvider,
        apiKeyEncrypted: 'new-encrypted-token',
        label: 'New Label',
      });
      agentRepository.findAgentsUsingProvider.mockResolvedValue([]);

      await providerService.updateProvider(mockUserId, mockProvider._id, {
        apiKey: 'new-raw-key',
        label: 'New Label',
      });

      expect(encryption.encrypt).toHaveBeenCalledWith('new-raw-key');
      expect(providerRepository.update).toHaveBeenCalledWith(mockProvider._id, {
        label: 'New Label',
        apiKeyEncrypted: 'new-encrypted-token',
      });
    });

    test('should run clearDefaultKeys if isDefault is true', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      providerRepository.update.mockResolvedValue(mockProvider);
      agentRepository.findAgentsUsingProvider.mockResolvedValue([{ _id: mockProvider._id }]);

      await providerService.updateProvider(mockUserId, mockProvider._id, {
        isDefault: true,
      });

      expect(providerRepository.clearDefaultKeys).toHaveBeenCalledWith({ ownerId: mockUserId });
      expect(agentRepository.findAgentsUsingProvider).toHaveBeenCalled();
      expect(agentFactory.invalidate).toHaveBeenCalledWith(mockProvider._id); // for standard agent
      expect(agentFactory.invalidate).toHaveBeenCalledWith(ARCHITECT_AGENT_ID); // for architect
    });

    test('should invalidate all dependent agents', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      providerRepository.update.mockResolvedValue(mockProvider);
      agentRepository.findAgentsUsingProvider.mockResolvedValue([
        { _id: 'agent1' },
        { _id: 'agent2' },
      ]);

      await providerService.updateProvider(mockUserId, mockProvider._id, {
        label: 'New Label',
      });

      expect(agentFactory.invalidate).toHaveBeenCalledWith('agent1');
      expect(agentFactory.invalidate).toHaveBeenCalledWith('agent2');
      expect(agentFactory.invalidate).toHaveBeenCalledWith(ARCHITECT_AGENT_ID);
    });
  });

  describe('getUserProviders', () => {
    test('should return mapped safe providers', async () => {
      providerRepository.findByUser.mockResolvedValue([mockProvider]);

      const results = await providerService.getUserProviders(mockUserId);

      expect(providerRepository.findByUser).toHaveBeenCalledWith(mockUserId);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(mockProvider._id);
      expect(results[0].apiKeyEncrypted).toBeUndefined(); // Should be stripped by mapping
    });
  });

  describe('deleteProvider', () => {
    test('should delete successfully if owned', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      agentRepository.count.mockResolvedValue(0);
      providerRepository.delete.mockResolvedValue(mockProvider);

      const result = await providerService.deleteProvider(mockUserId, mockProvider._id);

      expect(providerRepository.delete).toHaveBeenCalledWith(mockProvider._id);
      expect(result).toBe(true);
    });

    test('should throw unauthorized if not owner', async () => {
      providerRepository.findById.mockResolvedValue({
        ...mockProvider,
        ownerId: 'some-other-dude',
      });

      await expect(providerService.deleteProvider(mockUserId, mockProvider._id)).rejects.toThrow(
        'Unauthorized to delete this provider'
      );
    });

    test('AD-06 §22: dependency count is scoped to providerId alone, not ownerId', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      agentRepository.count.mockResolvedValue(0);
      providerRepository.delete.mockResolvedValue(mockProvider);

      await providerService.deleteProvider(mockUserId, mockProvider._id);

      expect(agentRepository.count).toHaveBeenCalledWith({ providerId: mockProvider._id });
      const callArg = agentRepository.count.mock.calls[0][0];
      expect(callArg.ownerId).toBeUndefined();
    });

    test('blocks deletion when any agent (regardless of owner) still references the provider', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      agentRepository.count.mockResolvedValue(2);

      await expect(providerService.deleteProvider(mockUserId, mockProvider._id)).rejects.toThrow(
        /2 agents/
      );
      expect(providerRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    test('should succeed if model fetching works', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      encryption.decrypt.mockReturnValue('raw-api-key');

      // Mock the fetch call
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'gpt-4' }] }),
        })
      );

      const result = await providerService.testConnection(mockProvider._id, mockUserId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful.');
      expect(global.fetch).toHaveBeenCalledWith(`${mockProvider.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer raw-api-key`,
          'Content-Type': 'application/json',
        },
      });
    });

    test('should throw unauthorized if testing someone elses provider', async () => {
      providerRepository.findById.mockResolvedValue({
        ...mockProvider,
        ownerId: 'another-user',
      });

      await expect(providerService.testConnection(mockProvider._id, mockUserId)).rejects.toThrow(
        'Unauthorized to test this provider'
      );
    });

    test('blueprint Phase 9, PR-47a: rejects a different Project testing a Project-owned Provider', async () => {
      const projectProvider = {
        ...mockProvider,
        ownerId: undefined,
        domain: 'project-1',
        ownerType: 'Project',
      };
      providerRepository.findById.mockResolvedValue(projectProvider);

      await expect(
        providerService.testConnection(mockProvider._id, 'irrelevant', {
          domain: 'project-2',
          principalType: 'ProjectMachine',
        })
      ).rejects.toThrow('Unauthorized to test this provider');
    });
  });

  describe('testConnectionWithCredentials', () => {
    test('should return success with models list', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'gpt-4' }, { id: 'gpt-3.5' }] }),
        })
      );
      const result = await providerService.testConnectionWithCredentials(
        'https://test.api/v1',
        'key123'
      );
      expect(result.success).toBe(true);
      expect(result.models).toEqual([{ id: 'gpt-4' }, { id: 'gpt-3.5' }]);
    });

    test('should throw error on fetch failure', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ error: { message: 'Invalid API Key' } }),
        })
      );
      await expect(
        providerService.testConnectionWithCredentials('https://test.api/v1', 'key123')
      ).rejects.toThrow(
        'Connection test failed: Failed to fetch models: 401 Unauthorized - Invalid API Key'
      );
    });
  });

  describe('getAvailableModels', () => {
    test('should fetch models for a saved provider', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      encryption.decrypt.mockReturnValue('raw-api-key');

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'gpt-4' }, { id: 'gpt-4-turbo' }] }),
        })
      );

      const models = await providerService.getAvailableModels(mockProvider._id, mockUserId);
      expect(models).toEqual([{ id: 'gpt-4' }, { id: 'gpt-4-turbo' }]);
    });

    test('should throw if unauthorized', async () => {
      providerRepository.findById.mockResolvedValue({
        ...mockProvider,
        ownerId: 'another-user',
      });

      await expect(
        providerService.getAvailableModels(mockProvider._id, mockUserId)
      ).rejects.toThrow('Unauthorized to access this provider');
    });

    test('blueprint Phase 9, PR-47a: a Project owner can fetch models for its own Provider', async () => {
      const projectProvider = {
        ...mockProvider,
        ownerId: undefined,
        domain: 'project-1',
        ownerType: 'Project',
      };
      providerRepository.findById.mockResolvedValue(projectProvider);
      encryption.decrypt.mockReturnValue('raw-api-key');
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [{ id: 'gpt-4' }] }) })
      );

      const models = await providerService.getAvailableModels(mockProvider._id, 'irrelevant', {
        domain: 'project-1',
        principalType: 'ProjectMachine',
      });
      expect(models).toEqual([{ id: 'gpt-4' }]);
    });
  });

  describe('ownership generalization (blueprint Phase 9, PR-37)', () => {
    const projectContext = { domain: 'project-1', principalType: 'ProjectMachine' };

    describe('createProvider', () => {
      test('creates a Project-owned Provider for a ProjectMachineContext', async () => {
        encryption.encrypt.mockReturnValue('encrypted-token');
        providerRepository.create.mockResolvedValue(mockProvider);

        await providerService.createProvider(
          'irrelevant',
          {
            label: 'Support Provider',
            baseURL: 'https://api.example.com',
            apiKey: 'key',
            defaultModel: 'gpt-4o',
          },
          projectContext
        );

        expect(providerRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ domain: 'project-1', ownerType: 'Project' })
        );
        const [createArg] = providerRepository.create.mock.calls[0];
        expect(createArg.ownerId).toBeUndefined();
      });
    });

    describe('getProviderById', () => {
      test('recognizes the Project owner via ProjectMachineContext', async () => {
        const projectProvider = {
          ...mockProvider,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'Project',
        };
        providerRepository.findById.mockResolvedValue(projectProvider);

        const result = await providerService.getProviderById(
          mockProvider._id,
          'irrelevant',
          projectContext
        );

        expect(result.id).toBe(mockProvider._id);
      });

      test('rejects a Project-owned Provider from a different Domain', async () => {
        const otherProjectProvider = {
          ...mockProvider,
          ownerId: undefined,
          domain: 'project-2',
          ownerType: 'Project',
        };
        providerRepository.findById.mockResolvedValue(otherProjectProvider);

        await expect(
          providerService.getProviderById(mockProvider._id, 'irrelevant', projectContext)
        ).rejects.toThrow('Provider not found');
      });
    });

    describe('updateProvider', () => {
      test('lets a Project owner update its own Provider', async () => {
        const projectProvider = {
          ...mockProvider,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'Project',
        };
        providerRepository.findById.mockResolvedValue(projectProvider);
        providerRepository.update.mockResolvedValue({ ...projectProvider, label: 'Renamed' });
        agentRepository.findAgentsUsingProvider.mockResolvedValue([]);

        await providerService.updateProvider(
          'irrelevant',
          mockProvider._id,
          { label: 'Renamed' },
          projectContext
        );

        expect(providerRepository.update).toHaveBeenCalledWith(
          mockProvider._id,
          expect.objectContaining({ label: 'Renamed' })
        );
      });

      test('rejects a different Project updating this Project-owned Provider', async () => {
        const otherProjectProvider = {
          ...mockProvider,
          ownerId: undefined,
          domain: 'project-2',
          ownerType: 'Project',
        };
        providerRepository.findById.mockResolvedValue(otherProjectProvider);

        await expect(
          providerService.updateProvider(
            'irrelevant',
            mockProvider._id,
            { label: 'hijack' },
            projectContext
          )
        ).rejects.toThrow('Unauthorized to update this provider');
      });
    });

    describe('deleteProvider', () => {
      test('lets a Project owner delete its own Provider', async () => {
        const projectProvider = {
          ...mockProvider,
          ownerId: undefined,
          domain: 'project-1',
          ownerType: 'Project',
        };
        providerRepository.findById.mockResolvedValue(projectProvider);
        agentRepository.count.mockResolvedValue(0);
        providerRepository.delete.mockResolvedValue(projectProvider);

        const result = await providerService.deleteProvider(
          'irrelevant',
          mockProvider._id,
          projectContext
        );

        expect(result).toBe(true);
      });
    });
  });
});
