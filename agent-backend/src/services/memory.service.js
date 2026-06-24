import Agent from '../models/Agent.js';
import checkpointService from './checkpoint.service.js';
import userRepository from '../repositories/userRepository.js';
import agentFactory from '../factories/agentFactory.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

class MemoryService {
  /**
   * Aggregates all memory for a user:
   * 1. User profile memory (summary + preferences)
   * 2. Agent-level memories from all agents owned by the user
   */
  async getAllMemory(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    // User profile memory
    const profileMemory = {
      summary: user.profile?.summary || '',
      preferences: {},
    };
    if (user.profile?.preferences instanceof Map) {
      for (const [key, val] of user.profile.preferences.entries()) {
        profileMemory.preferences[key] = val;
      }
    } else if (user.profile?.preferences) {
      Object.assign(profileMemory.preferences, user.profile.preferences);
    }

    // Agent memories — only if MongoDB client is available
    let agentMemories = [];
    if (checkpointService.mongoClient) {
      try {
        // Get all agents owned by user
        const agents = await Agent.find(
          { ownerId: userId, deletedAt: null },
          '_id name'
        );
        const agentIds = agents.map((a) => String(a._id));
        const agentNameMap = {};
        agents.forEach((a) => {
          agentNameMap[String(a._id)] = a.name;
        });

        if (agentIds.length > 0) {
          const db = checkpointService.mongoClient.db();
          const coll = db.collection('agent_memories');

          const docs = await coll
            .find({
              namespace: { $in: agentIds },
            })
            .sort({ updatedAt: -1 })
            .toArray();

          agentMemories = docs.map((d) => {
            const ns = Array.isArray(d.namespace) ? d.namespace[0] : d.namespace;
            return {
              agentId: ns,
              agentName: agentNameMap[ns] || 'Unknown Agent',
              key: d.key,
              value: d.value,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            };
          });
        }
      } catch (err) {
        logger.error('[MemoryService] Failed to fetch agent memories:', err.message);
      }
    }

    return {
      profile: profileMemory,
      agentMemories,
    };
  }

  /**
   * Create a new memory entry for an agent.
   */
  async createMemory(userId, { agentId, key, value }) {
    if (!checkpointService.mongoClient) {
      throw new Error('Database client not available');
    }

    // Verify agent ownership
    const agent = await Agent.findOne({ _id: agentId, ownerId: userId, deletedAt: null });
    if (!agent) {
      throw new Error('Agent not found or not owned by you');
    }

    const db = checkpointService.mongoClient.db();
    const coll = db.collection('agent_memories');

    const now = new Date();
    let parsedValue = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string
    }

    await coll.updateOne(
      { namespace: agentId, key },
      {
        $set: { value: parsedValue, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    logger.info(`[MemoryService] Created memory for agent ${agentId}: ${key}`);
    return { agentId: String(agent._id), agentName: agent.name, key, value: parsedValue };
  }

  /**
   * Update an existing agent memory entry.
   */
  async updateMemory(userId, agentId, key, { value }) {
    if (!checkpointService.mongoClient) {
      throw new Error('Database client not available');
    }

    // Verify agent ownership
    const agent = await Agent.findOne({ _id: agentId, ownerId: userId, deletedAt: null });
    if (!agent) {
      throw new Error('Agent not found or not owned by you');
    }

    const db = checkpointService.mongoClient.db();
    const coll = db.collection('agent_memories');

    let parsedValue = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string
    }

    const result = await coll.updateOne(
      { namespace: agentId, key },
      { $set: { value: parsedValue, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      throw new Error('Memory entry not found');
    }

    logger.info(`[MemoryService] Updated memory for agent ${agentId}: ${key}`);
    return { agentId: String(agent._id), agentName: agent.name, key, value: parsedValue };
  }

  /**
   * Clears ALL memory for the user:
   * 1. User profile summary + preferences
   * 2. All agent memories for all agents owned by the user
   */
  async clearAllMemory(userId) {
    // 1. Clear user profile memory
    await userRepository.update(userId, {
      'profile.summary': '',
      'profile.preferences': {},
    });

    // 2. Delete all agent memories for user's agents
    if (checkpointService.mongoClient) {
      try {
        const agents = await Agent.find(
          { ownerId: userId, deletedAt: null },
          '_id'
        );
        const agentIds = agents.map((a) => String(a._id));

        if (agentIds.length > 0) {
          const db = checkpointService.mongoClient.db();
          const coll = db.collection('agent_memories');
          const result = await coll.deleteMany({
            namespace: { $in: agentIds },
          });
          logger.info(
            `[MemoryService] Cleared ${result.deletedCount} agent memories for user ${userId}`
          );
        }

        // 3. Invalidate all agent caches so they pick up the cleared state
        for (const agent of agents) {
          agentFactory.invalidate(agent._id);
        }
      } catch (err) {
        logger.error('[MemoryService] Failed to clear agent memories:', err.message);
        throw err;
      }
    }

    logger.info(`[MemoryService] Cleared all memory for user ${userId}`);
    return { cleared: true };
  }

  /**
   * Delete an agent memory entry.
   */
  async deleteMemory(userId, agentId, key) {
    if (!checkpointService.mongoClient) {
      throw new Error('Database client not available');
    }

    // Verify agent ownership
    const agent = await Agent.findOne({ _id: agentId, ownerId: userId, deletedAt: null });
    if (!agent) {
      throw new Error('Agent not found or not owned by you');
    }

    const db = checkpointService.mongoClient.db();
    const coll = db.collection('agent_memories');

    const result = await coll.deleteOne({ namespace: agentId, key });
    if (result.deletedCount === 0) {
      throw new Error('Memory entry not found');
    }

    logger.info(`[MemoryService] Deleted memory for agent ${agentId}: ${key}`);
  }
}

export default new MemoryService();
