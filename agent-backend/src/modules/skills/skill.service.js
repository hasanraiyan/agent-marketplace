import skillRepository from './skill.repository.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import BaseError from '../../utils/errors/BaseError.js';

const wantsPublish = (d) =>
  d?.visibility === 'public' || d?.visibility === 'unlisted' || d?.isPublic === true;
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
} from '../../utils/resourceOwnership.js';
import { scopedFilter } from '../../utils/domainQuery.js';

class SkillService {
  /**
   * Developer Platform (blueprint Phase 9, PR-28): `context` defaults to
   * `personaExecutionContext(userId)`, so every existing caller (the
   * Persona `POST /skills` route) that omits it gets byte-for-byte
   * identical behavior. Unlike Agent's `createAgent` (which has
   * Persona-only onboarding logic — Main Agent auto-naming — with no
   * Project/ExternalUser equivalent), Skill's creation has no such
   * complexity, so this one method serves all three owner types directly
   * rather than needing a separate `createDeveloperSkill`.
   */
  async createSkill(userId, skillData, context = personaExecutionContext(userId)) {
    if (wantsPublish(skillData)) await this.assertCanPublish(userId);
    const skill = await skillRepository.create({
      ...skillData,
      ...ownerFieldsForContext(context),
    });
    return skill;
  }

  /**
   * Fetches a specific skill by ID with ownership/visibility check.
   * `context` defaults to `personaExecutionContext(userId)` — zero
   * behavior change for every existing caller.
   */
  async getSkillById(id, userId, context = personaExecutionContext(userId)) {
    const skill = await skillRepository.findById(id);
    if (!skill) throw new Error('Skill not found');

    const isOwner = isResourceOwner(skill, context);
    if (!skill.isPublic && !isOwner) {
      throw new Error('Skill not found or private');
    }

    const skillObj = skill.toObject ? skill.toObject() : skill;
    const personas = await this.resolvePersonas([skill.ownerId]);
    return { ...skillObj, isOwner, persona: personas[String(skill.ownerId)] || null };
  }

  /**
   * Feature 2 (dependency/usage lookup, gap-fill audit): "what's using
   * this Skill" — answerable before attempting delete. Existence/
   * ownership check reuses getSkillById so this 404s identically to every
   * other single-resource read.
   */
  async getSkillUsage(id, userId, context = personaExecutionContext(userId)) {
    await this.getSkillById(id, userId, context);
    const [agentCount, agents] = await Promise.all([
      agentRepository.count({ skills: id }),
      agentRepository.findAgentsUsingSkill(id, '_id name', 20),
    ]);
    return { agentCount, agents };
  }

  /**
   * Lists all skills owned by a user
   */
  async getMySkills(userId) {
    return await skillRepository.findByOwner(userId);
  }

  /**
   * Searches the public skills marketplace
   */
  /**
   * The persona that "plays" a creator's skills: their public main agent.
   * Null when the creator has no public persona (skills are then not playable
   * and never listed on Explore).
   */
  async resolvePersonas(ownerIds) {
    const ids = [...new Set(ownerIds.map(String))];
    if (!ids.length) return {};
    // Invariant: one persona per creator — their main agent — and a skill
    // only plays through it. No fallback to other agents.
    const agents = await agentRepository.search(
      {
        ownerId: { $in: ids },
        isMainAgent: true,
        isActive: true,
        visibility: 'public',
        deletedAt: null,
      },
      { page: 1, limit: 500, sortBy: 'newest' }
    );
    const byOwner = {};
    for (const a of agents) byOwner[String(a.ownerId)] = a;
    const out = {};
    for (const [k, a] of Object.entries(byOwner)) {
      out[k] = { _id: a._id, name: a.name, slug: a.slug, avatarUrl: a.avatarUrl || a.avatar, tagline: a.tagline, isMainAgent: a.isMainAgent };
    }
    return out;
  }

