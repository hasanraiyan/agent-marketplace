import express from 'express';
import profileController from './profile.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { updateProfileSchema } from './profile.validator.js';

const router = express.Router();

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

router.get('/', authMiddleware, profileController.getProfile);
router.patch(
  '/',
  authMiddleware,
  validateBody(updateProfileSchema),
  profileController.updateProfile
);

router.delete('/', authMiddleware, mutateLimiter, profileController.deleteProfile);

export default router;
