import skillRepository from '../repositories/skillRepository.js';

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

    const isOwner = userId && skill.ownerId.toString() === userId.toString();
    if (!skill.isPublic && !isOwner) {
      throw new Error('Skill not found or private');
    }

    return skill;
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
   * Updates an existing skill
   */
  async updateSkill(id, userId, updateData) {
    // Repository already handles ownership check via findOneAndUpdate({ _id: id, ownerId: userId })
    // but we wrap it here for service consistency
    return await skillRepository.update(id, userId, updateData);
  }

  /**
   * Deletes a skill
   */
  async deleteSkill(id, userId) {
    return await skillRepository.delete(id, userId);
  }
}

export default new SkillService();
