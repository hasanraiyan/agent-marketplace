import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import developerVoiceController from './developerVoice.controller.js';

/**
 * Developer Platform machine voice route (voice-agent-plan.md §7 route (a),
 * §18 Phase 2) — a Project-credential-authenticated sibling to the
 * Developer Studio test route (projectAgentVoiceTest.routes.js), sharing
 * the same ticket shape and the same WS gateway. Mounted alongside
 * developerAgentRouter/developerAguiRouter etc. in src/index.js, AFTER
 * express.json() — unlike /api/v1/developer/agui, this is a normal small
 * JSON POST (ticket minting only), never SSE/raw-body.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/voice/sessions:
 *   post:
 *     tags: [Developer]
 *     summary: Mint a single-use voice session ticket
 *     description: >
 *       Issues a short-lived (60s), single-use ticket for connecting to the
 *       voice WebSocket gateway (GET/WS /api/v1/developer/voice). Requires
 *       the credential to be paired with x-persona-external-user-id
 *       (voice always runs as a Subject) and this Project's Domain to have
 *       an active Gemini Provider configured (the Agent's own provider if
 *       it's Gemini, else the Domain's default Gemini provider).
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-agent-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *       - name: x-persona-external-user-id
 *         in: header
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
 *       400:
 *         description: Missing x-agent-id, or credential has no asserted external user
 *       401:
 *         description: Missing or invalid Project credential
 *       403:
 *         description: Project is not currently ACTIVE
 *       404:
 *         description: Agent not found (or not executable by this Domain)
 *       422:
 *         description: No usable Gemini provider configured, or the Agent has a guarded (interruptOn) tool enabled
 */
router.post(
  '/sessions',
  rateLimiter('voice-session', RATE_LIMITS.CHAT),
  developerVoiceController.createSession
);

export default router;
