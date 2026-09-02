import projectSecretService from '../projects/projectSecret.service.js';
import { bulkDelete } from '../../utils/bulkDelete.js';

/**
 * Developer Platform ProjectSecret CRUD — mirrors developerMcp.controller.js:
 * thin pass-through to the service using `req.projectContext`. All
 * authorization/ownership already lives in `projectSecret.service.js`.
 */
class DeveloperSecretController {
  async create(req, res, next) {
    try {
      const secret = await projectSecretService.createSecret(req.projectContext, req.body);
      res.status(201).json({ success: true, data: secret });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'A secret with this exact label already exists' });
      }
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const secrets = await projectSecretService.listSecrets(req.projectContext);
      res.json({ success: true, data: secrets });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const secret = await projectSecretService.getSecretById(
        req.projectContext,
        req.params.secretId
      );
      res.json({ success: true, data: projectSecretService.toSafeJson(secret) });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const secret = await projectSecretService.updateSecret(
        req.projectContext,
        req.params.secretId,
        req.body
      );
      res.json({ success: true, data: secret });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ success: false, message: 'Another secret with this label already exists' });
      }
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await projectSecretService.deleteSecret(req.projectContext, req.params.secretId);
      res.json({ success: true, message: 'Secret deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getUsage(req, res, next) {
    try {
      const usage = await projectSecretService.getSecretUsage(
        req.projectContext,
        req.params.secretId
      );
      res.json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  }

  async bulkDelete(req, res, next) {
    try {
      const result = await bulkDelete(req.body.ids, (id) =>
        projectSecretService.deleteSecret(req.projectContext, id)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new DeveloperSecretController();
