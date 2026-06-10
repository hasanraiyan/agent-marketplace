import providerRepository from '../repositories/providerRepository.js';
import agentRepository from '../repositories/agentRepository.js';
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
    return providers.map((p) => this._formatProvider(p));
  }

  async deleteProvider(userId, providerId) {
    const provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to delete this provider');
    }

    // Block deletion if any of the user's agents still reference this provider
    const dependentCount = await agentRepository.count({ providerId, ownerId: userId });
    if (dependentCount > 0) {
      throw new Error(
        `Cannot delete this provider — ${dependentCount} agent${dependentCount === 1 ? '' : 's'} ` +
          `${dependentCount === 1 ? 'is' : 'are'} still using it. ` +
          `Update those agents to use a different provider first.`
      );
    }

    await providerRepository.delete(providerId);
    return true;
  }

  async fetchModelsFromApi(baseURL, apiKey) {
    try {
      const response = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `Failed to fetch models: ${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.error) {
            errorMessage += ` - ${errorBody.error.message || JSON.stringify(errorBody.error)}`;
          }
        } catch (e) {
          // Ignore json parsing error
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format: expected { data: [...] }');
      }

      // We only need the ID and optionally the provider info, but returning just ID is standard
      return data.data.map((model) => ({ id: model.id }));
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  async testConnectionWithCredentials(baseURL, apiKey) {
    const models = await this.fetchModelsFromApi(baseURL, apiKey);
    return { success: true, models };
  }

  async getAvailableModels(providerId, userId) {
    const provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to access this provider');
    }

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    return this.fetchModelsFromApi(provider.baseURL, apiKey);
  }

  async testConnection(providerId, userId) {
    const provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to test this provider');
    }

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    await this.fetchModelsFromApi(provider.baseURL, apiKey);

    return { success: true, message: 'Connection successful.' };
  }
}

export default new ProviderService();
