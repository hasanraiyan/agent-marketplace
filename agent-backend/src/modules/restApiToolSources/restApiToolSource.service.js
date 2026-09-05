import restApiToolSourceRepository from './restApiToolSource.repository.js';
import { restToolManifestSchema } from './restApiToolSource.validator.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import encryption from '../../utils/encryption.js';
import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
} from '../../utils/resourceOwnership.js';
import { scopedFilter } from '../../utils/domainQuery.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();
const TEST_CONNECTION_TIMEOUT_MS = 10000;

/**
 * RestApiToolSource CRUD + Test Connection — mirrors mcp.service.js's
 * shape exactly. Test Connection only ever writes a display-only `tools`
 * summary onto this document (see restApiToolSource.model.js's doc
 * comment) — it never creates/updates/deletes any `RestApiTool` document.
 * Live tool resolution for agent execution lives in
 * `restApiToolSource.tools.js`, not here.
 */
class RestApiToolSourceService {
  toSafeJson(source) {
    if (!source) return null;
    const obj = source.toObject ? source.toObject() : source;
    const { apiKeyEncrypted, ...rest } = obj;
    return { ...rest, hasApiKey: Boolean(apiKeyEncrypted) };
  }

  async createRestApiToolSource(userId, data, context = personaExecutionContext(userId)) {
    if (data.authType === 'apiKey' && !data.apiKey) {
      throw new ValidationError('API key is required when auth type is apiKey');
    }
    const sourceData = {
      ...ownerFieldsForContext(context),
      name: data.name,
      description: data.description || '',
      url: data.url,
      authType: data.authType || 'none',
      isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
      apiKeyEncrypted: data.authType === 'apiKey' ? encryption.encrypt(data.apiKey) : null,
    };
    return await restApiToolSourceRepository.create(sourceData);
  }

  _buildDiscoveryFilter(context, filters = {}) {
    const extra = {};
    if (filters.search) {
      extra.name = { $regex: filters.search, $options: 'i' };
    }
    return scopedFilter(context?.domain, extra);
  }

  async discoverRestApiToolSources(context, filters, pagination) {
    const match = this._buildDiscoveryFilter(context, filters);
    return await restApiToolSourceRepository.search(match, pagination);
  }

  async countDiscoverRestApiToolSources(context, filters) {
    const match = this._buildDiscoveryFilter(context, filters);
    return await restApiToolSourceRepository.count(match);
  }

  async getRestApiToolSourceById(id, userId, context = personaExecutionContext(userId)) {
    const source = await restApiToolSourceRepository.findById(id);
    if (!source || !isResourceOwner(source, context)) {
      throw new NotFoundError('REST API tool source not found');
    }
    return source;
  }

  /** What's using this source, before attempting to delete it — mirrors mcpService.getMcpUsage. */
  async getRestApiToolSourceUsage(id, userId, context = personaExecutionContext(userId)) {
    await this.getRestApiToolSourceById(id, userId, context);
    const [agentCount, agents] = await Promise.all([
      agentRepository.count({ restApiToolSources: id }),
      agentRepository.findAgentsUsingRestApiToolSource(id, '_id name', 20),
    ]);
    return { agentCount, agents };
  }

  async updateRestApiToolSource(id, userId, data, context = personaExecutionContext(userId)) {
    const existing = await this.getRestApiToolSourceById(id, userId, context);
    const resolvedAuthType = data.authType || existing.authType;
    const updateData = { ...data };
    if (resolvedAuthType === 'apiKey') {
      if (!data.apiKey && !existing.apiKeyEncrypted) {
        throw new ValidationError('API key is required when auth type is apiKey');
      }
      if (data.apiKey) updateData.apiKeyEncrypted = encryption.encrypt(data.apiKey);
      delete updateData.apiKey;
    } else if (data.authType === 'none') {
      updateData.apiKeyEncrypted = null;
    }
    const source = await restApiToolSourceRepository.update(
      id,
      ownerFilterForContext(context),
      updateData
    );
    await this._invalidateAgentsUsingSource(id);
    return source;
  }

  /** Mirrors mcpService.deleteMcp exactly — no child `RestApiTool` docs to cascade to. */
  async deleteRestApiToolSource(id, userId, context = personaExecutionContext(userId)) {
    await this.getRestApiToolSourceById(id, userId, context);
    const agents = await agentRepository.findAgentsUsingRestApiToolSource(id, '_id');
    await agentRepository.removeRestApiToolSourceFromAgents(id);
    for (const agent of agents) agentFactory.invalidate(agent._id);
    return await restApiToolSourceRepository.delete(id, ownerFilterForContext(context));
  }

  async _invalidateAgentsUsingSource(sourceId) {
    const agents = await agentRepository.findAgentsUsingRestApiToolSource(sourceId, '_id');
    for (const agent of agents) agentFactory.invalidate(agent._id);
  }

  /**
   * Test Connection: fetches `source.url`, validates the JSON body as a
   * tool manifest, and stores just a display-only summary — never creates,
   * updates, or deletes any `RestApiTool` document. Never partially
   * applies a malformed/unreachable manifest (validate fully before
   * writing anything).
   */
  async testConnection(id, userId, context = personaExecutionContext(userId)) {
    const source = await this.getRestApiToolSourceById(id, userId, context);

    const headers = {};
    if (source.authType === 'apiKey' && source.apiKeyEncrypted) {
      headers.Authorization = `Bearer ${encryption.decrypt(source.apiKeyEncrypted)}`;
    }

    let res;
    try {
      res = await fetch(source.url, {
        headers,
        signal: AbortSignal.timeout(TEST_CONNECTION_TIMEOUT_MS),
      });
    } catch (err) {
      throw new ValidationError(`Could not reach the manifest URL: ${err?.message || 'network error'}`);
    }
    if (!res.ok) {
      throw new ValidationError(`Manifest URL responded with status ${res.status}`);
    }

    let body;
    try {
      body = await res.json();
    } catch {
      throw new ValidationError('Manifest URL did not return valid JSON');
    }

    const parsed = restToolManifestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        `Manifest payload is invalid: ${parsed.error.issues[0]?.message || 'malformed tool list'}`
      );
    }

    const toolSummaries = parsed.data.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      method: tool.method,
      url: tool.url,
    }));

    await restApiToolSourceRepository.update(id, ownerFilterForContext(context), {
      tools: toolSummaries,
      lastTestedAt: new Date(),
    });

    logger.info(
      `[RestApiToolSource] test connection for "${source.name}": ${toolSummaries.length} tools discovered`
    );

    return { tools: toolSummaries };
  }
}

export default new RestApiToolSourceService();
