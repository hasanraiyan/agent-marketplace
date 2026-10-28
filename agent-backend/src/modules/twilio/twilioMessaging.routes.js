import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import projectAdminAuthMiddleware from '../auth/projectAdminAuth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import twilioController from './twilio.controller.js';

/**
 * Project-scoped outbound messaging routes (Clerk session + Project Admin).
 * Mounted in src/index.js at `/api/v1/projects/:projectId/twilio`, after the
 * global JSON body parser.
 */
const router = express.Router({ mergeParams: true });

router.use(authMiddleware);
router.use(projectAdminAuthMiddleware);

const messageLimiter = rateLimiter('PROJECT_TWILIO_MESSAGE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/projects/{projectId}/twilio/messages:
 *   post:
 *     tags: [Twilio]
 *     summary: Send a plain SMS or WhatsApp message (Admin only)
 *     description: >
 *       Sends the supplied body from the Project's Twilio sender. The
 *       channel is inferred from a `whatsapp:` prefix on `to` unless
 *       `channel` is given. Markdown is stripped and long bodies are split
 *       into multiple messages.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to]
 *             properties:
 *               to:
 *                 type: string
 *                 description: E.164 recipient, optionally prefixed with whatsapp:
 *               channel:
 *                 type: string
 *                 enum: [sms, whatsapp]
 *               body: { type: string }
 *               mediaUrl:
 *                 oneOf:
 *                   - { type: string }
 *                   - { type: array, items: { type: string } }
 *               contentSid:
 *                 type: string
 *                 description: Approved WhatsApp template SID (takes precedence over body)
 *               contentVariables:
 *                 type: object
 *     responses:
 *       200: { description: Message sent }
 *       400: { description: Missing recipient or body }
 *       401: { description: Unauthorized }
 *       404: { description: Project not found }
 *       422: { description: Project Twilio sender not configured }
 */
router.post('/messages', messageLimiter, twilioController.sendMessage);

/**
 * @openapi
 * /api/v1/projects/{projectId}/twilio/messages/agent:
 *   post:
 *     tags: [Twilio]
 *     summary: Send an Agent-composed SMS or WhatsApp message (Admin only)
 *     description: >
 *       Runs the named Agent on the conversation thread shared by all
 *       channels for this phone number (project + agent + E.164), then
 *       delivers the Agent's reply over the requested channel.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId, to, prompt]
 *             properties:
 *               agentId: { type: string }
 *               to:
 *                 type: string
 *                 description: E.164 recipient, optionally prefixed with whatsapp:
 *               channel:
 *                 type: string
 *                 enum: [sms, whatsapp]
 *               prompt:
 *                 type: string
 *                 description: The message the Agent responds to
 *               displayName:
 *                 type: string
 *                 description: Optional display name recorded for a new external user (WhatsApp profile name)
 *     responses:
 *       200: { description: Agent reply sent }
 *       400: { description: Missing agentId, to, or prompt }
 *       401: { description: Unauthorized }
 *       404: { description: Project or Agent not found }
 *       422: { description: Project Twilio sender or Agent configuration unsupported }
 *       502: { description: Agent run failed or produced no reply }
 */
router.post('/messages/agent', messageLimiter, twilioController.sendAgentMessage);

export default router;
