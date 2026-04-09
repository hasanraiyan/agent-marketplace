import express from 'express';
import chatController from '../controllers/chat.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validationMiddleware.js';
import {
  assistantIdParamSchema,
  conversationIdParamSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  sendMessageSchema,
  listMessagesQuerySchema,
} from '../validators/chat.validator.js';

const router = express.Router({ mergeParams: true });

router.post(
  '/:assistantId/conversations',
  authMiddleware,
  validateParams(assistantIdParamSchema),
  validateBody(createConversationSchema),
  chatController.createConversation
);

router.get(
  '/:assistantId/conversations',
  authMiddleware,
  validateParams(assistantIdParamSchema),
  validateQuery(listConversationsQuerySchema),
  chatController.listConversations
);

router.post(
  '/:assistantId/conversations/:conversationId/messages',
  authMiddleware,
  validateParams(assistantIdParamSchema.merge(conversationIdParamSchema)),
  validateBody(sendMessageSchema),
  chatController.sendMessage
);

router.get(
  '/:assistantId/conversations/:conversationId/messages',
  authMiddleware,
  validateParams(assistantIdParamSchema.merge(conversationIdParamSchema)),
  validateQuery(listMessagesQuerySchema),
  chatController.listMessages
);

export default router;
