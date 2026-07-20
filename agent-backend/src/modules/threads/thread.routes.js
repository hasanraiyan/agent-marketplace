import express from 'express';
import threadController from './thread.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createThreadSchema, updateThreadTitleSchema } from './thread.validator.js';

const router = express.Router();

// ALL thread endpoints strictly require authentication!
// Chatting is tied to account quotas/ownership in the system.
router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

// Core Thread Management
router.post('/', mutateLimiter, validateBody(createThreadSchema), threadController.create);
router.get('/', threadController.getAllByUser);
router.get('/:id', threadController.getOne);
router.delete('/', mutateLimiter, threadController.deleteAll);
router.delete('/:id', mutateLimiter, threadController.delete);
router.patch(
  '/:id/title',
  mutateLimiter,
  validateBody(updateThreadTitleSchema),
  threadController.updateTitle
);

// Chat & Streaming
router.get('/:id/messages', threadController.getMessages);

export default router;
