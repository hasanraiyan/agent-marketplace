import memoryService from '../services/memory.service.js';

class MemoryController {
  async getAll(req, res, next) {
    try {
      const data = await memoryService.getAllMemory(req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { agentId, key, value } = req.body;
      if (!agentId || !key || value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'agentId, key, and value are required',
        });
      }
      const entry = await memoryService.createMemory(req.user.id, { agentId, key, value });
      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { agentId, key } = req.params;
      const { value } = req.body;
      if (value === undefined) {
        return res.status(400).json({
          success: false,
          message: 'value is required',
        });
      }
      const entry = await memoryService.updateMemory(req.user.id, agentId, key, { value });
      res.json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const { agentId, key } = req.params;
      await memoryService.deleteMemory(req.user.id, agentId, key);
      res.json({ success: true, message: 'Memory deleted' });
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
