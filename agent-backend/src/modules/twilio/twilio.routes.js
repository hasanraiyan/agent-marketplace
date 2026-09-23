import express from 'express';
import twilioController from './twilio.controller.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/v1/webhooks/twilio/voice:
 *   post:
 *     tags: [Twilio]
 *     summary: Twilio Voice webhook handler
 *     description: >
 *       Receives incoming voice webhook calls from Twilio (for both inbound and
 *       outbound calls) and returns TwiML with <Connect><Stream> to establish
 *       a real-time bidirectional audio stream to the Gemini voice session.
 *     parameters:
 *       - name: projectId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *       - name: agentId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               CallSid: { type: string }
 *               From: { type: string }
 *               To: { type: string }
 *     responses:
 *       200:
 *         description: TwiML XML response connecting to the Media Stream
 *         content:
 *           text/xml:
 *             schema: { type: string }
 *       403:
 *         description: Invalid Twilio request signature
 */
router.post('/voice', express.urlencoded({ extended: false }), twilioController.handleVoiceWebhook);

/**
 * @openapi
 * /api/v1/webhooks/twilio/status:
 *   post:
 *     tags: [Twilio]
 *     summary: Twilio call status callback
 *     description: Receives call lifecycle updates (initiated, ringing, answered, completed).
 *     requestBody:
 *       required: false
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *     responses:
 *       204:
 *         description: Status acknowledged
 */
router.post(
  '/status',
  express.urlencoded({ extended: false }),
  twilioController.handleStatusCallback
);

/**
 * @openapi
 * /api/v1/twilio/call:
 *   post:
 *     tags: [Twilio]
 *     summary: Trigger an outbound phone call to a user
 *     description: Instructs Twilio to call the specified phone number and connect the user to the agent upon answering.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, projectId, agentId]
 *             properties:
 *               to:
 *                 type: string
 *                 description: Recipient phone number in E.164 format (e.g. +91XXXXXXXXXX)
 *               projectId:
 *                 type: string
 *               agentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Call initiated successfully
 *       400:
 *         description: Missing required fields
 *       503:
 *         description: Twilio service not configured
 */
export const outboundCallRouter = express.Router();
outboundCallRouter.post(
  '/call',
  express.json(),
  rateLimiter('outbound-call', RATE_LIMITS.CHAT),
  twilioController.triggerOutboundCall
);

export default router;
