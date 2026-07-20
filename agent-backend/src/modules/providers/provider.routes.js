import express from 'express';
import providerController from './provider.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../../middlewares/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createProviderSchema,
  updateProviderSchema,
  testConnectionSchema,
} from './provider.validator.js';

const router = express.Router();

// All provider routes require authentication
router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

router.get('/', providerController.getAll);

router.post('/', mutateLimiter, validateBody(createProviderSchema), providerController.create);

router.post(
  '/test-connection',
  mutateLimiter,
  validateBody(testConnectionSchema),
  providerController.testCredentials
);

router.post('/:id/test', mutateLimiter, providerController.testConnection);

router.get('/:id/models', providerController.getModels);

router.put('/:id', mutateLimiter, validateBody(updateProviderSchema), providerController.update);

router.delete('/:id', mutateLimiter, providerController.remove);

export default router;
