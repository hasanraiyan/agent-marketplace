import express from 'express';
import agentController from '../controllers/agent.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../middlewares/rateLimiter.middleware.js';
import optionalAuthMiddleware from '../middlewares/optionalAuthMiddleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import {
  createAgentSchema,
  updateAgentSchema,
  searchAgentSchema,
  countAgentSchema,
} from '../validators/agent.validator.js';

const router = express.Router();

// --- Public/Optional Auth Routes ---
// These routes handle their own internal visibility/security checks.
router.post(
  '/search',
  optionalAuthMiddleware,
  validateBody(searchAgentSchema),
  agentController.search
);
router.post(
  '/count',
  optionalAuthMiddleware,
  validateBody(countAgentSchema),
  agentController.count
);
router.get('/slug/:slug', optionalAuthMiddleware, agentController.getBySlug);
router.get('/:id', optionalAuthMiddleware, agentController.getOne);

// --- Protected Routes ---
// These routes strictly require an authenticated user.
router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

router.post('/', mutateLimiter, validateBody(createAgentSchema), agentController.create);
router.patch('/:id', mutateLimiter, validateBody(updateAgentSchema), agentController.update);
router.delete('/:id', mutateLimiter, agentController.remove);

export default router;
