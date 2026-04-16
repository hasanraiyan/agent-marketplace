import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';

class ProviderService {
  /**
   * Helper to format a provider object for public consumption (never return raw key)
   */
  _formatProvider(provider) {
    if (!provider) return null;
    return {
      id: provider._id,
      label: provider.label,
      baseURL: provider.baseURL,
      defaultModel: provider.defaultModel,
      isDefault: provider.isDefault,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  async createProvider(userId, providerData) {
    if (providerData.isDefault) {
      await providerRepository.clearUserDefaultKeys(userId);
    }

    const { apiKey, ...rest } = providerData;

    // Encrypt the API key
    const apiKeyEncrypted = encryption.encrypt(apiKey);

    const provider = await providerRepository.create({
      ...rest,
      ownerId: userId,
      apiKeyEncrypted,
    });

    return this._formatProvider(provider);
  }

  async updateProvider(userId, providerId, updateData) {
    const provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to update this provider');
    }

    if (updateData.isDefault) {
      await providerRepository.clearUserDefaultKeys(userId);
    }

    // Handle apiKey update if provided
    if (updateData.apiKey) {
      updateData.apiKeyEncrypted = encryption.encrypt(updateData.apiKey);
      delete updateData.apiKey;
    }

    const updatedProvider = await providerRepository.update(providerId, updateData);
    return this._formatProvider(updatedProvider);
  }

  async getUserProviders(userId) {
    const providers = await providerRepository.findByUser(userId);
    return providers.map(p => this._formatProvider(p));
  }

  async deleteProvider(userId, providerId) {
    const provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to delete this provider');
    }

    // TODO: Note for Phase 3: Add logic here to block deletion if Agents depend on this provider.

    await providerRepository.delete(providerId);
    return true;
  }

  async testConnection(providerId, userId) {
    const provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to test this provider');
    }

    // TODO: In a later phase, upgrade this to robustly ping the provider using LangChain
    // to verify the apiKey and baseURL are functionally working before saving it.
    
    return { success: true, message: 'Provider test connection mocked for MVP.' };
  }
}

export default new ProviderService();
