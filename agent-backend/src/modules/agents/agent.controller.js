import agentService from './agent.service.js';
import agentFactory from './agent.factory.js';
import MemoryFile from '../memory/memory-file.model.js';
import { normalizeMemoryKey, agentMemoryNamespace } from '../memory/memory-files-store.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

class AgentController {
  async create(req, res, next) {
    try {
      const agent = await agentService.createAgent(req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: agent,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      // Optional auth: req.user might be undefined if route is public
      const userId = req.user ? req.user.id : null;
      logger.debug(`[AgentController] getOne: userId=${userId}, req.user=${!!req.user}`);
      const agent = await agentService.getAgentById(req.params.id, userId);

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      // If privacy error, send 404 to avoid leaking existence
      if (error.message === 'Agent not found or is private') {
        return res.status(404).json({ success: false, message: 'Agent not found' });
      }
      next(error);
    }
  }

  async getBySlug(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      logger.debug(`[AgentController] getBySlug: userId=${userId}, req.user=${!!req.user}`);
      const agent = await agentService.getAgentBySlug(req.params.slug, userId);

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      if (error.message === 'Agent not found or is private') {
        return res.status(404).json({ success: false, message: 'Agent not found' });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const agent = await agentService.updateAgent(req.params.id, req.user.id, req.body);

      // Clear factory cache so new config picked up immediately
      agentFactory.invalidate(req.params.id);

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await agentService.deleteAgent(req.params.id, req.user.id);

      // Clean up cache
      agentFactory.invalidate(req.params.id);

      res.json({
        success: true,
        message: 'Agent deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { page, limit, sortBy, ...filters } = req.body;
      const userId = req.user ? req.user.id : null;

      const agents = await agentService.searchAgents(filters, { page, limit, sortBy }, userId);

      res.json({
        success: true,
        data: agents,
      });
    } catch (error) {
      if (
        error.message.includes('Not authorized') ||
        error.message.includes('Can only search marketplace')
      ) {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async count(req, res, next) {
    try {
      const filters = req.body;
      const userId = req.user ? req.user.id : null;

      const total = await agentService.countAgents(filters, userId);

      res.json({
        success: true,
        data: { total },
      });
    } catch (error) {
      if (
        error.message.includes('Not authorized') ||
        error.message.includes('Can only search marketplace')
      ) {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // Memory is file-based: these endpoints serve the requesting user's memory
  // files for this agent (namespace ['users', userId, 'agents', agentId]) —
  // the same files the agent reads/writes via its /memories/agent/ route.
  async getMemory(req, res, next) {
    try {
      const agentId = req.params.id;

      // Verify agent visibility for the requesting user.
      await agentService.getAgentById(agentId, req.user.id);

      const docs = await MemoryFile.find({
        namespace: agentMemoryNamespace(req.user.id, agentId),
      }).sort({ key: 1 });

      res.json({
        success: true,
        data: docs.map((d) => ({
          path: d.key,
          content: d.content,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMemory(req, res, next) {
    try {
      const agentId = req.params.id;
      // The path arrives URL-encoded (it contains slashes), e.g. %2Flearnings.md
      const path = normalizeMemoryKey(req.params.key);

      await agentService.getAgentById(agentId, req.user.id);

      const result = await MemoryFile.deleteOne({
        namespace: agentMemoryNamespace(req.user.id, agentId),
        key: path,
      });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Memory file not found' });
      }

      res.json({
        success: true,
        message: 'Agent memory deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AgentController();
