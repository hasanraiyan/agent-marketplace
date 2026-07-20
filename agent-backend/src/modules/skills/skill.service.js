import skillRepository from './skill.repository.js';
import agentRepository from '../../repositories/agentRepository.js';
import agentFactory from '../../factories/agentFactory.js';

class SkillService {
  /**
   * Creates a new skill for a user
   */
  async createSkill(userId, skillData) {
    // Optional: Add logic to prevent duplicate names per user if not already in repo
    const skill = await skillRepository.create({
      ...skillData,
      ownerId: userId,
    });
    return skill;
  }

  /**
   * Fetches a specific skill by ID with ownership/visibility check
   */
  async getSkillById(id, userId) {
    const skill = await skillRepository.findById(id);
    if (!skill) throw new Error('Skill not found');

    const isOwner = Boolean(userId && skill.ownerId.toString() === userId.toString());
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
   * Updates an existing skill
   */
  async updateSkill(id, userId, updateData) {
    // Repository already handles ownership check via findOneAndUpdate({ _id: id, ownerId: userId })
    // but we wrap it here for service consistency
    const skill = await skillRepository.update(id, userId, updateData);

    // Invalidate factory cache for all agents using this skill
    const agents = await agentRepository.findAgentsUsingSkill(id, '_id');
    for (const agent of agents) {
      agentFactory.invalidate(agent._id);
    }

    return skill;
  }

  /**
   * Deletes a skill and removes it from all agents
   */
  async deleteSkill(id, userId) {
    // 1. Verify ownership BEFORE performing any side effects
    const skill = await skillRepository.findById(id);
    if (!skill) throw new Error('Skill not found');
    if (skill.ownerId.toString() !== userId.toString()) {
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
    return await skillRepository.delete(id, userId);
  }

  /**
   * Fetches all agents that use a specific skill
   */
  async getAgentsBySkill(id) {
    return await agentRepository.findAgentsUsingSkill(id, 'name slug avatar visibility');
  }
}

export default new SkillService();
