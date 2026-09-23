import { createRcpClient } from 'rcp-sdk/client';
import rcpSourceRepository from './rcpSource.repository.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import projectSecretService from '../projects/projectSecret.service.js';
import {
  isResourceOwner,
  isResourceReadable,
  ownerFilterForContext,
  ownerFieldsForContext,
  buildDiscoveryFilter,
} from '../../utils/resourceOwnership.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * RcpSource CRUD + Test Connection — mirrors restApiToolSource.service.js's
 * shape exactly, independent of it. The one thing genuinely different:
 * `testConnection` uses `rcp-sdk`'s own `createRcpClient().discover()`
 * directly — real protocol-conformance checking via the published package,
 * not a hand-rolled reimplementation of it.
 */
class RcpSourceService {
  toSafeJson(source) {
    if (!source) return null;
    const obj = source.toObject ? source.toObject() : source;
    return { ...obj, hasSecret: Boolean(obj.secretRef) };
  }

  async _assertSecretInDomain(context, secretRef) {
    if (!secretRef) return;
    await projectSecretService.getSecretById(context, secretRef);
  }

  /** Builds a `createRcpClient()` bound to one source's own auth — used by both testConnection and rcpSource.tools.js. */
  async _buildClientFor(source) {
    let auth = { type: 'none' };
    if (source.authType === 'header' && source.secretRef) {
      const secret = await projectSecretService.resolvePlaintext(source.secretRef);
      auth = { type: 'header', secret };
    }
    return createRcpClient({ auth, logger });
  }

  async createRcpSource(userId, data, context = personaExecutionContext(userId)) {
    if (data.authType === 'header' && !data.secretRef) {
      throw new ValidationError('A secret is required when auth type is header');
    }
    await this._assertSecretInDomain(context, data.secretRef);
    const sourceData = {
      ...ownerFieldsForContext(context),
      name: data.name,
      description: data.description || '',
      url: data.url,
      authType: data.authType || 'none',
      isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
      secretRef: data.authType === 'header' ? data.secretRef : null,
      paramContextMap: data.paramContextMap || [],
    };
    return await rcpSourceRepository.create(sourceData);
  }

  /**
   * FIX: this used to be `scopedFilter(context?.domain, extra)` with no
   * ownerType/scope branching at all — any caller in the Domain, including
   * any other external user, could list every source, Project- and
   * ExternalUser-owned alike. Now routed through the shared
   * `buildDiscoveryFilter` (resourceOwnership.js) every self-serve domain
   * uses, with `{ ownerType: 'Project' }` as this domain's "shared/
   * browsable" set — RcpSource has no `isPublic`/`visibility` field to
   * fall back to like Skill/Agent do, so the developer's own curated
   * sources are the equivalent default (never another external user's
   * private one).
   */
  _buildDiscoveryFilter(context, filters = {}) {
    const extra = {};
    if (filters.search) {
      extra.name = { $regex: filters.search, $options: 'i' };
    }
    return buildDiscoveryFilter(context, filters, extra, { ownerType: 'Project' });
  }

  async discoverRcpSources(context, filters, pagination) {
    const match = this._buildDiscoveryFilter(context, filters);
    return await rcpSourceRepository.search(match, pagination);
  }

  async countDiscoverRcpSources(context, filters) {
    const match = this._buildDiscoveryFilter(context, filters);
    return await rcpSourceRepository.count(match);
  }

  /**
   * Strict-ownership fetch. `updateRcpSource`/`deleteRcpSource`/
   * `testConnection`/`getRcpSourceUsage` all reuse this for their
   * existence/authorization check — keep it owner-only. Use
   * `getReadableRcpSourceById` instead for a display-only GET that should
   * also admit the Domain's shared/Project-owned sources; do not loosen
   * this one to do that, or every mutation that reuses it inherits the
   * same loosening (see `isResourceReadable`'s doc comment for why this
   * split exists).
   */
  async getRcpSourceById(id, userId, context = personaExecutionContext(userId)) {
    const source = await rcpSourceRepository.findById(id);
    if (!source || !isResourceOwner(source, context)) {
      throw new NotFoundError('RCP source not found');
    }
    return source;
  }

