import express from 'express';
import assistantController from '../controllers/assistant.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validationMiddleware.js';
import chatRouter from './chat.routes.js';
import {
  createAssistantSchema,
  updateAssistantSchema,
  assistantIdParamSchema,
  listMyAssistantsQuerySchema,
  listPublicAssistantsQuerySchema,
} from '../validators/assistant.validator.js';

const router = express.Router();

// Owner-scoped assistants
router.get(
  '/me',
  authMiddleware,
  validateQuery(listMyAssistantsQuerySchema),
  assistantController.getMyAssistants
);

// Public assistants listing
router.get(
  '/',
  validateQuery(listPublicAssistantsQuerySchema),
  assistantController.listPublicAssistants
);

router.post(
  '/',
  authMiddleware,
  validateBody(createAssistantSchema),
  assistantController.createAssistant
);

router.patch(
  '/:id',
  authMiddleware,
  validateParams(assistantIdParamSchema),
  validateBody(updateAssistantSchema),
  assistantController.updateAssistant
);

// Public/owner read
router.get(
  '/:id',
  validateParams(assistantIdParamSchema),
  assistantController.getAssistantById
);

// Nested chat routes: /api/v1/assistants/:assistantId/conversations...
router.use('/', chatRouter);

export default router;
