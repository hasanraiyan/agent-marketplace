import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import developerController from './developer.controller.js';

/**
 * Developer Platform runtime-plane routes (blueprint Phase 8, PR-20).
 *
 * Mounted at /api/v1/developer, authenticated by Project credential
 * (developerMachineAuth.middleware.js) — NOT Clerk. This is deliberately a
 * separate, structurally isolated middleware chain from the Persona/Clerk
 * routes and from the Project-admin routes (project.routes.js), per AD-01
 * §13 / AD-04 §6.5's warning against blending authentication schemes on
 * one endpoint (the same reasoning already applied to /api/v1/agui vs. a
 * hypothetical dual-auth version of it).
 *
 * `/whoami` is the first and, for now, only route here — a minimal,
 * side-effect-free way to prove a Project credential authenticates
 * end-to-end before the Developer AG-UI route (blueprint Phase 8, later
 * PR) is built on top of the same middleware.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/whoami:
 *   get:
 *     tags: [Developer]
 *     summary: Resolve the current Project principal context
 *     description: Authenticates a Project credential (Authorization Bearer <keyId>.<secret>, optionally with x-persona-external-user-id) and returns the resolved ProjectMachineContext or ProjectRuntimeContext. No side effects beyond external-user JIT resolution already performed by the auth middleware itself.
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200:
 *         description: Resolved principal context
 *       401:
 *         description: Missing or invalid Project credential
 *       403:
 *         description: Project is not currently ACTIVE
 */
router.get('/whoami', developerController.whoami);

export default router;
