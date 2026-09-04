import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import projectAdminAuthMiddleware from '../auth/projectAdminAuth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import projectAgentVoiceTestController from './projectAgentVoiceTest.controller.js';

/**
 * Developer Studio Agent Voice Test route (voice-agent-plan.md §7 route (b),
 * §13.1, §18 Phase 1). Mounted under the Project router alongside
 * projectAgentTest.routes.js's text-chat counterpart — same auth chain,
 * same ownership-checked-before-anything-starts posture, same `:agentId`
 * param — but this route only ever mints a ticket; the actual conversation
 * happens over the WebSocket gateway (voiceGateway.js), never here.
 */
const router = express.Router({ mergeParams: true });

router.use(authMiddleware);
router.use(projectAdminAuthMiddleware);

/**
 * @openapi
 * /api/v1/projects/{projectId}/agents/{agentId}/test/voice/sessions:
 *   post:
 *     tags: [Projects]
 *     summary: Mint a single-use voice session ticket for the Agent Test playground
 *     description: >
 *       Issues a short-lived (60s), single-use ticket for connecting to the
 *       voice WebSocket gateway (GET/WS /api/v1/developer/voice). Express
 *       middleware never runs on a WebSocket upgrade, so this ticket is the
 *       only authentication the gateway has — never a Project credential,
 *       which this route never accepts or forwards. Requires this Project's
 *       Domain to have an active Gemini Provider configured (the Agent's
 *       own provider if it's Gemini, else the Domain's default Gemini
 *       provider).
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: agentId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket issued
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
 *                     ticket: { type: string }
 *                     wsUrl: { type: string }
 *                     expiresAt: { type: string, format: date-time }
 *                     session:
 *                       type: object
 *                       properties:
 *                         model: { type: string }
 *                         voice: { type: string }
 *                         inputSampleRate: { type: integer }
 *                         outputSampleRate: { type: integer }
 *                         maxDurationMs: { type: integer }
 *       401:
 *         description: Missing or invalid Clerk session
 *       404:
 *         description: Project not found, not a member, or Agent not found/not owned by this Project
 *       422:
 *         description: This Project has no usable Gemini provider configured
 */
router.post(
  '/agents/:agentId/test/voice/sessions',
  rateLimiter('voice-session', RATE_LIMITS.CHAT),
  projectAgentVoiceTestController.createSession
);

export default router;
