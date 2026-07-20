import providerService from './provider.service.js';
import {
  createProviderSchema,
  updateProviderSchema,
  testConnectionSchema,
} from './provider.validator.js';

class ProviderController {
  async getAll(req, res, next) {
    try {
      const providers = await providerService.getUserProviders(req.user.id);
      res.json({
        success: true,
        data: providers,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const validatedData = createProviderSchema.parse(req.body);
      const provider = await providerService.createProvider(req.user.id, validatedData);
      res.status(201).json({
        success: true,
        data: provider,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const validatedData = updateProviderSchema.parse(req.body);
      const provider = await providerService.updateProvider(
        req.user.id,
        req.params.id,
        validatedData
      );
      res.json({
        success: true,
        data: provider,
      });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await providerService.deleteProvider(req.user.id, req.params.id);
      res.json({
        success: true,
        message: 'Provider deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req, res, next) {
    try {
      const result = await providerService.testConnection(req.params.id, req.user.id);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async testCredentials(req, res, next) {
    try {
      const validatedData = testConnectionSchema.parse(req.body);
      const result = await providerService.testConnectionWithCredentials(
        validatedData.baseURL,
        validatedData.apiKey
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getModels(req, res, next) {
    try {
      const models = await providerService.getAvailableModels(req.params.id, req.user.id);
      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new ProviderController();
