import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import twilioController from './twilio.controller.js';

/**
 * Developer Platform machine messaging routes (SMS / WhatsApp) — the
 * Project-credential-authenticated sibling of twilioMessaging.routes.js's
 * Clerk + Project-Admin routes. Mounted at /api/v1/developer/messages in
 * src/index.js, after express.json().
 *
 * The Project is taken from the verified credential's context
 * (`req.projectContext.domain`), never from the request body, so a caller
 * can only ever send through their own Project's Twilio account.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

const messageLimiter = rateLimiter('DEVELOPER_TWILIO_MESSAGE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/developer/messages:
 *   post:
 *     tags: [Developer]
 *     summary: Send a plain SMS or WhatsApp message (Project credential)
 *     description: >
 *       Sends the supplied body from this Project's Twilio sender. The
 *       channel is inferred from a `whatsapp:` prefix on `to` unless
 *       `channel` is given. Markdown is stripped and long bodies are split
 *       into multiple messages. Use `contentSid` with an approved WhatsApp
 *       template for business-initiated conversations outside the 24-hour
 *       customer-service window.
 *     security: [{ projectCredential: [] }]
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
 *                 description: "E.164 recipient, optionally prefixed with whatsapp:"
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
 *       200:
 *         description: Message sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     channel: { type: string, enum: [sms, whatsapp] }
 *                     to: { type: string }
 *                     from: { type: string, nullable: true }
 *                     messageSids:
 *                       type: array
 *                       items: { type: string }
 *                     status: { type: string, nullable: true }
 *                     parts: { type: integer }
 *       400:
 *         description: Missing recipient or body, or the recipient is the sender number itself
 *       401:
 *         description: Missing or invalid Project credential
 *       403:
 *         description: Project is not currently ACTIVE
 *       422:
 *         description: Project Twilio sender is not configured
 */
router.post('/', messageLimiter, twilioController.sendDeveloperMessage);

/**
 * @openapi
 * /api/v1/developer/messages/agent:
 *   post:
 *     tags: [Developer]
 *     summary: Send an Agent-composed SMS or WhatsApp message (Project credential)
 *     description: >
 *       Runs the named Agent on the conversation thread shared by all
 *       channels for this phone number (project + agent + E.164), then
 *       delivers the Agent's reply over the requested channel. The recipient
 *       phone number is the conversation subject, so a bare Project
 *       credential is enough.
 *     security: [{ projectCredential: [] }]
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
 *                 description: "E.164 recipient, optionally prefixed with whatsapp:"
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
 *       200:
 *         description: Agent reply sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     agentId: { type: string }
 *                     channel: { type: string, enum: [sms, whatsapp] }
 *                     to: { type: string }
 *                     from: { type: string, nullable: true }
 *                     messageSids:
 *                       type: array
 *                       items: { type: string }
 *                     status: { type: string, nullable: true }
 *                     parts: { type: integer }
 *       400:
 *         description: Missing agentId, to, or prompt
 *       401:
 *         description: Missing or invalid Project credential
 *       403:
 *         description: Project is not currently ACTIVE
 *       404:
 *         description: Agent not found (or not owned by this Project)
 *       422:
 *         description: Project Twilio sender not configured, or the Agent has guarded tools
 *       502:
 *         description: Agent run failed or produced no reply
 */
router.post('/agent', messageLimiter, twilioController.sendDeveloperAgentMessage);

export default router;
