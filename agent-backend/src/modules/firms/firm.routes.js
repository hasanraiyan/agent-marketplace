import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import optionalAuthMiddleware from '../auth/optional-auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createFirmSchema,
  updateFirmSchema,
  createFirmProjectSchema,
  updateFirmProjectSchema,
  updateTeamMemberSchema,
  startProjectSchema,
} from './firm.validator.js';
import firmController from './firm.controller.js';
import clientProjectController from './clientProject.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

// ── Owner routes (declared before /:slug so "me" never resolves as a slug) ──

/**
 * @openapi
 * /api/v1/firms/me:
 *   get:
 *     tags: [Firms]
 *     summary: Get my firm
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: My firm
 *       404:
 *         description: No firm yet
 */
router.get('/me', authMiddleware, firmController.me);

/**
 * @openapi
 * /api/v1/firms/me:
 *   patch:
 *     tags: [Firms]
 *     summary: Update my firm
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated firm
 */
router.patch('/me', authMiddleware, mutateLimiter, validateBody(updateFirmSchema), firmController.update);

/**
 * @openapi
 * /api/v1/firms/me/publish:
 *   post:
 *     tags: [Firms]
 *     summary: Publish my firm to the marketplace
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Published firm
 *       400:
 *         description: Requirements unmet (details lists them)
 */
router.post('/me/publish', authMiddleware, mutateLimiter, firmController.publish);

/**
 * @openapi
 * /api/v1/firms/me/unpublish:
 *   post:
 *     tags: [Firms]
 *     summary: Hide my firm from the marketplace
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Draft firm
 */
router.post('/me/unpublish', authMiddleware, mutateLimiter, firmController.unpublish);

/**
 * @openapi
 * /api/v1/firms/me/projects:
 *   get:
 *     tags: [Firms]
 *     summary: List my firm's project templates
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Templates
 *   post:
 *     tags: [Firms]
 *     summary: Create a project template
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       201:
 *         description: Template created
 */
router.get('/me/projects', authMiddleware, firmController.listProjects);
router.post(
  '/me/projects',
  authMiddleware,
  mutateLimiter,
  validateBody(createFirmProjectSchema),
  firmController.createProject
);

/**
 * @openapi
 * /api/v1/firms/me/projects/{id}:
 *   patch:
 *     tags: [Firms]
 *     summary: Update a project template
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated template
 *   delete:
 *     tags: [Firms]
 *     summary: Delete a project template
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.patch(
  '/me/projects/:id',
  authMiddleware,
  mutateLimiter,
  validateBody(updateFirmProjectSchema),
  firmController.updateProject
);
router.delete('/me/projects/:id', authMiddleware, mutateLimiter, firmController.deleteProject);

/**
 * @openapi
 * /api/v1/firms/me/team:
 *   get:
 *     tags: [Firms]
 *     summary: List my agents with their firm roles
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Team
 */
router.get('/me/team', authMiddleware, firmController.listTeam);

/**
 * @openapi
 * /api/v1/firms/me/team/{agentId}:
 *   patch:
 *     tags: [Firms]
 *     summary: Add/remove an agent from my firm or set its role
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated agent
 */
router.patch(
  '/me/team/:agentId',
  authMiddleware,
  mutateLimiter,
  validateBody(updateTeamMemberSchema),
  firmController.updateTeamMember
);

/**
 * @openapi
 * /api/v1/firms/me/clients:
 *   get:
 *     tags: [Firms]
 *     summary: List client projects running in my firm (ops view)
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Client projects
 */
router.get('/me/clients', authMiddleware, firmController.listClients);

/**
 * @openapi
 * /api/v1/firms:
 *   post:
 *     tags: [Firms]
 *     summary: Create my firm
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       201:
 *         description: Firm created
 *       409:
 *         description: Firm already exists
 *   get:
 *     tags: [Firms]
 *     summary: List published firms (marketplace)
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Firms
 */
router.post('/', authMiddleware, mutateLimiter, validateBody(createFirmSchema), firmController.create);
router.get('/', optionalAuthMiddleware, firmController.list);

// ── Public storefront ────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/firms/{slug}:
 *   get:
 *     tags: [Firms]
 *     summary: Firm storefront (firm, projects, team)
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Storefront
 *       404:
 *         description: Not found
 */
router.get('/:slug', optionalAuthMiddleware, firmController.storefront);

/**
 * @openapi
 * /api/v1/firms/{slug}/projects/{projectSlug}:
 *   get:
 *     tags: [Firms]
 *     summary: Public project page
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectSlug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project
 */
router.get('/:slug/projects/:projectSlug', optionalAuthMiddleware, firmController.publicProject);

/**
 * @openapi
 * /api/v1/firms/{slug}/projects/{projectSlug}/start:
 *   post:
 *     tags: [Firms]
 *     summary: Start a project with this firm (creates a ClientProject + thread)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: projectSlug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Project started
 *       400:
 *         description: Missing inputs
 */
router.post(
  '/:slug/projects/:projectSlug/start',
  authMiddleware,
  mutateLimiter,
  validateBody(startProjectSchema),
  clientProjectController.start
);

export default router;
