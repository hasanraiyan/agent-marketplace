import express from 'express';
import threadController from '../controllers/thread.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { createThreadSchema, updateThreadTitleSchema } from '../validators/thread.validator.js';

const router = express.Router();

// ALL thread endpoints strictly require authentication!
// Chatting is tied to account quotas/ownership in the system.
router.use(authMiddleware);

// Core Thread Management
router.post('/', validateBody(createThreadSchema), threadController.create);
router.get('/', threadController.getAllByUser);
router.get('/:id', threadController.getOne);
router.delete('/', threadController.deleteAll);
router.delete('/:id', threadController.delete);
router.patch('/:id/title', validateBody(updateThreadTitleSchema), threadController.updateTitle);

// Chat & Streaming
router.get('/:id/messages', threadController.getMessages);

export default router;
