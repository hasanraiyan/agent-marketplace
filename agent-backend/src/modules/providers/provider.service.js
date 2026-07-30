import providerRepository from './provider.repository.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import encryption from '../../utils/encryption.js';
import { ARCHITECT_AGENT_ID } from '../tools/index.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
} from '../../utils/resourceOwnership.js';

class ProviderService {
  /**
   * Automatically re-encrypts the provider's API key if it's stored in plaintext
   * or using a stale encryption key.
   */
  async _ensureLatestEncryption(provider) {
    if (!encryption.needsReencryption(provider.apiKeyEncrypted)) {
      return provider;
    }

    try {
      const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
      if (!apiKey) return provider; // Should not happen with new DecryptionError

      const apiKeyEncrypted = encryption.encrypt(apiKey);
      const updated = await providerRepository.update(provider._id, { apiKeyEncrypted });

      return updated || provider;
    } catch (err) {
      // If decryption fails, we can't re-encrypt. Log it but don't crash here.
      // The calling method will handle the decryption failure when it tries to use the key.
      // eslint-disable-next-line no-console
      console.error(
        `[ProviderService] Failed lazy re-encryption for ${provider._id}:`,
        err.message
      );
      return provider;
    }
  }

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

  /**
   * Developer Platform (blueprint Phase 9, PR-37): `context` defaults to
   * `personaExecutionContext(userId)`, so every existing caller (the
   * Persona `POST /providers` route) that omits it gets byte-for-byte
   * identical behavior. Same treatment as Skill's `createSkill` (PR-28) —
   * Provider creation has no Persona-only onboarding complexity, so this
   * one method serves both owner types directly (Provider has no
   * `ExternalUser` case — AD-06 §21).
   */
  async createProvider(userId, providerData, context = personaExecutionContext(userId)) {
    if (providerData.isDefault) {
      await providerRepository.clearDefaultKeys(ownerFilterForContext(context));
    }

    const { apiKey, ...rest } = providerData;

    // Encrypt the API key
    const apiKeyEncrypted = encryption.encrypt(apiKey);

    const provider = await providerRepository.create({
      ...rest,
      ...ownerFieldsForContext(context),
      apiKeyEncrypted,
    });

    return this._formatProvider(provider);
  }

  /**
   * Fetches a Provider by ID with an ownership check, formatted for
   * external consumption (never returns `apiKeyEncrypted`). `context`
   * defaults to `personaExecutionContext(userId)`.
   */
  async getProviderById(id, userId, context = personaExecutionContext(userId)) {
    const provider = await providerRepository.findById(id);
    if (!provider || !isResourceOwner(provider, context)) {
      throw new Error('Provider not found');
    }
    return this._formatProvider(provider);
  }

  /**
   * Updates an existing Provider. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller.
   */
  async updateProvider(userId, providerId, updateData, context = personaExecutionContext(userId)) {
    let provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (!isResourceOwner(provider, context)) {
      throw new Error('Unauthorized to update this provider');
    }

    // Ensure encryption is up to date before applying updates
    provider = await this._ensureLatestEncryption(provider);

    if (updateData.isDefault) {
      await providerRepository.clearDefaultKeys(ownerFilterForContext(context));
    }

    // Handle apiKey update if provided
    if (updateData.apiKey) {
      updateData.apiKeyEncrypted = encryption.encrypt(updateData.apiKey);
      delete updateData.apiKey;
    }

    const updatedProvider = await providerRepository.update(providerId, updateData);

    // Invalidate factory cache for all agents using this provider
    const agents = await agentRepository.findAgentsUsingProvider(providerId, '_id');
    for (const agent of agents) {
      agentFactory.invalidate(agent._id);
    }

    // Also invalidate the Architect agent for this user, as it might be using this provider
    agentFactory.invalidate(ARCHITECT_AGENT_ID);

    return this._formatProvider(updatedProvider);
  }

  async getUserProviders(userId) {
    const providers = await providerRepository.findByUser(userId);
    return providers.map((p) => this._formatProvider(p));
  }

  /**
   * Deletes a Provider. `context` defaults to `personaExecutionContext(userId)`
   * — zero behavior change for every existing caller.
   */
  async deleteProvider(userId, providerId, context = personaExecutionContext(userId)) {
    const provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (!isResourceOwner(provider, context)) {
      throw new Error('Unauthorized to delete this provider');
    }

    // Developer Platform (AD-06 §22): scoped to providerId alone, not
    // ownerId — a Provider can only ever be referenced by its own owner's
    // Agents today (attachment-time ownership check, agent.service.js
    // assertOwnsProvider), but scoping the count to providerId directly is
    // the correct, defense-in-depth fix: it doesn't silently undercount if
    // that invariant is ever loosened (e.g. future Project-shared
    // Providers), and it's exactly as cheap to compute for the current
    // single-owner case.
    const dependentCount = await agentRepository.count({ providerId });
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
    let provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to access this provider');
    }

    provider = await this._ensureLatestEncryption(provider);

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    return this.fetchModelsFromApi(provider.baseURL, apiKey);
  }

  async testConnection(providerId, userId) {
    let provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (provider.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to test this provider');
    }

    provider = await this._ensureLatestEncryption(provider);

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    await this.fetchModelsFromApi(provider.baseURL, apiKey);

    return { success: true, message: 'Connection successful.' };
  }
}

export default new ProviderService();
