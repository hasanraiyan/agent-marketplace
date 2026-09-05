import restApiToolRepository from './restApiTool.repository.js';
import projectSecretService from '../projects/projectSecret.service.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
} from '../../utils/resourceOwnership.js';
import { scopedFilter } from '../../utils/domainQuery.js';
import {
  RESERVED_TEMPLATE_TOKENS,
  collectTemplateTokens,
  renderTool,
  MissingTemplateValueError,
  ReservedTokenUnresolvedError,
} from './templateEngine.js';
import { isValidMappingPath, applyResponseMappings } from './responseMapper.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();
const TEST_CALL_TIMEOUT_MS = 10000;

/**
 * RestApiTool CRUD + test-call service — mirrors mcp.service.js's shape.
 */
class RestApiToolService {
  toSafeJson(tool) {
    if (!tool) return null;
    const obj = tool.toObject ? tool.toObject() : tool;
    return { ...obj, hasSecret: Boolean(obj.secretRef) };
  }

  _assertValidToolShape(data, { existing } = {}) {
    const authType = data.authType || existing?.authType || 'none';
    const secretRef = data.secretRef !== undefined ? data.secretRef : existing?.secretRef;
    if (authType === 'bearerSecret' && !secretRef) {
      throw new ValidationError('secretRef is required when authType is bearerSecret');
    }

    const paramDescriptors = data.paramDescriptors ?? existing?.paramDescriptors ?? [];
    for (const descriptor of paramDescriptors) {
      if (RESERVED_TEMPLATE_TOKENS.includes(descriptor.name)) {
        throw new ValidationError(
          `"${descriptor.name}" is a reserved template token and cannot be declared as an agent-fillable parameter`
        );
      }
    }

    const responseMappings = data.responseMappings ?? existing?.responseMappings ?? [];
    for (const mapping of responseMappings) {
      if (!isValidMappingPath(mapping.path)) {
        throw new ValidationError(
          `Invalid response mapping path "${mapping.path}" — must look like "@data.field.path"`
        );
      }
    }
  }

  async _assertSecretInDomain(context, secretRef) {
    if (!secretRef) return;
    // Throws NotFoundError if the secret doesn't resolve inside this
    // context's own Domain — mirrors assertOwnsProvider's Domain-boundary
    // check in agent.service.js.
    await projectSecretService.getSecretById(context, secretRef);
  }

  async createRestApiTool(userId, data, context = personaExecutionContext(userId)) {
    this._assertValidToolShape(data);
    await this._assertSecretInDomain(context, data.secretRef);

    const toolData = { ...ownerFieldsForContext(context), ...data };
    return await restApiToolRepository.create(toolData);
  }

  /** Same Domain-boundary-is-sufficient discovery policy as mcpService.discoverMcps. */
  _buildDiscoveryFilter(context, filters = {}) {
    const extra = {};
    if (filters.search) {
      extra.name = { $regex: filters.search, $options: 'i' };
    }

    if (context?.principalType === 'ProjectRuntime' && filters.scope === 'mine') {
      return scopedFilter(context.domain, {
        ...extra,
        ownerType: 'ExternalUser',
        externalOwnerId: context.externalUserId,
      });
    }

    return scopedFilter(context?.domain, extra);
  }

  async discoverRestApiTools(context, filters, pagination) {
    const match = this._buildDiscoveryFilter(context, filters);
    return await restApiToolRepository.search(match, pagination);
  }

  async countDiscoverRestApiTools(context, filters) {
    const match = this._buildDiscoveryFilter(context, filters);
    return await restApiToolRepository.count(match);
  }

  async getRestApiToolById(id, userId, context = personaExecutionContext(userId)) {
    const tool = await restApiToolRepository.findById(id);
    if (!tool || !isResourceOwner(tool, context)) {
      throw new NotFoundError('REST API tool not found');
    }
    return tool;
  }

  async getRestApiToolUsage(id, userId, context = personaExecutionContext(userId)) {
    await this.getRestApiToolById(id, userId, context);
    const [agentCount, agents] = await Promise.all([
      agentRepository.count({ restApiTools: id }),
      agentRepository.findAgentsUsingRestApiTool(id, '_id name', 20),
    ]);
    return { agentCount, agents };
  }

