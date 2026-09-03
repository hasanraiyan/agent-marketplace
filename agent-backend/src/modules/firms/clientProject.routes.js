import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { respondInboxSchema } from './firm.validator.js';
import clientProjectController from './clientProject.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/client-projects:
 *   get:
 *     tags: [ClientProjects]
 *     summary: My projects (as a client)
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Projects
 */
router.get('/', authMiddleware, clientProjectController.listMine);

/**
 * @openapi
 * /api/v1/client-projects/firms:
 *   get:
 *     tags: [ClientProjects]
 *     summary: Firms I have worked with
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Firms
 */
router.get('/firms', authMiddleware, clientProjectController.listMyFirms);

/**
 * @openapi
 * /api/v1/client-projects/{id}:
 *   get:
 *     tags: [ClientProjects]
 *     summary: Get a project (client or firm owner)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project
 *       404:
 *         description: Not found
 */
router.get('/:id', authMiddleware, clientProjectController.get);

/**
 * @openapi
 * /api/v1/client-projects/{id}/inbox/{itemId}/respond:
 *   post:
 *     tags: [ClientProjects]
 *     summary: Answer a "needed from you" request
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project
 */
router.post(
  '/:id/inbox/:itemId/respond',
  authMiddleware,
  mutateLimiter,
  validateBody(respondInboxSchema),
  clientProjectController.respond
);

/**
 * @openapi
 * /api/v1/client-projects/{id}/deliverables/{index}/accept:
 *   post:
 *     tags: [ClientProjects]
 *     summary: Accept a delivered deliverable
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: index
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Project
 *       400:
 *         description: Not delivered yet
 */
router.post('/:id/deliverables/:index/accept', authMiddleware, mutateLimiter, clientProjectController.accept);

export default router;
