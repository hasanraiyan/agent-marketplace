import express from 'express';
import providerController from '../controllers/provider.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import {
  createProviderSchema,
  updateProviderSchema,
  testConnectionSchema,
} from '../validators/provider.validator.js';

const router = express.Router();

// All provider routes require authentication
router.use(authMiddleware);

router.get('/', providerController.getAll);

router.post('/', validateBody(createProviderSchema), providerController.create);

router.post(
  '/test-connection',
  validateBody(testConnectionSchema),
  providerController.testCredentials
);

router.post('/:id/test', providerController.testConnection);

router.get('/:id/models', providerController.getModels);

router.put('/:id', validateBody(updateProviderSchema), providerController.update);

router.delete('/:id', providerController.remove);

export default router;
