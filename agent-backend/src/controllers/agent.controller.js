import agentService from '../services/agent.service.js';
import agentFactory from '../factories/agentFactory.js';
import { createAgentSchema, updateAgentSchema, searchAgentSchema, countAgentSchema } from '../validators/agent.validator.js';

class AgentController {
  async create(req, res, next) {
    try {
      const validatedData = createAgentSchema.parse(req.body);
      const agent = await agentService.createAgent(req.user.id, validatedData);
      
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
      const validatedData = updateAgentSchema.parse(req.body);
      const agent = await agentService.updateAgent(req.params.id, req.user.id, validatedData);
      
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
      const { page, limit, sortBy, ...filters } = searchAgentSchema.parse(req.body);
      const userId = req.user ? req.user.id : null;

      const agents = await agentService.searchAgents(filters, { page, limit, sortBy }, userId);
      
      res.json({
        success: true,
        data: agents,
      });
    } catch (error) {
      if (error.message.includes('Not authorized') || error.message.includes('Can only search marketplace')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async count(req, res, next) {
    try {
      const filters = countAgentSchema.parse(req.body);
      const userId = req.user ? req.user.id : null;

      const total = await agentService.countAgents(filters, userId);
      
      res.json({
        success: true,
        data: { total },
      });
    } catch (error) {
       if (error.message.includes('Not authorized') || error.message.includes('Can only search marketplace')) {
        return res.status(403).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
}

export default new AgentController();