  /** Publishing (public or unlisted) requires a public persona to play through. */
  async assertCanPublish(ownerId) {
    const personas = await this.resolvePersonas([ownerId]);
    if (!personas[String(ownerId)]) {
      throw new BaseError(
        'Publish your persona first: your main agent must be public before a skill can be published.',
        400,
        'PERSONA_REQUIRED'
      );
    }
  }

  async searchPublicSkills(filters, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return await skillRepository.findPublicSkills(filters, skip, limit);
  }

  /**
   * Searches skills by name, description, and instructions
   */
  async searchSkills(userId, params) {
    return await skillRepository.searchSkills(userId, params);
  }

  /**
   * Updates an existing skill. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller. Repository enforces ownership atomically via
   * `ownerFilterForContext(context)`, replacing the previous hardcoded
   * `{ ownerId: userId }` shape (Persona callers get the exact same filter
   * as before).
   */
  async updateSkill(id, userId, updateData, context = personaExecutionContext(userId)) {
    if (wantsPublish(updateData)) await this.assertCanPublish(userId);
    delete updateData.ownerId;
    delete updateData.externalOwnerId;
    delete updateData.ownerType;
    delete updateData.domain;

    const skill = await skillRepository.update(id, ownerFilterForContext(context), updateData);

    // Invalidate factory cache for all agents using this skill
    const agents = await agentRepository.findAgentsUsingSkill(id, '_id');
    for (const agent of agents) {
      agentFactory.invalidate(agent._id);
    }

    return skill;
  }

  /**
   * Deletes a skill and removes it from all agents. `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for every
   * existing caller.
   */
  async deleteSkill(id, userId, context = personaExecutionContext(userId)) {
    // 1. Verify ownership BEFORE performing any side effects
    const skill = await skillRepository.findById(id);
    if (!skill) throw new Error('Skill not found');
    if (!isResourceOwner(skill, context)) {
      throw new Error('Unauthorized to delete this skill');
    }

    const agents = await agentRepository.findAgentsUsingSkill(id, '_id');

    // 2. Remove skill from all agents
    await agentRepository.removeSkillFromAgents(id);

    // 3. Invalidate factory cache for each affected agent
    for (const agent of agents) {
      agentFactory.invalidate(agent._id);
    }

    // 4. Perform the actual deletion
    return await skillRepository.delete(id, ownerFilterForContext(context));
  }

  /**
   * Fetches all agents that use a specific skill
   */
  async getAgentsBySkill(id) {
    return await agentRepository.findAgentsUsingSkill(id, 'name slug avatar visibility');
  }

  /**
   * Developer Platform (AD-07 §19, blueprint Phase 9, PR-44): the Discovery
   * Contract — a GENUINELY SEPARATE code path from Persona's marketplace
   * search (`searchPublicSkills`/`searchSkills` above), mirroring Agent's
   * PR-43 treatment exactly. Three modes, matching AD-07 §15's capability
   * matrix:
   *   - `ProjectMachineContext`/`ProjectAdminContext` ("Project
   *     discovery"): every Skill in this Project's own Domain, any owner
   *     type.
   *   - `ProjectRuntimeContext` with `filters.scope === 'mine'`
   *     ("my Skills"): Domain- and Subject-scoped to just that external
   *     user's own Skills.
   *   - `ProjectRuntimeContext` otherwise ("Project-public browse"):
   *     Domain-scoped, public (`isPublic: true`) Skills only.
   *
   * Unlike Agent, no secret-stripping is needed here — Skill has no
   * "strip for non-owner" concept (PR-29): a Skill is either fully visible
   * (public or owned) or not returned at all, and the filter above already
   * guarantees every result is one the requester is allowed to see in full.
   */
  _buildDeveloperDiscoveryFilter(context, filters = {}) {
    const extra = {};
    if (filters.search) {
      extra.name = { $regex: filters.search, $options: 'i' };
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

    return scopedFilter(context?.domain, { ...extra, isPublic: true });
  }

  async discoverSkills(context, filters, pagination) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    return await skillRepository.search(match, pagination);
  }

  async countDiscoverSkills(context, filters) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    return await skillRepository.count(match);
  }
}

export default new SkillService();
