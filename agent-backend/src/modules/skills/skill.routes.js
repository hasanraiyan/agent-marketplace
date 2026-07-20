import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createSkillSchema, updateSkillSchema } from './skill.validator.js';
import skillController from './skill.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

// Search skills
router.get('/search', authMiddleware, skillController.search);

// Publicly searchable skills
router.get('/public', authMiddleware, skillController.getPublicSkills);

// User's own skills
router.get('/', authMiddleware, skillController.getMySkills);

// CRUD
router.post(
  '/',
  authMiddleware,
  mutateLimiter,
  validateBody(createSkillSchema),
  skillController.create
);
router.get('/:id', authMiddleware, skillController.getById);
router.get('/:id/agents', authMiddleware, skillController.getUsedByAgents);
router.patch(
  '/:id',
  authMiddleware,
  mutateLimiter,
  validateBody(updateSkillSchema),
  skillController.update
);
router.delete('/:id', authMiddleware, mutateLimiter, skillController.delete);

export default router;
