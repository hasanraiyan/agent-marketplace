import skillService from '../services/skill.service.js';
import NotFoundError from '../utils/errors/NotFoundError.js';

class SkillController {
  async create(req, res, next) {
    try {
      const skillData = {
        ...req.body,
        ownerId: req.user.id,
      };

      const skill = await skillService.createSkill(req.user.id, req.body);
      res.status(201).json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'You already have a skill with this exact name' });
      }
      next(error);
    }
  }

  async getMySkills(req, res, next) {
    try {
      const skills = await skillService.getMySkills(req.user.id);
      res.json({ success: true, data: skills });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { q, scope, limit } = req.query;
      const skills = await skillService.searchSkills(req.user.id, {
        q,
        scope,
        limit: limit ? parseInt(limit) : 30,
      });
      res.json({ success: true, data: skills });
    } catch (error) {
      next(error);
    }
  }

  async getPublicSkills(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const query = {};
      if (req.query.search) {
        query.name = req.query.search;
      }

      const result = await skillService.searchPublicSkills(query, page, limit);
      res.json({ success: true, data: result.skills, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const skill = await skillService.getSkillById(req.params.id, req.user.id);
      res.json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const skill = await skillService.updateSkill(req.params.id, req.user.id, req.body);
      res.json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another skill with this name already exists' });
      }
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await skillService.deleteSkill(req.params.id, req.user.id);

      res.json({ success: true, message: 'Skill successfully deleted' });
    } catch (error) {
      next(error);
    }
  }

  async getUsedByAgents(req, res, next) {
    try {
      // Basic visibility check: only owner can see which of their agents use a skill
      // (or if the skill is public, but for now we focus on the owner's dashboard)
      const skill = await skillService.getSkillById(req.params.id, req.user.id);
      if (!skill) throw new NotFoundError('Skill not found');

      const agents = await skillService.getAgentsBySkill(req.params.id);
      res.json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  }
}

export default new SkillController();
