import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import developerAguiController from './developerAgui.controller.js';

/**
 * Developer AG-UI route (blueprint Phase 8, PR-23b) — a Project-
 * authenticated route sharing the exact same runtime layer
 * (runAgentAsAguiEvents / AgentFactory.buildAgent / AG-UI event
 * translation) the existing Persona-only /api/v1/agui route already uses,
 * per AD-07 §20 ("the route is new; the runtime is shared").
 *
 * Mounted before express.json() in index.js, same raw-body-before-json
 * reasoning as /api/v1/agui (readJsonBody parses the stream itself).
 * Authenticated by Project credential (developerMachineAuthMiddleware),
 * never Clerk — a structurally separate middleware chain, per AD-01 §13.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/agui:
 *   get:
 *     tags: [Developer]
 *     summary: Developer AG-UI protocol information
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200:
 *         description: Protocol information
 *   post:
 *     tags: [Developer]
 *     summary: Run an Agent as an external user, streaming AG-UI events (SSE)
 *     description: >
 *       Requires a ProjectRuntimeContext — the credential must be paired
 *       with the x-persona-external-user-id header asserting which of the
 *       Project's own external users is running the Agent. Reuses the
 *       exact same runtime as the Persona AG-UI route. Pass x-thread-id
 *       (a Thread id from POST /api/v1/developer/threads) to resume a
 *       named conversation — omit it to keep using the implicit,
 *       Domain-extended deterministic thread id (one conversation per
 *       Agent + external user). An unrecognized/foreign/wrong-agent
 *       x-thread-id silently falls back to the deterministic id rather
 *       than erroring (same contract as the Persona AG-UI route).
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-agent-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *       - name: x-thread-id
 *         in: header
 *         required: false
 *         schema:
 *           type: string
 *         description: A Thread id from the Developer Thread CRUD API — resumes that conversation instead of the implicit deterministic one.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *     responses:
 *       200:
 *         description: SSE event stream of AG-UI protocol events
 *       400:
 *         description: Missing x-agent-id, or credential has no asserted external user
 *       401:
 *         description: Missing or invalid Project credential
 *       403:
 *         description: Project is not currently ACTIVE
 *       404:
 *         description: Agent not found (or not executable by this Domain/Subject)
 */
router.get('/', developerAguiController.getProtocolInfo);
router.post('/', rateLimiter('CHAT', RATE_LIMITS.CHAT), developerAguiController.runAgent);

export default router;
