import restApiToolService from '../restApiTools/restApiTool.service.js';
import { bulkDelete } from '../../utils/bulkDelete.js';
import { paginationEnvelope } from '../../utils/pagination.js';

/**
 * Developer Platform RestApiTool CRUD + test-call — mirrors
 * developerMcp.controller.js's shape exactly. All authorization already
 * lives in `restApiTool.service.js`.
 */
class DeveloperRestToolController {
  async create(req, res, next) {
    try {
      const tool = await restApiToolService.createRestApiTool(undefined, req.body, req.projectContext);
      res.status(201).json({ success: true, data: restApiToolService.toSafeJson(tool) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A REST API tool with this exact name already exists' });
      }
      next(error);
    }
  }

  async discover(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search, scope: req.query.scope };

      const [tools, total] = await Promise.all([
        restApiToolService.discoverRestApiTools(req.projectContext, filters, { page, limit }),
        restApiToolService.countDiscoverRestApiTools(req.projectContext, filters),
      ]);
      const safeTools = tools.map((tool) => restApiToolService.toSafeJson(tool));

      res.json({ success: true, data: paginationEnvelope(safeTools, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const tool = await restApiToolService.getRestApiToolById(
        req.params.toolId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: restApiToolService.toSafeJson(tool) });
    } catch (error) {
      next(error);
    }
  }

  async getUsage(req, res, next) {
    try {
      const usage = await restApiToolService.getRestApiToolUsage(
        req.params.toolId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const tool = await restApiToolService.updateRestApiTool(
        req.params.toolId,
        undefined,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: restApiToolService.toSafeJson(tool) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another REST API tool with this name already exists' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await restApiToolService.deleteRestApiTool(req.params.toolId, undefined, req.projectContext);
      res.json({ success: true, message: 'REST API tool deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async bulkDelete(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        restApiToolService.deleteRestApiTool(id, undefined, req.projectContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Backs the builder's "Send" button. Accepts either a saved `toolId`
   * (path param or body) or an unsaved `draft` in the body — never reachable
   * from the agent tool-calling path, requires the same auth as editing.
   */
  async test(req, res, next) {
    try {
      const toolId = req.params.toolId || req.body.toolId || null;
      let toolDraft = req.body.draft;

      if (!toolDraft && toolId) {
        toolDraft = await restApiToolService.getRestApiToolById(
          toolId,
          undefined,
          req.projectContext
        );
      }
      if (!toolDraft) {
        return res
          .status(400)
          .json({ success: false, message: 'Either toolId or draft is required' });
      }

      const result = await restApiToolService.testCall(
        req.projectContext,
        toolDraft,
        req.body.testValues || {},
        toolId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperRestToolController();
