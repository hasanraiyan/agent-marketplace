import providerRepository from './provider.repository.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import encryption from '../../utils/encryption.js';
import { ARCHITECT_AGENT_ID } from '../tools/index.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import { PROVIDER_TYPE_PRESETS } from './provider.constants.js';
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
      type: provider.type || 'custom',
      baseURL: provider.baseURL,
      defaultModel: provider.defaultModel,
      isDefault: provider.isDefault,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  /**
   * Non-'custom' types have a canonical baseURL (provider.constants.js);
   * fills it in when the caller didn't send one, so the native types never
   * need a user-supplied Base URL. 'custom' is a no-op — its preset is
   * `null`, and the zod validators already require an explicit baseURL for it.
   */
  _fillPresetBaseUrl(data) {
    if (data.type && data.type !== 'custom' && !data.baseURL) {
      return { ...data, baseURL: PROVIDER_TYPE_PRESETS[data.type] };
    }
    return data;
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

    const { apiKey, ...rest } = this._fillPresetBaseUrl(providerData);

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
   * Feature 2 (dependency/usage lookup, gap-fill audit): "what's using
   * this Provider" — answerable *before* attempting delete, rather than
   * only finding out via deleteProvider's own in-use rejection. Existence/
   * ownership check reuses getProviderById so this 404s identically to
   * every other single-resource read.
   */
  async getProviderUsage(id, userId, context = personaExecutionContext(userId)) {
    await this.getProviderById(id, userId, context);
    const [agentCount, agents] = await Promise.all([
      agentRepository.count({ providerId: id }),
      agentRepository.findAgentsUsingProvider(id, '_id name', 20),
    ]);
    return { agentCount, agents };
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

    updateData = this._fillPresetBaseUrl(updateData);

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
   * Developer Platform (blueprint Phase 11, PR-55): every Provider in a
   * Project's Domain, for Developer Studio's read-only resource-browsing
   * tab — a genuinely separate code path from `getUserProviders` above
   * (which is Persona-only, scoped by `ownerId`, never by Domain).
   * `context` is a `ProjectAdminContext` (Clerk session, never a machine
   * credential — Studio never touches a Project's own API key).
   */
  async listProvidersForProject(context) {
    const providers = await providerRepository.findByDomain(context.domain);
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

  /**
   * OpenAI-shaped REST listing: `GET {baseURL}/models`, Bearer auth,
   * `{data:[{id,...}]}`. Covers 'openai' and 'custom' (any genuinely
   * OpenAI-compatible endpoint) as well as 'deepseek', whose REST API is
   * OpenAI-shaped even though its chat model uses a dedicated LangChain
   * class (agent.factory.js `_buildLLM`).
   */
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

      return data.data.map((model) => ({ id: model.id, label: model.id }));
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Anthropic's native model listing: `GET {baseURL}/models`, `x-api-key` +
   * `anthropic-version` headers (no Bearer), `{data:[{id,display_name}]}`.
   */
  async fetchAnthropicModels(baseURL, apiKey) {
    try {
      const response = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
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

      return data.data.map((model) => ({ id: model.id, label: model.display_name || model.id }));
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Gemini's native model listing: `GET {baseURL}/models?key=<apiKey>`,
   * `{models:[{name:"models/gemini-...", displayName}]}` — `name` is
   * prefixed `models/` and must be stripped to get a usable model id.
   */
  async fetchGeminiModels(baseURL, apiKey) {
    try {
      const response = await fetch(`${baseURL}/models?key=${encodeURIComponent(apiKey)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
      if (!data || !Array.isArray(data.models)) {
        throw new Error('Invalid response format: expected { models: [...] }');
      }

      return data.models.map((model) => ({
        id: model.name.replace(/^models\//, ''),
        label: model.displayName || model.name,
      }));
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Type-aware model-listing dispatcher — the single entry point used by
   * both the pre-save (`testConnectionWithCredentials`) and post-save
   * (`getAvailableModels`) flows, so every caller gets the right strategy
   * for the provider's `type` without duplicating the switch.
   */
  async getModelsForProviderType(type, baseURL, apiKey) {
    switch (type) {
      case 'anthropic':
        return this.fetchAnthropicModels(baseURL, apiKey);
      case 'gemini':
        return this.fetchGeminiModels(baseURL, apiKey);
      case 'openai':
      case 'deepseek':
      case 'custom':
      default:
        return this.fetchModelsFromApi(baseURL, apiKey);
    }
  }

  async testConnectionWithCredentials(type, baseURL, apiKey) {
    const resolvedType = type || 'custom';
    const resolvedBaseUrl = baseURL || PROVIDER_TYPE_PRESETS[resolvedType];
    const models = await this.getModelsForProviderType(resolvedType, resolvedBaseUrl, apiKey);
    return { success: true, models };
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-47a): `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for the
   * existing Persona route. Deliberately deferred out of PR-37 alongside
   * `testConnection` below (both are outbound-network runtime operations,
   * same category as MCP's testConnection/OAuth flows) — generalized now
   * as part of completing the Developer Provider runtime surface.
   */
  async getAvailableModels(providerId, userId, context = personaExecutionContext(userId)) {
    let provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (!isResourceOwner(provider, context)) {
      throw new Error('Unauthorized to access this provider');
    }

    provider = await this._ensureLatestEncryption(provider);

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    return this.getModelsForProviderType(provider.type || 'custom', provider.baseURL, apiKey);
  }

  /** See `getAvailableModels`'s doc comment — identical `context` generalization. */
  async testConnection(providerId, userId, context = personaExecutionContext(userId)) {
    let provider = await providerRepository.findById(providerId);

    if (!provider) {
      throw new Error('Provider not found');
    }

    if (!isResourceOwner(provider, context)) {
      throw new Error('Unauthorized to test this provider');
    }

    provider = await this._ensureLatestEncryption(provider);

    const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
    await this.getModelsForProviderType(provider.type || 'custom', provider.baseURL, apiKey);

    return { success: true, message: 'Connection successful.' };
  }
}

export default new ProviderService();
