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
 * `discover` (blueprint Phase 9, PR-45) serves listing — a genuinely
 * separate code path per AD-07 §19, mirroring the Agent/Skill Developer
 * discover methods (PR-43/44).
 *
 * `upload`/`search`/`deleteDocument`/`listDocuments` (blueprint Phase 9,
 * PR-47b) round out the Developer Knowledge runtime surface, reusing
 * `knowledgeService`'s document methods generalized alongside this
 * controller change.
 */
class DeveloperKnowledgeController {
  async upload(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded. Please select at least one file.',
        });
      }

      const result = await knowledgeService.uploadFiles(
        req.params.kbId,
        undefined,
        req.files,
        req.projectContext
      );

      res.json({
        success: true,
        data: result,
        message: `${result.files.length} file(s) processed successfully`,
      });
    } catch (error) {
      if (
        error.message === 'Knowledge base not found' ||
        error.message === 'Not authorized to upload to this knowledge base'
      ) {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { query, topK } = req.body;
      const results = await knowledgeService.searchKnowledgeBase(
        req.params.kbId,
        query,
        { topK },
        req.projectContext
      );
      res.json({ success: true, data: results });
    } catch (error) {
      if (
        error.message === 'Knowledge base not found' ||
        error.message === 'Not authorized to access this knowledge base'
      ) {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const sourceName = decodeURIComponent(req.params.sourceName);
      const result = await knowledgeService.deleteDocumentFromKb(
        req.params.kbId,
        undefined,
        sourceName,
        req.projectContext
      );
      res.json({
        success: true,
        data: result,
        message: `Document deleted. ${result.removedChunks} chunk(s) removed.`,
      });
    } catch (error) {
      if (
        error.message === 'Knowledge base not found' ||
        error.message === 'Not authorized to modify this knowledge base'
      ) {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      if (error.message?.startsWith('Document')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  async listDocuments(req, res, next) {
    try {
      const documents = await knowledgeService.listDocumentSources(
        req.params.kbId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: documents });
    } catch (error) {
      if (error.message === 'Knowledge base not found' || error.message === 'Not authorized') {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
      }
      next(error);
    }
  }
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
