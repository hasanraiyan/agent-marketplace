import memoryService from '../memory/memory.service.js';
import { buildIdentityKey } from '../agents/identityKey.js';

/**
 * Developer Platform memory API (REQ-3). Reuses memory.service.js unchanged
 * — the only thing that differs from the Clerk-authenticated /api/v1/memory
 * routes is which value is passed as `userId`: a ProjectRuntime caller must
 * use the composed identityKey (`${domain}:${externalUserId}`), never the
 * bare externalUserId, or this reads/writes a different namespace than the
 * one a live agent run for the same external user actually uses. See
 * identityKey.js for the full rationale.
 */
class DeveloperMemoryController {
  async list(req, res, next) {
    try {
      const identityKey = buildIdentityKey(req.projectContext, req.projectContext.externalUserId);
      const data = await memoryService.getAllMemory(identityKey);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getFile(req, res, next) {
    try {
      const identityKey = buildIdentityKey(req.projectContext, req.projectContext.externalUserId);
      const { scope, path } = req.query;
      const agentId = req.headers['x-agent-id'] || req.query.agentId;
      if (!path) {
        return res.status(400).json({
          success: false,
          message: 'path query parameter is required',
        });
      }
      const file = await memoryService.getMemoryFile(identityKey, { scope, agentId, path });
      res.json({ success: true, data: file });
    } catch (error) {
      if (error.message === 'Memory file not found') {
        return res.status(404).json({ success: false, message: 'Memory file not found' });
      }
      next(error);
    }
  }

  async writeFile(req, res, next) {
    try {
      const identityKey = buildIdentityKey(req.projectContext, req.projectContext.externalUserId);
      const { scope, agentId, path, content } = req.body;
      if (!path || content === undefined) {
        return res.status(400).json({
          success: false,
          message: 'path and content are required',
        });
      }
      if (scope === 'agent' && !agentId) {
        return res.status(400).json({
          success: false,
          message: 'agentId is required when scope is "agent"',
        });
      }
      const file = await memoryService.writeMemoryFile(identityKey, {
        scope,
        agentId,
        path,
        content,
      });
      res.status(201).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  async removeFile(req, res, next) {
    try {
      const identityKey = buildIdentityKey(req.projectContext, req.projectContext.externalUserId);
      const { scope, path } = req.query;
      const agentId = req.headers['x-agent-id'] || req.query.agentId;
      if (!path) {
        return res.status(400).json({
          success: false,
          message: 'path query parameter is required',
        });
      }
      await memoryService.deleteMemoryFile(identityKey, { scope, agentId, path });
      res.status(204).send();
    } catch (error) {
      if (error.message === 'Memory file not found') {
        return res.status(404).json({ success: false, message: 'Memory file not found' });
      }
      next(error);
    }
  }
}

export default new DeveloperMemoryController();
