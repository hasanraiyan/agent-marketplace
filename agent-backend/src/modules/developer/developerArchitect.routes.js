import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import developerArchitectController from './developerArchitect.controller.js';

/**
 * Developer Platform Architect route — mounted directly in src/index.js
 * (not inside developer.routes.js's generic router), alongside the Persona,
 * Developer, and Project AG-UI routes, and BEFORE `express.json()` — this
 * route reads its own raw request body via `readJsonBody` (agui.service.js),
 * same reasoning as the other three AG-UI routes.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/architect/agui:
 *   get:
 *     tags: [Developer]
 *     summary: Developer Platform Architect protocol info
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200: { description: Protocol info }
 *   post:
 *     tags: [Developer]
 *     summary: Chat with this Project's Agent Architect (machine-credential auth)
 *     description: >
 *       Runs the dedicated DEVELOPER_ARCHITECT_AGENT_ID sentinel with the
 *       caller's own ProjectMachineContext or ProjectRuntimeContext — a
 *       conversational co-pilot that can create/edit Agents via tool calls.
 *       A bare Project credential (no x-persona-external-user-id) builds
 *       Agents owned by the whole Project. An asserted external user builds
 *       Agents owned by that user instead. Never the same sentinel or
 *       toolbox context as the Persona-only Architect served by
 *       /api/v1/agui, nor the Clerk/Project-Admin-only Architect served by
 *       /api/v1/projects/:projectId/architect/agui.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: false
 *         schema:
 *           type: string
 *         description: If asserted, Agents created/edited this turn are owned by this external user instead of the whole Project.
 *     responses:
 *       200:
 *         description: A text/event-stream SSE stream of AG-UI protocol events.
 *       401:
 *         description: Missing or invalid Project credential
 *       403:
 *         description: Project is not currently ACTIVE
 */
router.get('/', developerArchitectController.getProtocolInfo);
router.post('/', developerArchitectController.runAgent);

export default router;
