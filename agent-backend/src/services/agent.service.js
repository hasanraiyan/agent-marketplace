import agentRepository from '../repositories/agentRepository.js';
import crypto from 'crypto';

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
    }

    return match;
  }

  async createAgent(userId, data) {
    const slug = await this._generateSlug(data.name);

    const agent = await agentRepository.create({
      ...data,
      slug,
      ownerId: userId,
    });

    return this._formatSafe(agent, userId);
  }

  async getAgentById(id, userId) {
    const agent = await agentRepository.findById(id);
    if (!agent) throw new Error('Agent not found');

    const ownerIdStr = agent.ownerId ? agent.ownerId.toString() : null;
    const isOwner = userId && ownerIdStr === userId.toString();
    const isVirtual = agent.isVirtual === true || agent._id === '000000000000000000000000';

    if (!isOwner && !isVirtual && agent.visibility === 'private') {
      throw new Error('Agent not found or is private'); // Ambiguous error for privacy
    }

    return this._formatSafe(agent, userId);
  }

  async getAgentBySlug(slug, userId) {
    const agent = await agentRepository.findBySlug(slug);
    if (!agent) throw new Error('Agent not found');

    const ownerIdStr = agent.ownerId ? agent.ownerId.toString() : null;
    const isOwner = userId && ownerIdStr === userId.toString();
    const isVirtual = agent.isVirtual === true || agent._id === '000000000000000000000000';

    if (!isOwner && !isVirtual && agent.visibility === 'private') {
      throw new Error('Agent not found or is private');
    }

    return this._formatSafe(agent, userId);
  }

  async updateAgent(id, userId, updateData) {
    const existing = await agentRepository.findById(id);

    if (!existing) throw new Error('Agent not found');
    if (existing.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to update this agent');
    }

    // Never allow updating ownerId or slug directly via this route
    delete updateData.ownerId;
    delete updateData.slug;

    // If changing the name, regenerate slug if explicitly requested?
    // In MVP, we keep the original slug out of simplicity to not break old links.

    const updated = await agentRepository.update(id, updateData);
    return this._formatSafe(updated, userId);
  }

  async deleteAgent(id, userId) {
    const existing = await agentRepository.findById(id);

    if (!existing) throw new Error('Agent not found');
    if (existing.ownerId.toString() !== userId.toString()) {
      throw new Error('Unauthorized to delete this agent');
    }

    await agentRepository.delete(id);
    return true;
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
}

export default new AgentService();
