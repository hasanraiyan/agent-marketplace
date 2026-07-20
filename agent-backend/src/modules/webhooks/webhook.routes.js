import express from 'express';
import webhookController from './webhook.controller.js';

const router = express.Router();

// Clerk webhook requires raw body for verification
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  webhookController.handleClerkWebhook
);

export default router;
