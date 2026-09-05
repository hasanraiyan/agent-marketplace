import rcpSourceService from '../rcpSources/rcpSource.service.js';
import { bulkDelete } from '../../utils/bulkDelete.js';
import { paginationEnvelope } from '../../utils/pagination.js';

/**
 * Developer Platform RcpSource CRUD + Test Connection — mirrors
 * developerRestApiToolSource.controller.js's shape, independent of it. All
 * authorization already lives in `rcpSource.service.js`.
 */
class DeveloperRcpSourceController {
  async create(req, res, next) {
    try {
      const source = await rcpSourceService.createRcpSource(undefined, req.body, req.projectContext);
      res.status(201).json({ success: true, data: rcpSourceService.toSafeJson(source) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'An RCP source with this exact name already exists' });
      }
      next(error);
    }
  }

  async discover(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const [sources, total] = await Promise.all([
        rcpSourceService.discoverRcpSources(req.projectContext, filters, { page, limit }),
        rcpSourceService.countDiscoverRcpSources(req.projectContext, filters),
      ]);
      const safeSources = sources.map((source) => rcpSourceService.toSafeJson(source));

      res.json({ success: true, data: paginationEnvelope(safeSources, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const source = await rcpSourceService.getRcpSourceById(
        req.params.sourceId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: rcpSourceService.toSafeJson(source) });
    } catch (error) {
      next(error);
    }
  }

  async getUsage(req, res, next) {
    try {
      const usage = await rcpSourceService.getRcpSourceUsage(
        req.params.sourceId,
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
      const source = await rcpSourceService.updateRcpSource(
        req.params.sourceId,
        undefined,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: rcpSourceService.toSafeJson(source) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another RCP source with this name already exists' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await rcpSourceService.deleteRcpSource(req.params.sourceId, undefined, req.projectContext);
      res.json({ success: true, message: 'RCP source deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async bulkDelete(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        rcpSourceService.deleteRcpSource(id, undefined, req.projectContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req, res, next) {
    try {
      const result = await rcpSourceService.testConnection(
        req.params.sourceId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperRcpSourceController();
