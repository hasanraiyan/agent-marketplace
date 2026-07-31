import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import projectAdminAuthMiddleware from '../auth/projectAdminAuth.middleware.js';
import projectArchitectController from './projectArchitect.controller.js';

/**
 * Project Agent Architect route (blueprint Phase 11.5, PR-62). Mounted
 * directly in src/index.js (not inside project.routes.js's `router`),
 * alongside the Persona and Developer AG-UI routes, and BEFORE
 * `express.json()` — this route reads its own raw request body via
 * `readJsonBody` (agui.service.js), same reasoning as the other two AG-UI
 * routes.
 */
const router = express.Router({ mergeParams: true });

router.use(authMiddleware);
router.use(projectAdminAuthMiddleware);

/**
 * @openapi
 * /api/v1/projects/{projectId}/architect/agui:
 *   get:
 *     tags: [Projects]
 *     summary: Project Agent Architect protocol info
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Protocol info }
 *   post:
 *     tags: [Projects]
 *     summary: Chat with this Project's Agent Architect (Admin only, blueprint Phase 11.5)
 *     description: >
 *       Runs the dedicated PROJECT_ARCHITECT_AGENT_ID sentinel with the
 *       caller's own ProjectAdminContext — a conversational co-pilot that
 *       can create/edit this Project's own Agents via tool calls. Never the
 *       same sentinel or toolbox as the Persona-only Architect served by
 *       /api/v1/agui.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: SSE event stream of AG-UI protocol events }
 */
router.get('/', projectArchitectController.getProtocolInfo);
router.post('/', projectArchitectController.runAgent);

export default router;