  async updateRestApiTool(id, userId, data, context = personaExecutionContext(userId)) {
    const existing = await this.getRestApiToolById(id, userId, context);
    this._assertValidToolShape(data, { existing });

    const updateData = { ...data };
    if (data.authType === 'none') {
      updateData.secretRef = null;
    } else if (data.secretRef !== undefined) {
      await this._assertSecretInDomain(context, data.secretRef);
    }

    const tool = await restApiToolRepository.update(id, ownerFilterForContext(context), updateData);
    await this._invalidateAgentsUsingTool(id);
    return tool;
  }

  async deleteRestApiTool(id, userId, context = personaExecutionContext(userId)) {
    await this.getRestApiToolById(id, userId, context);
    const agents = await agentRepository.findAgentsUsingRestApiTool(id, '_id');
    await agentRepository.removeRestApiToolFromAgents(id);
    for (const agent of agents) agentFactory.invalidate(agent._id);
    return await restApiToolRepository.delete(id, ownerFilterForContext(context));
  }

  async _invalidateAgentsUsingTool(toolId) {
    const agents = await agentRepository.findAgentsUsingRestApiTool(toolId, '_id');
    logger.info(`[RestApiTool] Invalidating cache for ${agents.length} agents using tool ${toolId}`);
    for (const agent of agents) agentFactory.invalidate(agent._id);
  }

  /**
   * Backs the builder's "Send" button / response-mapping preview. Accepts
   * unsaved draft state plus an optional `testValues.externalUserId`
   * supplied by the authenticated tool-author, for testing only — this is
   * the one deliberate, narrow exception to "the reserved token only ever
   * comes from `context`" (see templateEngine.js's doc comment). Never
   * reachable from the agent tool-calling path (resolveRestApiTools in
   * restApiTool.tools.js calls `renderTool` directly, never this method),
   * and requires the same admin/machine auth as editing the tool.
   *
   * @param {Object} context - the authenticated caller's ProjectAdmin/ProjectMachine context
   * @param {Object} toolDraft - unsaved tool shape (url/queryParams/headers/bodyMode/bodyTemplate/authType/secretRef/paramDescriptors)
   * @param {{externalUserId?: string, [agentTokenName: string]: string}} [testValues]
   * @param {string} [toolId] - when set, persists lastTestedAt/lastTestedStatus onto the saved tool
   */
  async testCall(context, toolDraft, testValues = {}, toolId = null) {
    this._assertValidToolShape(toolDraft);

    const usesExternalUserId = collectTemplateTokens(toolDraft).reservedTokens.includes('externalUserId');
    const effectiveContext =
      usesExternalUserId && testValues.externalUserId
        ? { ...context, principalType: 'ProjectRuntime', externalUserId: testValues.externalUserId }
        : context;

    let rendered;
    try {
      rendered = renderTool(toolDraft, { agentArgs: testValues, context: effectiveContext });
    } catch (error) {
      if (error instanceof MissingTemplateValueError || error instanceof ReservedTokenUnresolvedError) {
        throw new ValidationError(error.message);
      }
      throw error;
    }

    const headers = { 'Content-Type': 'application/json', ...rendered.headers };
    if (toolDraft.authType === 'bearerSecret' && toolDraft.secretRef) {
      const secretValue = await projectSecretService.resolvePlaintext(toolDraft.secretRef);
      headers.Authorization = `Bearer ${secretValue}`;
    }

    const url = new URL(rendered.url);
    for (const [key, value] of Object.entries(rendered.queryParams)) {
      url.searchParams.set(key, value);
    }

    const startedAt = Date.now();
    const res = await fetch(url.toString(), {
      method: toolDraft.method,
      headers,
      body: rendered.body ?? undefined,
      signal: AbortSignal.timeout(TEST_CALL_TIMEOUT_MS),
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    logger.info(
      `[RestApiTool] test call "${toolDraft.name || toolId}" ${toolDraft.method} -> ${res.status} (${Date.now() - startedAt}ms)`
    );

    if (toolId) {
      await restApiToolRepository
        .update(toolId, ownerFilterForContext(context), {
          lastTestedAt: new Date(),
          lastTestedStatus: res.status,
        })
        .catch(() => {});
    }

    return {
      status: res.status,
      ok: res.ok,
      body: json,
      mapped: applyResponseMappings(json, toolDraft.responseMappings),
    };
  }
}

export default new RestApiToolService();
