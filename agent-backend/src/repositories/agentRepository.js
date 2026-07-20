import Agent from '../models/Agent.js';
import { ARCHITECT_AGENT_ID } from '../tools/index.js';

class AgentRepository {
  async create(agentData) {
    const agent = new Agent(agentData);
    return await agent.save();
  }

  async findById(id) {
    if (id?.toString() === ARCHITECT_AGENT_ID) {
      return {
        _id: ARCHITECT_AGENT_ID,
        name: 'Agent Architect',
        description: 'System Builder Agent',
        isVirtual: true,
        updatedAt: new Date(0),
      };
    }
    return await Agent.findById(id);
  }

  async findBySlug(slug) {
    return await Agent.findOne({ slug });
  }

  async findOne(filters) {
    return await Agent.findOne(filters);
  }

  async update(id, updateData) {
    return await Agent.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    // Perform soft-delete instead of hard-delete to avoid orphaning threads
    return await Agent.findByIdAndUpdate(
      id,
      { isActive: false, deletedAt: new Date() },
      { new: true }
    );
  }

  /**
   * Translates the custom sorting enum to a mongoose sort object
   */
  _getSortObject(sortBy) {
    switch (sortBy) {
      case 'oldest':
        return { createdAt: 1 };
      case 'popular':
      case 'popularity':
      case 'rating': // Fallback to popularity until rating field is added
        return { messageCount: -1, createdAt: -1 };
      case 'title_asc':
        return { name: 1 };
      case 'title_desc':
        return { name: -1 };
      case 'relevance':
      case 'newest':
      default:
        return { createdAt: -1 };
    }
  }

  async search(filters, { page = 1, limit = 20, sortBy = 'newest' }) {
    const skip = (page - 1) * limit;
    const sortObj = this._getSortObject(sortBy);

    const agents = await Agent.find(filters).sort(sortObj).skip(skip).limit(limit);

    // Populate provider to verify later if needed, but not necessary yet
    return agents;
  }

  async count(filters) {
    return await Agent.countDocuments(filters);
  }

  async findAgentsUsingSkill(skillId, projection = null) {
    let query = Agent.find({ skills: skillId });
    if (projection) {
      query = query.select(projection);
    }
    return await query;
  }

  async removeSkillFromAgents(skillId) {
    return await Agent.updateMany({ skills: skillId }, { $pull: { skills: skillId } });
  }
}

export default new AgentRepository();
