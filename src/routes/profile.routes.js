import express from 'express';
import profileController from '../controllers/profile.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { updateProfileSchema, changePasswordSchema } from '../validators/profile.validator.js';

const router = express.Router();

router.get('/', authMiddleware, profileController.getProfile);
router.patch(
  '/',
  authMiddleware,
  validateBody(updateProfileSchema),
  profileController.updateProfile
);
router.post(
  '/change-password',
  authMiddleware,
  validateBody(changePasswordSchema),
  profileController.changePassword
);

export default router;
