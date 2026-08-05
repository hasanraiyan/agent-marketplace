import agentRepository from './agent.repository.js';
import providerRepository from '../providers/provider.repository.js';
import User from '../users/user.model.js';
import crypto from 'crypto';
import { PERSONA_DOMAIN } from '../auth/personaPrincipalContext.js';
import { scopedFilter } from '../../utils/domainQuery.js';

/**
 * Developer Platform (AD-06 §23, §12; blueprint Phase 9, PR-25): validates
 * that a `providerId` an Agent wants to attach is actually usable by the
 * requesting context before accepting it. Skips the check when
 * `providerId` is absent/unchanged.
 *
 * Two distinct rules, per AD-06 §12's "Domain-boundary-is-sufficient-
 * policy" finding:
 *   - Persona caller: unchanged, exact `provider.ownerId` match — Persona
 *     Domain hosts many independent Persona Users, so Domain alone is NOT
 *     sufficient; a Persona user must own the Provider outright.
 *   - Project/ExternalUser caller: `provider.domain` match — a Project's
 *     own Providers may be used by ANY of that Project's own Agents
 *     (System-owned or ExternalUser-owned), since `ExternalUser` cannot
 *     itself own a Provider (AD-04 §17) and cross-Domain references are
 *     already forbidden — the Domain boundary is already the correct,
 *     minimal choice set with no separate allow-list needed.
 */
async function assertOwnsProvider(context, providerId) {
  if (!providerId) return;
  const provider = await providerRepository.findById(providerId);
  if (!provider) throw new Error('Invalid provider');

  if (context?.principalType && context.principalType !== 'PersonaUser') {
    if (provider.domain !== context.domain) {
      throw new Error('Invalid provider');
    }
    return;
  }

  if (provider.ownerId.toString() !== String(context?.personaUserId)) {
    throw new Error('Invalid provider');
  }
}

/**
 * Wraps a bare Persona userId (the only identity shape every current
 * caller of `canUserExecuteAgent` has available) into the minimal
 * execution-authorization context it now expects. `userId` may be
 * falsy — anonymous/guest access to a public agent is a legitimate,
 * pre-existing case this must keep supporting.
 */
export function personaExecutionContext(userId) {
  return { domain: PERSONA_DOMAIN, principalType: 'PersonaUser', personaUserId: userId };
}

/**
 * Developer Platform (AD-04 §18, blueprint Phase 9, PR-25): true if
 * `context` represents the actual owner of `agent`, across all three
 * owner types — the single shared definition of "owner" now used by
 * execution authorization (`canUserExecuteAgent`), management
 * authorization (`updateAgent`/`deleteAgent`), and — once PR-26 needs it —
 * safe-formatting. Domain-qualified first: a same-shaped identity in a
 * DIFFERENT Domain is never treated as the owner, closing the same class
 * of gap `canUserExecuteAgent`'s existing domain check already closes for
 * execution.
 *
 * Before this helper existed, only the `PersonaUser` case was ever
 * checked (a bare `ownerId` string comparison) — meaning a Project or
 * ExternalUser context could never be recognized as the owner of its own
 * Project-owned/ExternalUser-owned Agent, incorrectly denying owner-only
 * actions (testing a private/inactive Agent, updating, deleting) to the
 * very context that created it.
 */
function isAgentOwner(agent, context) {
  if (!agent || !context) return false;
  if (agent.domain && context.domain && agent.domain !== context.domain) return false;

  switch (agent.ownerType) {
    case 'Project':
      return context.principalType === 'ProjectMachine' || context.principalType === 'ProjectAdmin';
    case 'ExternalUser':
      return (
        context.principalType === 'ProjectRuntime' &&
        Boolean(agent.externalOwnerId) &&
        String(agent.externalOwnerId) === String(context.externalUserId)
      );
    case 'PersonaUser':
    default: {
      const ownerIdStr = agent.ownerId ? agent.ownerId.toString() : null;
      const requestingIdStr = context.personaUserId ? context.personaUserId.toString() : null;
      return Boolean(requestingIdStr && ownerIdStr === requestingIdStr);
    }
  }
}

