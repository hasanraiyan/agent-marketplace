import Agent from './agent.model.js';
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

  async findAgentsUsingSkill(skillId, projection = null, limit = null) {
    let query = Agent.find({ skills: skillId });
    if (projection) {
      query = query.select(projection);
    }
    if (limit) {
      query = query.limit(limit);
    }
    return await query;
  }

  async removeSkillFromAgents(skillId) {
    return await Agent.updateMany({ skills: skillId }, { $pull: { skills: skillId } });
  }

  async findAgentsUsingProvider(providerId, projection = null, limit = null) {
    let query = Agent.find({ providerId });
    if (projection) {
      query = query.select(projection);
    }
    if (limit) {
      query = query.limit(limit);
    }
    return await query;
  }

  async deleteManyByOwner(ownerId) {
    return await Agent.deleteMany({ ownerId });
  }

  /**
   * Developer Platform (blueprint Phase 10, PR-53, AD-08 §29): Domain-scoped
   * bulk delete for a Project's async deletion cascade — every Agent in the
   * Domain, regardless of owner type, unlike `deleteManyByOwner` above.
   */
  async deleteManyByDomain(domain) {
    return await Agent.deleteMany({ domain });
  }

  async findAgentsUsingMcp(mcpId, projection = null, limit = null) {
    let query = Agent.find({ mcps: mcpId });
    if (projection) {
      query = query.select(projection);
    }
    if (limit) {
      query = query.limit(limit);
    }
    return await query;
  }

  /**
   * Feature 2 (dependency/usage lookup, gap-fill audit): mirrors the
   * existing findAgentsUsing{Skill,Provider,Mcp} shape exactly — no
   * equivalent existed for Knowledge bases before this (Knowledge base
   * deletion, unlike Provider/Skill/MCP, doesn't currently block on
   * in-use Agents either; this is read-only usage visibility only, not a
   * new delete-time restriction).
   */
  async findAgentsUsingKnowledgeBase(knowledgeBaseId, projection = null, limit = null) {
    let query = Agent.find({ knowledgeBases: knowledgeBaseId });
    if (projection) {
      query = query.select(projection);
    }
    if (limit) {
      query = query.limit(limit);
    }
    return await query;
  }

  async removeMcpFromAgents(mcpId) {
    return await Agent.updateMany({ mcps: mcpId }, { $pull: { mcps: mcpId } });
  }
}

export default new AgentRepository();
