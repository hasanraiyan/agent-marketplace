import express from 'express';
import webhookController from './webhook.controller.js';

const router = express.Router();

// Clerk webhook requires raw body for verification

/**
 * @openapi
 * /api/v1/webhooks/clerk:
 *   post:
 *     tags: [Webhooks]
 *     summary: Clerk user lifecycle webhook handler
 *     description: >
 *       Receives Clerk webhook events for user lifecycle management
 *       (user.created, user.updated, user.deleted).
 *       Verified using Svix signature verification. Uses express.raw()
 *       body parser because the Svix SDK requires the raw body bytes
 *       for signature computation. This route bypasses Clerk middleware
 *       and the global express.json() parser entirely.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [user.created, user.updated, user.deleted]
 *                 description: Clerk webhook event type
 *               data:
 *                 type: object
 *                 description: Clerk user payload containing id, email, name, etc.
 *               object:
 *                 type: string
 *                 description: Event object type (always "event")
 *     responses:
 *       200:
 *         description: Webhook processed successfully — user created, updated, or deleted
 *       400:
 *         description: Invalid webhook signature or malformed payload
 */
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  webhookController.handleClerkWebhook
);

export default router;
