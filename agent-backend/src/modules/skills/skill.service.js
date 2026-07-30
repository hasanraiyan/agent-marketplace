import skillRepository from './skill.repository.js';
import agentRepository from '../agents/agent.repository.js';
import agentFactory from '../agents/agent.factory.js';
import { personaExecutionContext } from '../agents/agent.service.js';
import {
  isResourceOwner,
  ownerFilterForContext,
  ownerFieldsForContext,
} from '../../utils/resourceOwnership.js';

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
    return { ...skillObj, isOwner };
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
}

export default new SkillService();
