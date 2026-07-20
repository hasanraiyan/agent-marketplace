import memoryService from './memory.service.js';

class MemoryController {
  async getAll(req, res, next) {
    try {
      const data = await memoryService.getAllMemory(req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async writeFile(req, res, next) {
    try {
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
      const file = await memoryService.writeMemoryFile(req.user.id, {
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
      const { scope, agentId, path } = req.query;
      if (!path) {
        return res.status(400).json({
          success: false,
          message: 'path query parameter is required',
        });
      }
      await memoryService.deleteMemoryFile(req.user.id, { scope, agentId, path });
      res.json({ success: true, message: 'Memory file deleted' });
    } catch (error) {
      next(error);
    }
  }

  async clearAll(req, res, next) {
    try {
      await memoryService.clearAllMemory(req.user.id);
      res.json({ success: true, message: 'All memory cleared successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new MemoryController();
