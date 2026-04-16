import { jest } from '@jest/globals';

// Mock dependencies before importing the service
jest.unstable_mockModule('../src/repositories/providerRepository.js', () => ({
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    clearUserDefaultKeys: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
}));

const providerRepository = (await import('../src/repositories/providerRepository.js')).default;
const encryption = (await import('../src/utils/encryption.js')).default;
const providerService = (await import('../src/services/provider.service.js')).default;

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

      expect(providerRepository.clearUserDefaultKeys).toHaveBeenCalledWith(mockUserId);
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

    test('should run clearUserDefaultKeys if isDefault is true', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);
      providerRepository.update.mockResolvedValue(mockProvider);

      await providerService.updateProvider(mockUserId, mockProvider._id, {
        isDefault: true,
      });

      expect(providerRepository.clearUserDefaultKeys).toHaveBeenCalledWith(mockUserId);
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
  });

  describe('testConnection', () => {
    test('should return mocked success for MVP', async () => {
      providerRepository.findById.mockResolvedValue(mockProvider);

      const result = await providerService.testConnection(mockProvider._id, mockUserId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Provider test connection mocked for MVP.');
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
  });
});
