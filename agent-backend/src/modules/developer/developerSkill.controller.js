import skillService from '../skills/skill.service.js';

/**
 * Developer Platform Skill CRUD (blueprint Phase 9, PR-29, AD-07 §18 —
 * "Skills follow the identical shape as Agents"). Same design as
 * developerAgent.controller.js: one route set serves both Project-owned
 * and ExternalUser-owned Skills, determined per-request by
 * `req.projectContext.principalType`. All authorization already lives in
 * `skillService` (PR-28's `isResourceOwner`/`ownerFilterForContext`
 * generalization) — this controller does none of its own.
 *
 * Unlike Agent, Skill's `getSkillById` has no separate "strip secrets for
 * non-owners" concept (a Skill is either fully visible — public or
 * owned — or not visible at all), so this reuses it directly rather than
 * needing a `getDeveloperSkillById` counterpart.
 *
 * `discover` (blueprint Phase 9, PR-44) serves listing — a genuinely
 * separate code path from Persona's marketplace search, per AD-07 §19,
 * mirroring `developerAgentController.discover`'s (PR-43) three modes.
 */
class DeveloperSkillController {
  async discover(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search, scope: req.query.scope };

      const skills = await skillService.discoverSkills(req.projectContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: skills });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const skill = await skillService.createSkill(undefined, req.body, req.projectContext);
      res.status(201).json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A Skill with this exact name already exists' });
      }
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const skill = await skillService.getSkillById(
        req.params.skillId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: skill });
    } catch (error) {
      // Existence-hiding (AD-07 §29): same 404 whether the Skill doesn't
      // exist or is private to someone else.
      if (error.message === 'Skill not found or private') {
        return res.status(404).json({ success: false, message: 'Skill not found' });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const skill = await skillService.updateSkill(
        req.params.skillId,
        undefined,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: skill });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another Skill with this name already exists' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await skillService.deleteSkill(req.params.skillId, undefined, req.projectContext);
      res.json({ success: true, message: 'Skill deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperSkillController();
