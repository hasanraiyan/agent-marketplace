import Agent from '../agents/agent.model.js';
import MemoryFile, { upsertMemoryFile } from './memory-file.model.js';
import checkpointService from '../threads/checkpoint.service.js';
import userRepository from '../users/user.repository.js';
import {
  normalizeMemoryKey,
  userMemoryNamespace,
  agentMemoryNamespace,
  agentWorkspaceNamespace,
} from './memory-files-store.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * File-based memory (dostify-style): memories are markdown virtual files in the
 * `memoryfiles` collection, the same files agents read/write through their
 * /memories/user/ and /memories/agent/ filesystem routes.
 *
 * Namespaces:
 *   ['users', userId]                      → /memories/user/   (all agents)
 *   ['users', userId, 'agents', agentId]   → /memories/agent/  (one agent)
 */
class MemoryService {
  _toFileDto(doc) {
    const isWorkspaceScope = doc.namespace.length === 5 && doc.namespace[4] === 'workspace';
    const isAgentScope = doc.namespace.length === 4;
    return {
      scope: isWorkspaceScope ? 'workspace' : isAgentScope ? 'agent' : 'user',
      agentId: isWorkspaceScope || isAgentScope ? doc.namespace[3] : undefined,
      path: doc.key,
      content: doc.content,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  _namespaceFor(userId, scope, agentId) {
    if (scope === 'workspace') {
      if (!agentId) throw new Error('agentId is required for workspace-scoped files');
      return agentWorkspaceNamespace(userId, agentId);
    }
    if (scope === 'agent') {
      if (!agentId) throw new Error('agentId is required for agent-scoped memory');
      return agentMemoryNamespace(userId, agentId);
    }
    return userMemoryNamespace(userId);
  }

  /**
   * All memory files for a user: user-global files plus per-agent groups
   * (annotated with agent names where the agent still exists).
   */
  async getAllMemory(userId) {
    const docs = await MemoryFile.find({
      'namespace.0': 'users',
      'namespace.1': String(userId),
    }).sort({ namespace: 1, key: 1 });

    const userFiles = [];
    const agentGroups = new Map();
    const workspaceGroups = new Map();

    for (const doc of docs) {
      const dto = this._toFileDto(doc);
      if (dto.scope === 'user') {
        userFiles.push(dto);
      } else if (dto.scope === 'workspace') {
        if (!workspaceGroups.has(dto.agentId)) {
          workspaceGroups.set(dto.agentId, { agentId: dto.agentId, agentName: null, files: [] });
        }
        workspaceGroups.get(dto.agentId).files.push(dto);
      } else {
        if (!agentGroups.has(dto.agentId)) {
          agentGroups.set(dto.agentId, { agentId: dto.agentId, agentName: null, files: [] });
        }
        agentGroups.get(dto.agentId).files.push(dto);
      }
    }

    const allAgentIds = new Set([
      ...Array.from(agentGroups.keys()),
      ...Array.from(workspaceGroups.keys()),
    ]);

    if (allAgentIds.size > 0) {
      const agents = await Agent.find({ _id: { $in: Array.from(allAgentIds) } }, '_id name');
      for (const agent of agents) {
        const idStr = String(agent._id);
        const memGroup = agentGroups.get(idStr);
        if (memGroup) memGroup.agentName = agent.name;
        const wsGroup = workspaceGroups.get(idStr);
        if (wsGroup) wsGroup.agentName = agent.name;
      }
    }

    return {
      userFiles,
      agentMemories: Array.from(agentGroups.values()),
      agentWorkspaces: Array.from(workspaceGroups.values()),
    };
  }

  /** Create or overwrite one memory file. */
  async writeMemoryFile(userId, { scope = 'user', agentId, path, content }) {
    const namespace = this._namespaceFor(userId, scope, agentId);
    const key = normalizeMemoryKey(path);

    const doc = await upsertMemoryFile(
      { namespace, key },
      { $set: { content: String(content ?? ''), mimeType: 'text/markdown' } }
    );

    logger.info(`[MemoryService] Wrote memory file for user ${userId}: ${scope}${key}`);
    return this._toFileDto(doc);
  }

  /** Read one memory file. */
  async getMemoryFile(userId, { scope = 'user', agentId, path }) {
    const namespace = this._namespaceFor(userId, scope, agentId);
    const key = normalizeMemoryKey(path);

    const doc = await MemoryFile.findOne({ namespace, key });
    if (!doc) {
      throw new Error('Memory file not found');
    }

    return this._toFileDto(doc);
  }

  /** Delete one memory file. */
  async deleteMemoryFile(userId, { scope = 'user', agentId, path }) {
    const namespace = this._namespaceFor(userId, scope, agentId);
    const key = normalizeMemoryKey(path);

    const result = await MemoryFile.deleteOne({ namespace, key });
    if (result.deletedCount === 0) {
      throw new Error('Memory file not found');
    }

    logger.info(`[MemoryService] Deleted memory file for user ${userId}: ${scope}${key}`);
  }

  /**
   * Clears ALL memory for the user: every memory file under their namespace,
   * plus legacy KV data (profile preferences + old agent_memories entries)
   * so pre-migration remnants are wiped too.
   */
  async clearAllMemory(userId) {
    const result = await MemoryFile.deleteMany({
      'namespace.0': 'users',
      'namespace.1': String(userId),
    });
    logger.info(`[MemoryService] Cleared ${result.deletedCount} memory files for user ${userId}`);

    // Legacy cleanup: profile KV + old agent_memories collection.
    try {
      await userRepository.update(userId, {
        'profile.summary': '',
        'profile.preferences': {},
      });

      if (checkpointService.mongoClient) {
        const agents = await Agent.find({ ownerId: userId, deletedAt: null }, '_id');
        const agentIds = agents.map((a) => String(a._id));
        if (agentIds.length > 0) {
          const coll = checkpointService.mongoClient.db().collection('agent_memories');
          await coll.deleteMany({ namespace: { $in: agentIds } });
        }
      }
    } catch (err) {
      logger.warn('[MemoryService] Legacy memory cleanup failed:', err.message);
    }

    return { cleared: true };
  }

  /**
   * Clears memory files for one specific agent under the given user/project namespace.
   */
  async deleteAgentMemory(userId, agentId) {
    const namespace = agentMemoryNamespace(userId, agentId);
    const result = await MemoryFile.deleteMany({ namespace });
    logger.info(
      `[MemoryService] Cleared ${result.deletedCount} agent memory files for user ${userId}, agent ${agentId}`
    );
    return { deletedCount: result.deletedCount, cleared: true };
  }
}

export default new MemoryService();
