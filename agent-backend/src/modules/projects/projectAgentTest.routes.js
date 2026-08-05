import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import projectAdminAuthMiddleware from '../auth/projectAdminAuth.middleware.js';
import projectAgentTestController from './projectAgentTest.controller.js';

/**
 * Developer Studio Agent Test route. Mounted directly in src/index.js (not
 * inside project.routes.js's `router`) alongside the Persona, Developer,
 * and Architect AG-UI routes, and BEFORE `express.json()` — this route
 * reads its own raw request body via `readJsonBody` (agui.service.js),
 * same reasoning as the other three AG-UI routes.
 */
const router = express.Router({ mergeParams: true });

router.use(authMiddleware);
router.use(projectAdminAuthMiddleware);

/**
 * @openapi
 * /api/v1/projects/{projectId}/agents/{agentId}/test/agui:
 *   get:
 *     tags: [Projects]
 *     summary: Agent Test playground protocol info
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
 *       200: { description: Protocol info }
 *   post:
 *     tags: [Projects]
 *     summary: Chat with one of this Project's own Agents (Admin only)
 *     description: >
 *       Runs the named Agent — verified to belong to this Project first —
 *       with the caller's own ProjectAdminContext. One deterministic thread
 *       per (Project, Agent) pair, shared across whichever Admin is
 *       testing it, matching the Architect route's own reasoning.
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
 *       200: { description: SSE event stream of AG-UI protocol events }
 *       404: { description: Agent not found (or not owned by this Project) }
 */
router.get('/', projectAgentTestController.getProtocolInfo);
router.post('/', projectAgentTestController.runAgent);

export default router;