  /**
   * Display-only fetch for the single-resource GET route: also admits this
   * Domain's Project-owned (shared/curated) sources, not just ones the
   * caller strictly owns — mirrors Skill's `isPublic || isOwner` read
   * check, substituting "Project-owned" for "isPublic" (RcpSource has no
   * public/private toggle of its own). Never use this for a mutation.
   */
  async getReadableRcpSourceById(id, userId, context = personaExecutionContext(userId)) {
    const source = await rcpSourceRepository.findById(id);
    if (!isResourceReadable(source, context, (s) => s.ownerType === 'Project')) {
      throw new NotFoundError('RCP source not found');
    }
    return source;
  }

  /** What's using this source, before attempting to delete it. */
  async getRcpSourceUsage(id, userId, context = personaExecutionContext(userId)) {
    await this.getRcpSourceById(id, userId, context);
    const [agentCount, agents] = await Promise.all([
      agentRepository.count({ rcpSources: id }),
      agentRepository.findAgentsUsingRcpSource(id, '_id name', 20),
    ]);
    return { agentCount, agents };
  }

  async updateRcpSource(id, userId, data, context = personaExecutionContext(userId)) {
    const existing = await this.getRcpSourceById(id, userId, context);
    const resolvedAuthType = data.authType || existing.authType;
    const updateData = { ...data };
    if (resolvedAuthType === 'header') {
      const resolvedSecretRef = data.secretRef !== undefined ? data.secretRef : existing.secretRef;
      if (!resolvedSecretRef) {
        throw new ValidationError('A secret is required when auth type is header');
      }
      if (data.secretRef !== undefined) await this._assertSecretInDomain(context, data.secretRef);
    } else if (data.authType === 'none') {
      updateData.secretRef = null;
    }
    const source = await rcpSourceRepository.update(id, ownerFilterForContext(context), updateData);
    await this._invalidateAgentsUsingSource(id);
    return source;
  }

  async deleteRcpSource(id, userId, context = personaExecutionContext(userId)) {
    await this.getRcpSourceById(id, userId, context);
    const agents = await agentRepository.findAgentsUsingRcpSource(id, '_id');
    await agentRepository.removeRcpSourceFromAgents(id);
    for (const agent of agents) agentFactory.invalidate(agent._id);
    return await rcpSourceRepository.delete(id, ownerFilterForContext(context));
  }

  async _invalidateAgentsUsingSource(sourceId) {
    const agents = await agentRepository.findAgentsUsingRcpSource(sourceId, '_id');
    for (const agent of agents) agentFactory.invalidate(agent._id);
  }

  /**
   * Test Connection: uses `rcp-sdk`'s `createRcpClient().discover()` to
   * fetch+validate the manifest against the real protocol schema, then
   * stores just a display-only summary — never creates/updates/deletes
   * any other document.
   */
  async testConnection(id, userId, context = personaExecutionContext(userId)) {
    const source = await this.getRcpSourceById(id, userId, context);
    const client = await this._buildClientFor(source);

    let discovered;
    try {
      discovered = await client.discover(source.url);
    } catch (err) {
      throw new ValidationError(err?.message || 'Could not discover the RCP manifest');
    }

    const toolSummaries = discovered.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      method: tool.method,
      url: tool.url,
      // `_buildClientFor` above registers no resolvers, so `exposedParams`
      // here is always the tool's complete, unfiltered param list.
      params: (tool.exposedParams || []).map((param) => ({
        name: param.name,
        type: param.type || 'string',
        description: param.description || '',
        required: Boolean(param.required),
      })),
    }));

    await rcpSourceRepository.update(id, ownerFilterForContext(context), {
      tools: toolSummaries,
      lastTestedAt: new Date(),
    });

    logger.info(
      `[RcpSource] test connection for "${source.name}": ${toolSummaries.length} tools discovered`
    );

    return { tools: toolSummaries };
  }
}

export default new RcpSourceService();
