import storeService, { EXTERNAL_USER_REQUIRED_MESSAGE } from '../stores/store.service.js';
import { paginationEnvelope } from '../../utils/pagination.js';

/**
 * Shared 400/404 shaping for the file-CRUD handlers below. Returns true if
 * it handled the response. A standalone function, not a class method — the
 * handlers are registered as bare `router.get('/x', controller.method)`
 * references, so `this` is not the controller instance when Express
 * invokes them; a `this.`-dependent helper would break at request time.
 */
function mapFileError(error, res) {
  if (error.message === 'Store not found' || error.message === 'Store file not found') {
    res.status(404).json({ success: false, message: error.message });
    return true;
  }
  if (error.message === EXTERNAL_USER_REQUIRED_MESSAGE) {
    res.status(400).json({ success: false, message: error.message, code: 'EXTERNAL_USER_REQUIRED' });
    return true;
  }
  return false;
}

/**
 * Developer Platform Store CRUD. Config CRUD works with a bare Project
 * credential — a Store's config isn't per-founder. File CRUD is the same,
 * *except* when the resolved store's own `scope` is `'externalUser'`: only
 * then is `x-persona-external-user-id` actually required, so that guard
 * lives here (per-request, after loading the store) rather than as a
 * static router-level rule like developerMemory.routes.js's.
 */
class DeveloperStoreController {
  async create(req, res, next) {
    try {
      const store = await storeService.createStore(req.projectContext.domain, req.body);
      res.status(201).json({ success: true, data: store });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A Store with this exact name already exists' });
      }
      next(error);
    }
  }

  async discover(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = { search: req.query.search };

      const [stores, total] = await Promise.all([
        storeService.listStores(req.projectContext.domain, filters, { page, limit }),
        storeService.countStores(req.projectContext.domain, filters),
      ]);

      res.json({ success: true, data: paginationEnvelope(stores, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const store = await storeService.getStoreById(req.projectContext.domain, req.params.storeId);
      res.json({ success: true, data: store });
    } catch (error) {
      if (error.message === 'Store not found') {
        return res.status(404).json({ success: false, message: 'Store not found' });
      }
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const store = await storeService.updateStore(
        req.projectContext.domain,
        req.params.storeId,
        req.body
      );
      res.json({ success: true, data: store });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another Store with this name already exists' });
      }
      if (error.message === 'Store not found') {
        return res.status(404).json({ success: false, message: 'Store not found' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await storeService.deleteStore(req.projectContext.domain, req.params.storeId);
      res.json({ success: true, message: 'Store deleted successfully' });
    } catch (error) {
      if (error.message === 'Store not found') {
        return res.status(404).json({ success: false, message: 'Store not found' });
      }
      next(error);
    }
  }

  async listFiles(req, res, next) {
    try {
      const files = await storeService.listStoreFiles(
        req.projectContext.domain,
        req.params.storeId,
        req.projectContext.externalUserId
      );
      res.json({ success: true, data: { files } });
    } catch (error) {
      if (mapFileError(error, res)) return;
      next(error);
    }
  }

  async getFile(req, res, next) {
    try {
      const { path } = req.query;
      if (!path) {
        return res.status(400).json({ success: false, message: 'path query parameter is required' });
      }
      const file = await storeService.getStoreFile(
        req.projectContext.domain,
        req.params.storeId,
        req.projectContext.externalUserId,
        path
      );
      res.json({ success: true, data: file });
    } catch (error) {
      if (mapFileError(error, res)) return;
      next(error);
    }
  }

  async writeFile(req, res, next) {
    try {
      const { path, content } = req.body;
      if (!path || content === undefined) {
        return res.status(400).json({ success: false, message: 'path and content are required' });
      }
      const file = await storeService.writeStoreFile(
        req.projectContext.domain,
        req.params.storeId,
        req.projectContext.externalUserId,
        { path, content }
      );
      res.status(201).json({ success: true, data: file });
    } catch (error) {
      if (mapFileError(error, res)) return;
      next(error);
    }
  }

  async removeFile(req, res, next) {
    try {
      const { path } = req.query;
      if (!path) {
        return res.status(400).json({ success: false, message: 'path query parameter is required' });
      }
      await storeService.deleteStoreFile(
        req.projectContext.domain,
        req.params.storeId,
        req.projectContext.externalUserId,
        path
      );
      res.status(204).send();
    } catch (error) {
      if (mapFileError(error, res)) return;
      next(error);
    }
  }
}

export default new DeveloperStoreController();
