import express from 'express';
import twilioController from './twilio.controller.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import authMiddleware from '../auth/auth.middleware.js';
import projectAdminAuthMiddleware from '../auth/projectAdminAuth.middleware.js';
import developerMachineAuthMiddleware, {
  parseProjectCredential,
} from '../auth/developerMachineAuth.middleware.js';

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
 * /api/v1/webhooks/twilio/message:
 *   post:
 *     tags: [Twilio]
 *     summary: Twilio inbound SMS / WhatsApp webhook
 *     description: >
 *       Receives inbound SMS and WhatsApp messages and runs the Project's
 *       Agent on a per-phone conversation thread shared with voice calls.
 *       The request is acknowledged with an empty 200 immediately; the
 *       Agent's reply is sent out-of-band through the Twilio REST API.
 *       The Project's Twilio number must point here with `projectId` and
 *       `agentId` query parameters.
 *     parameters:
 *       - name: projectId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *       - name: agentId
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               From: { type: string }
 *               To: { type: string }
 *               Body: { type: string }
 *               MessageSid: { type: string }
 *               ProfileName: { type: string }
 *               NumMedia: { type: string }
 *     responses:
 *       200:
 *         description: Message accepted (reply is sent asynchronously)
 *       403:
 *         description: Invalid Twilio request signature
 */
router.post(
  '/message',
  express.urlencoded({ extended: false }),
  twilioController.handleInboundMessage
);

/**
 * @openapi
 * /api/v1/webhooks/twilio/message-status:
 *   post:
 *     tags: [Twilio]
 *     summary: Twilio message delivery status callback
 *     description: Receives SMS / WhatsApp delivery status updates.
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
  '/message-status',
  express.urlencoded({ extended: false }),
  twilioController.handleMessageStatusCallback
);

/**
 * @openapi
 * /api/v1/twilio/call:
 *   post:
 *     tags: [Twilio]
 *     summary: Trigger an outbound phone call to a user
 *     description: >
 *       Instructs Twilio to call the specified phone number and connect the
 *       user to the agent upon answering. Requires a Clerk session and
 *       Admin membership in the Project named by `projectId`.
 *     security: [{ clerkAuth: [] }]
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

/**
 * `/call` supports both:
 * 1. Machine callers with a Project credential (`Authorization: Bearer <keyId>.<secret>`
 *    or `x-persona-credential`). Authenticated via `developerMachineAuthMiddleware`.
 * 2. Developer Studio UI callers with a Clerk session. Authenticated via
 *    `authMiddleware` + `projectAdminAuthMiddleware`.
 */
export function outboundCallAuth(req, res, next) {
  const authHeader =
    req.headers.authorization ||
    (req.headers['x-persona-credential']
      ? `Bearer ${req.headers['x-persona-credential']}`
      : undefined);
  const isProjectCredential = parseProjectCredential(authHeader);

  if (isProjectCredential) {
    return developerMachineAuthMiddleware(req, res, next);
  }

  req.params = { ...req.params, projectId: req.body?.projectId || req.query?.projectId };
  authMiddleware(req, res, (err) => {
    if (err) return next(err);
    projectAdminAuthMiddleware(req, res, next);
  });
}

outboundCallRouter.post(
  '/call',
  express.json(),
  rateLimiter('outbound-call', RATE_LIMITS.CHAT),
  twilioController.triggerOutboundCall
);

export default router;
