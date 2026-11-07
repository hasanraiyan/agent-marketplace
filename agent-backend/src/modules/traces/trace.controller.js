import traceService from './trace.service.js';
import { paginationEnvelope } from '../../utils/pagination.js';

const MAX_LIMIT = 100;

/**
 * Project Admin trace read endpoints (mounted under
 * /api/v1/projects/{projectId}/traces in project.routes.js, behind
 * projectAdminAuthMiddleware). Read-only; traces are written by
 * agui.service.js via traceService.begin().
 */
class TraceController {
  async list(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || 20));
      const { agentId, threadId, status, source, from, to } = req.query;
      const { items, total } = await traceService.list(
        req.projectAdminContext.domain,
        { agentId, threadId, status, source, from, to },
        { page, limit }
      );
      res.json({ success: true, data: paginationEnvelope(items, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async stats(req, res, next) {
    try {
      const data = await traceService.stats(req.projectAdminContext.domain, {
        agentId: req.query.agentId,
        days: req.query.days,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const data = await traceService.get(req.projectAdminContext.domain, req.params.traceId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new TraceController();
