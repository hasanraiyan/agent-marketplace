import { jest } from '@jest/globals';
import providerRepository from '../src/modules/providers/provider.repository.js';
import Provider from '../src/modules/providers/provider.model.js';

describe('Provider Repository', () => {
  let mockProvider;
  let mockUserId;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserId = '507f1f77bcf86cd799439011';
    mockProvider = {
      _id: '507f1f77bcf86cd799439022',
      ownerId: mockUserId,
      label: 'OpenAI Dev',
      baseURL: 'https://api.openai.com/v1',
      apiKeyEncrypted: 'encrypted-token-value',
      defaultModel: 'gpt-4o',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockResolvedValue(this),
    };
    mockProvider.save.mockResolvedValue(mockProvider);
  });

  describe('create', () => {
    test('should create a provider successfully', async () => {
      const providerData = {
        ownerId: mockUserId,
        label: 'OpenAI Dev',
        baseURL: 'https://api.openai.com/v1',
        apiKeyEncrypted: 'encrypted-token-value',
        defaultModel: 'gpt-4o',
      };

      const saveSpy = jest.spyOn(Provider.prototype, 'save').mockResolvedValue(mockProvider);

      const result = await providerRepository.create(providerData);

      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual(mockProvider);
    });
  });

  describe('findById', () => {
    test('should find provider by ID', async () => {
      jest.spyOn(Provider, 'findById').mockResolvedValue(mockProvider);

      const result = await providerRepository.findById('507f1f77bcf86cd799439022');

      expect(Provider.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439022');
      expect(result).toEqual(mockProvider);
    });
  });

  describe('findByUser', () => {
    test('should find providers by user ID sorted by createdAt', async () => {
      const mockProviders = [mockProvider];

      jest.spyOn(Provider, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockProviders),
      });

      const result = await providerRepository.findByUser(mockUserId);

      expect(Provider.find).toHaveBeenCalledWith({ ownerId: mockUserId });
      expect(result).toEqual(mockProviders);
    });
  });

  describe('update', () => {
    test('should update provider successfully', async () => {
      const updatedProvider = { ...mockProvider, label: 'OpenAI Prod' };

      jest.spyOn(Provider, 'findByIdAndUpdate').mockResolvedValue(updatedProvider);

      const result = await providerRepository.update('507f1f77bcf86cd799439022', {
        label: 'OpenAI Prod',
      });

      expect(Provider.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439022',
        { label: 'OpenAI Prod' },
        { new: true }
      );
      expect(result).toEqual(updatedProvider);
    });
  });

  describe('delete', () => {
    test('should delete provider successfully', async () => {
      jest.spyOn(Provider, 'findByIdAndDelete').mockResolvedValue(mockProvider);

      const result = await providerRepository.delete('507f1f77bcf86cd799439022');

      expect(Provider.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439022');
      expect(result).toEqual(mockProvider);
    });
  });

  describe('clearDefaultKeys', () => {
    test('should clear default keys for the given ownerFilter', async () => {
      jest.spyOn(Provider, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      const result = await providerRepository.clearDefaultKeys({ ownerId: mockUserId });

      expect(Provider.updateMany).toHaveBeenCalledWith(
        { ownerId: mockUserId, isDefault: true },
        { $set: { isDefault: false } }
      );
      expect(result.modifiedCount).toBe(1);
    });
  });
});
