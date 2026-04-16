import skillRepository from '../repositories/skillRepository.js';
import NotFoundError from '../utils/errors/NotFoundError.js';

class SkillController {
  async create(req, res, next) {
    try {
      const skillData = {
        ...req.body,
        ownerId: req.user.id
      };
      
      const skill = await skillRepository.create(skillData);
      res.status(201).json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'You already have a skill with this exact name' });
      }
      next(error);
    }
  }

  async getMySkills(req, res, next) {
    try {
      const skills = await skillRepository.findByOwner(req.user.id);
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

      const result = await skillRepository.findPublicSkills(query, skip, limit);
      res.json({ success: true, data: result.skills, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const skill = await skillRepository.findById(req.params.id);
      
      if (!skill) {
        throw new NotFoundError('Skill not found');
      }

      // Hide private skills if not owner
      if (!skill.isPublic && skill.ownerId.toString() !== req.user.id) {
        throw new NotFoundError('Skill not found or private');
      }

      res.json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const skill = await skillRepository.update(req.params.id, req.user.id, req.body);
      res.json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
          return res.status(409).json({ success: false, message: 'Another skill with this name already exists' });
      }
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await skillRepository.delete(req.params.id, req.user.id);
      
      // Note: Agents that have this skill ID in their `skills` array will just ignore it.
      // LangGraph won't crash if the Mongoose reference fails to populate, it just returns null.
      
      res.json({ success: true, message: 'Skill successfully deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export default new SkillController();