class AgentService {
  /**
   * Generates a unique URL-friendly slug based on the agent name
   */
  async _generateSlug(name) {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, ''); // Trim dashes

    // Append a short random string to guarantee uniqueness
    const randomHex = crypto.randomBytes(3).toString('hex');
    const slug = `${baseSlug || 'agent'}-${randomHex}`;

    // Technically not strictly necessary since the random hex provides high entropy,
    // but a sanity check loop ensures 0% conflict probability.
    let isUnique = false;
    let finalSlug = slug;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      const existing = await agentRepository.findBySlug(finalSlug);
      if (!existing) {
        isUnique = true;
      } else {
        finalSlug = `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
      }
      attempts++;
    }

    return finalSlug;
  }

  /**
   * Generates a slug that strictly matches the given base (username/name),
   * only falling back to a random suffix if that exact slug is already taken.
   */
  async _generateMainSlug(base) {
    const baseSlug =
      (base || 'me')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || 'me';

    let finalSlug = baseSlug;
    let attempts = 0;
    while (attempts < 5) {
      const existing = await agentRepository.findBySlug(finalSlug);
      if (!existing) return finalSlug;
      finalSlug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
      attempts++;
    }
    return finalSlug;
  }

  /**
   * Strips sensitive secrets (system prompt and provider config) from an agent
   * if the user accessing it is NOT the original owner.
   */
  _formatSafe(agent, requestingUserId) {
    if (!agent) return null;

    const obj = agent.toObject ? agent.toObject() : agent;

    const ownerIdStr = obj.ownerId ? obj.ownerId.toString() : null;
    const requestingIdStr = requestingUserId ? requestingUserId.toString() : null;

    const isOwner = requestingIdStr && ownerIdStr === requestingIdStr;
    const isVirtual = obj.isVirtual === true || obj._id === '000000000000000000000000';

    if (!isOwner && !isVirtual) {
      delete obj.systemPrompt;
      delete obj.providerId;
    }

    return obj;
  }

  /**
   * Builds the strict MongoDB $match filter out of the incoming user search parameters,
   * ensuring that users can't bypass visibility rules.
   */
  _buildSearchFilter(filters, requestingUserId) {
    const match = { isActive: true }; // Only ever show active agents

    // 1. Text Search
    if (filters.search) {
      match.name = { $regex: filters.search, $options: 'i' };
    }

    // 2. Category
    if (filters.category) {
      match.category = filters.category;
    }

    // 3. Tags
    if (filters.tags && filters.tags.length > 0) {
      match.tags = { $in: filters.tags };
    }

    // 4. Security & Visibility constraints
    if (filters.ownerId) {
      match.ownerId = filters.ownerId;

      // If the user is filtering by an ownerId that is NOT themselves,
      // they cannot see private agents.
      const isSearchingSelf = requestingUserId && filters.ownerId === requestingUserId.toString();
      if (!isSearchingSelf) {
        // Only return non-private agents
        if (filters.visibility === 'private') {
          throw new Error('Not authorized to search other users private agents');
        }
        match.visibility = filters.visibility || { $in: ['public', 'unlisted'] };
      } else {
        // They are searching themselves, respect their own visibility filter if provided
        if (filters.visibility) match.visibility = filters.visibility;
      }
    } else {
      // General marketplace search (no specific owner)
      // Must ONLY show public agents, unless the query explicitly asks for unlisted (requires knowing the ID anyway usually).
      if (filters.visibility === 'private' || filters.visibility === 'unlisted') {
        throw new Error('Can only search marketplace for public agents');
      }
      match.visibility = 'public';
      // Developer Platform (AD-03, blueprint Phase 3): scope marketplace
      // search to a Domain instead of leaking every Domain's public agents
      // into one global result set. Defaults to Persona's own Domain,
      // which is every current caller's behavior today (no caller passes
      // `filters.domain` yet, and every existing/backfilled Agent has
      // domain: PERSONA_DOMAIN) — a zero-observable-change default that
      // closes the gap for whenever a Project-scoped caller exists.
      match.domain = filters.domain || PERSONA_DOMAIN;
    }

    return match;
  }

  async createAgent(userId, data) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    await assertOwnsProvider(personaExecutionContext(userId), data.providerId);

    const mainAgent = await agentRepository.findOne({
      ownerId: userId,
      isMainAgent: true,
      isActive: true,
    });

    const agentData = { ...data };

    if (!mainAgent) {
      // First active agent becomes the user's Main Agent (Clone), locked to their username.
      agentData.isMainAgent = true;
      agentData.name = user.username || user.name || 'My Clone';
      agentData.slug = await this._generateMainSlug(user.username || user.name);
    } else {
      agentData.isMainAgent = false;
      agentData.slug = await this._generateSlug(data.name);
    }

    try {
      const agent = await agentRepository.create({
        ...agentData,
        ownerId: userId,
      });

      return this._formatSafe(agent, userId);
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.isMainAgent) {
        const err = new Error('You already have a Main Agent.');
        err.statusCode = 409;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Evaluates execution authorization for a requester against an agent
   * object. Central source of truth for agent availability and access
   * control.
   *
   * Developer Platform (AD-04, AD-07 §29, blueprint §12): `context` is a
   * minimal execution-authorization context (see `personaExecutionContext`
   * above, and the Project-side context factories in
   * `projectPrincipalContext.js`). The domain check runs first and
   * collapses a mismatch to the same "not executable" result as every
   * other rejection reason here, matching the existing 404-not-403,
   * existence-hiding pattern this function already used for private
   * agents. It only ever fires when BOTH sides carry a domain — every
   * mock/fixture that omits `agent.domain` (pre-backfill data, or tests
   * that don't set it) is unaffected.
   *
   * UPDATE (blueprint Phase 9, PR-25): owner detection now goes through
   * the shared `isAgentOwner` helper instead of a Persona-only inline
   * check. Previously a Project or ExternalUser context could never be
   * recognized as the owner of its own Agent — meaning a Project could
   * never test its own private/inactive Agent, the same "owner testing"
   * allowance Persona users already had. Zero behavior change for
   * PersonaUser-owned Agents: `isAgentOwner`'s PersonaUser branch is the
   * exact same `ownerId` string comparison this function used inline
   * before.
   *
   * @param {Object} agent - Agent document or plain object
   * @param {Object} [context] - Execution-authorization context
   * @returns {boolean} True if execution is allowed, false otherwise
   */
  canUserExecuteAgent(agent, context) {
    if (!agent) return false;

    // Virtual system agents (e.g. Architect agent) are always executable
    if (agent.isVirtual === true || agent._id === '000000000000000000000000') {
      return true;
    }

    // Soft-deleted agents are never executable by anyone (owner or non-owner)
    if (agent.deletedAt) {
      return false;
    }

    if (agent.domain && context?.domain && agent.domain !== context.domain) {
      return false;
    }

    const isOwner = isAgentOwner(agent, context);

    // Inactive agents can only be executed by their owner (e.g. Studio testing)
    if (agent.isActive === false && !isOwner) {
      return false;
    }

    // Private agents can only be executed by their owner
    if (agent.visibility === 'private' && !isOwner) {
      return false;
    }

    // Public and unlisted active agents (and owner access) are allowed
    return true;
  }

  async getAgentById(id, userId) {
    const agent = await agentRepository.findById(id);
    if (!agent || !this.canUserExecuteAgent(agent, personaExecutionContext(userId))) {
      throw new Error('Agent not found or is private');
    }

    if (typeof agent.populate === 'function') {
      await agent.populate('skills', 'name description isPublic');
      await agent.populate('mcps', 'name description transport authType authMode isEnabled');
      await agent.populate('knowledgeBases', 'name description documentCount chunkCount');
      await agent.populate('storeMounts', 'name description scope accessMode');
    }

    return this._formatSafe(agent, userId);
  }

  async getAgentBySlug(slug, userId) {
    const agent = await agentRepository.findBySlug(slug);
    if (!agent || !this.canUserExecuteAgent(agent, personaExecutionContext(userId))) {
      throw new Error('Agent not found or is private');
    }

    if (typeof agent.populate === 'function') {
      await agent.populate('skills', 'name description isPublic');
      await agent.populate('mcps', 'name description transport authType authMode isEnabled');
      await agent.populate('knowledgeBases', 'name description documentCount chunkCount');
      await agent.populate('storeMounts', 'name description scope accessMode');
    }

    return this._formatSafe(agent, userId);
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-25): `context` defaults to
   * `personaExecutionContext(userId)`, so every existing caller (the
   * Persona `PUT /agents/:id` route, the Architect's `upsert_agent` tool)
   * that omits it gets byte-for-byte identical behavior — same
   * `isAgentOwner` check `canUserExecuteAgent` already uses, generalized
   * from the previous raw `ownerId` string-equality so a Project/
   * ExternalUser context can now manage its own Agent too.
   */
  async updateAgent(id, userId, updateData, context = personaExecutionContext(userId)) {
    const existing = await agentRepository.findById(id);

    if (!existing) throw new Error('Agent not found');
    if (!isAgentOwner(existing, context)) {
      throw new Error('Unauthorized to update this agent');
    }

    await assertOwnsProvider(context, updateData.providerId);

    // Never allow updating ownerId, externalOwnerId, ownerType, domain, or
    // slug directly via this route.
    delete updateData.ownerId;
    delete updateData.externalOwnerId;
    delete updateData.ownerType;
    delete updateData.domain;
    delete updateData.slug;

    // If changing the name, regenerate slug if explicitly requested?
    // In MVP, we keep the original slug out of simplicity to not break old links.

    const updated = await agentRepository.update(id, updateData);

    // `_formatSafe` only ever recognizes a bare Persona `userId` as owner
    // (deliberately left untouched in PR-25 — see `getDeveloperAgentById`'s
    // doc comment). For a Project/ExternalUser context the `isAgentOwner`
    // check above has already proven this caller IS the owner by the time
    // we reach this line, so return the full object directly rather than
    // have `_formatSafe` incorrectly strip it for a non-Persona `userId`.
    if (context.principalType && context.principalType !== 'PersonaUser') {
      return updated.toObject ? updated.toObject() : updated;
    }
    return this._formatSafe(updated, userId);
  }

  /** See `updateAgent`'s doc comment — identical `context` generalization. */
  async deleteAgent(id, userId, context = personaExecutionContext(userId)) {
    const existing = await agentRepository.findById(id);

    if (!existing) throw new Error('Agent not found');
    if (!isAgentOwner(existing, context)) {
      throw new Error('Unauthorized to delete this agent');
    }

    await agentRepository.delete(id);
    return true;
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-25): creates a Project-owned
   * or ExternalUser-owned Agent — the Developer Platform counterpart to
   * `createAgent`, which is Persona-onboarding-shaped (the "first Agent
   * becomes your Main Agent/Clone" flow) and has no Project/ExternalUser
   * equivalent, so this deliberately does NOT reuse `createAgent`'s body
   * rather than bolting a conditional onto it.
   */
  async createDeveloperAgent(context, data) {
    let ownerType;
    if (context?.principalType === 'ProjectRuntime') {
      ownerType = 'ExternalUser';
    } else if (
      context?.principalType === 'ProjectMachine' ||
      context?.principalType === 'ProjectAdmin'
    ) {
      ownerType = 'Project';
    } else {
      throw new Error(
        'createDeveloperAgent requires a ProjectMachine, ProjectAdmin, or ProjectRuntime context'
      );
    }

    await assertOwnsProvider(context, data.providerId);

    const agentData = {
      ...data,
      domain: context.domain,
      ownerType,
      isMainAgent: false,
      slug: await this._generateSlug(data.name),
    };
    if (ownerType === 'ExternalUser') {
      agentData.externalOwnerId = context.externalUserId;
    }

    const agent = await agentRepository.create(agentData);
    return agent.toObject ? agent.toObject() : agent;
  }

  /**
   * Developer Platform (blueprint Phase 9, PR-26): the context-aware
   * counterpart to `getAgentById` — same visibility rules
   * (`canUserExecuteAgent`: public/unlisted visible to anyone in-Domain,
   * private visible only to the owner), but the "is this the owner"
   * secret-stripping check goes through `isAgentOwner` so a Project/
   * ExternalUser context correctly sees its own Agent's full details
   * (`_formatSafe` can't be reused here — it only ever recognizes a bare
   * Persona `userId` as owner, deliberately left untouched in PR-25).
   */
  async getDeveloperAgentById(id, context) {
    const agent = await agentRepository.findById(id);
    if (!agent || !this.canUserExecuteAgent(agent, context)) {
      throw new Error('Agent not found or is private');
    }

    if (typeof agent.populate === 'function') {
      await agent.populate('skills', 'name description isPublic');
      await agent.populate('mcps', 'name description transport authType authMode isEnabled');
      await agent.populate('knowledgeBases', 'name description documentCount chunkCount');
      await agent.populate('storeMounts', 'name description scope accessMode');
    }

    const obj = agent.toObject ? agent.toObject() : agent;
    if (!isAgentOwner(agent, context)) {
      delete obj.systemPrompt;
      delete obj.providerId;
    }
    return obj;
  }

  async searchAgents(filters, pagination, userId) {
    const match = this._buildSearchFilter(filters, userId);
    const agents = await agentRepository.search(match, pagination);

    return agents.map((agent) => this._formatSafe(agent, userId));
  }

  async countAgents(filters, userId) {
    const match = this._buildSearchFilter(filters, userId);
    return await agentRepository.count(match);
  }

  /**
   * Developer Platform (AD-07 §19, blueprint Phase 9, PR-43): the Discovery
   * Contract — Developer API discovery must be an ENTIRELY SEPARATE code
   * path from Persona's marketplace search (`_buildSearchFilter`/
   * `searchAgents` above), even though both are ultimately Domain-scoped
   * $match builders. Sharing the actual search/discovery *function* would
   * create a single point where a future change could reintroduce
   * cross-Domain leakage in both surfaces at once — so this is a fresh,
   * independent filter builder, not a generalization of the Persona one.
   *
   * Three distinct modes, matching AD-07 §15's capability matrix exactly:
   *   - `ProjectMachineContext`/`ProjectAdminContext` ("Project discovery"):
   *     every Agent in this Project's own Domain, any owner type — a
   *     Project's admin/machine credential can see everything happening
   *     under its own Domain, not just what it directly owns.
   *   - `ProjectRuntimeContext` with `filters.scope === 'mine'`
   *     ("my Agents"): Domain- AND Subject-scoped — only this specific
   *     external user's own Agents.
   *   - `ProjectRuntimeContext` otherwise ("Project-public browse"):
   *     Domain-scoped, public Agents only — mirrors Persona's marketplace
   *     visibility rule, but scoped to this Project's Domain instead of a
   *     global result set.
   */
  _buildDeveloperDiscoveryFilter(context, filters = {}) {
    const extra = { isActive: true };

    if (filters.search) {
      extra.name = { $regex: filters.search, $options: 'i' };
    }
    if (filters.category) {
      extra.category = filters.category;
    }
    if (filters.tags && filters.tags.length > 0) {
      extra.tags = { $in: filters.tags };
    }

    if (context?.principalType === 'ProjectMachine' || context?.principalType === 'ProjectAdmin') {
      return scopedFilter(context.domain, extra);
    }

    if (filters.scope === 'mine') {
      return scopedFilter(context?.domain, {
        ...extra,
        ownerType: 'ExternalUser',
        externalOwnerId: context?.externalUserId,
      });
    }

    return scopedFilter(context?.domain, { ...extra, visibility: 'public' });
  }

  /**
   * Strips `systemPrompt`/`providerId` from a discovery result the
   * requesting context doesn't own — same secret-hiding intent as
   * `_formatSafe`, but Context-aware (Project/ExternalUser, not just a
   * bare Persona `userId`) via the shared `isAgentOwner` helper.
   */
  _formatDiscoveryResult(agent, context) {
    const obj = agent.toObject ? agent.toObject() : agent;
    if (!isAgentOwner(agent, context)) {
      delete obj.systemPrompt;
      delete obj.providerId;
    }
    return obj;
  }

  async discoverAgents(context, filters, pagination) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    const agents = await agentRepository.search(match, pagination);
    return agents.map((agent) => this._formatDiscoveryResult(agent, context));
  }

  async countDiscoverAgents(context, filters) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    return await agentRepository.count(match);
  }
}

export default new AgentService();
