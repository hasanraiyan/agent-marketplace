import express from 'express';
import profileController from '../controllers/profile.controller.js';
import authMiddleware from '../modules/auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../middlewares/rateLimiter.middleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { updateProfileSchema } from '../validators/profile.validator.js';

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
