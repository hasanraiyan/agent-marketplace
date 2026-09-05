import restApiToolSourceService from '../restApiToolSources/restApiToolSource.service.js';
import { bulkDelete } from '../../utils/bulkDelete.js';
import { paginationEnvelope } from '../../utils/pagination.js';

/**
 * Developer Platform RestApiToolSource CRUD + Test Connection — mirrors
 * developerMcp.controller.js's shape. All authorization already lives in
 * `restApiToolSource.service.js`.
 */
class DeveloperRestApiToolSourceController {
  async create(req, res, next) {
    try {
      const source = await restApiToolSourceService.createRestApiToolSource(
        undefined,
        req.body,
        req.projectContext
      );
      res.status(201).json({ success: true, data: restApiToolSourceService.toSafeJson(source) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A REST API tool source with this exact name already exists' });
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
        restApiToolSourceService.discoverRestApiToolSources(req.projectContext, filters, {
          page,
          limit,
        }),
        restApiToolSourceService.countDiscoverRestApiToolSources(req.projectContext, filters),
      ]);
      const safeSources = sources.map((source) => restApiToolSourceService.toSafeJson(source));

      res.json({ success: true, data: paginationEnvelope(safeSources, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const source = await restApiToolSourceService.getRestApiToolSourceById(
        req.params.sourceId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, data: restApiToolSourceService.toSafeJson(source) });
    } catch (error) {
      next(error);
    }
  }

  async getUsage(req, res, next) {
    try {
      const usage = await restApiToolSourceService.getRestApiToolSourceUsage(
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
      const source = await restApiToolSourceService.updateRestApiToolSource(
        req.params.sourceId,
        undefined,
        req.body,
        req.projectContext
      );
      res.json({ success: true, data: restApiToolSourceService.toSafeJson(source) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another REST API tool source with this name already exists' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await restApiToolSourceService.deleteRestApiToolSource(
        req.params.sourceId,
        undefined,
        req.projectContext
      );
      res.json({ success: true, message: 'REST API tool source deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async bulkDelete(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        restApiToolSourceService.deleteRestApiToolSource(id, undefined, req.projectContext)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req, res, next) {
    try {
      const result = await restApiToolSourceService.testConnection(
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

export default new DeveloperRestApiToolSourceController();
