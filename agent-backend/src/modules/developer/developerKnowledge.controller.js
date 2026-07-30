import knowledgeService from '../knowledge/knowledge.service.js';

/**
 * Developer Platform Knowledge CRUD (blueprint Phase 9, PR-32, AD-07 §18
 * — "Knowledge follows the identical shape as Agents"). Same design as
 * developerAgent.controller.js / developerSkill.controller.js: one route
 * set serves both Project-owned and ExternalUser-owned Knowledge Bases,
 * determined per-request by `req.projectContext.principalType`. All
 * authorization already lives in `knowledgeService` (PR-31's
 * `isResourceOwner` generalization) — this controller does none of its
 * own.
 *
 * `providerId` is required in the request body for every Developer-API
 * creation call — `knowledgeService.createKnowledgeBase` already enforces
 * this (no "my default provider" concept exists for a Project/
 * ExternalUser context), surfaced here as a plain validation-shaped error.
 *
 * Document upload/search/delete-document/list-sources are deliberately
 * NOT included in this first version — those are Knowledge-specific
 * runtime operations (file handling, Qdrant interaction) that deserve
 * their own scoped follow-up, not bundled into a CRUD pass.
 *
 * `discover` (blueprint Phase 9, PR-45) serves listing — a genuinely
 * separate code path per AD-07 §19, mirroring the Agent/Skill Developer
 * discover methods (PR-43/44).
 */
class DeveloperKnowledgeController {
  async discover(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search, scope: req.query.scope };

      const kbs = await knowledgeService.discoverKnowledgeBases(req.projectContext, filters, {
        page,
        limit,
      });

      res.json({ success: true, data: kbs });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const kb = await knowledgeService.createKnowledgeBase(
        undefined,
        req.body,
        req.projectContext
      );
      res.status(201).json({ success: true, data: kb });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const kb = await knowledgeService.getKnowledgeBase(
        req.params.kbId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: kb });
    } catch (error) {
      // Existence-hiding (AD-07 §29): same 404 whether the KB doesn't
      // exist or is private to someone else.
      if (error.message === 'Not authorized to access this knowledge base') {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      if (error.message === 'Knowledge base not found') {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const kb = await knowledgeService.updateKnowledgeBase(
        req.params.kbId,
        undefined,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: kb });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await knowledgeService.deleteKnowledgeBase(req.params.kbId, undefined, req.projectContext);
      res.json({ success: true, message: 'Knowledge base deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperKnowledgeController();
