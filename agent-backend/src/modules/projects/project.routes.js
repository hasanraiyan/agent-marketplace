import express from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import projectAdminAuthMiddleware from '../auth/projectAdminAuth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import projectController from './project.controller.js';
import {
  createProjectSchema,
  updateProjectSchema,
  addMemberSchema,
  createCredentialSchema,
} from './project.validator.js';

const router = express.Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

// Every Project route requires an authenticated Persona User (Clerk).
// Admin-only sub-routes additionally require projectAdminAuthMiddleware,
// which resolves ProjectAdminContext from the caller's own membership.
router.use(authMiddleware);

/**
 * @openapi
 * /api/v1/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a Project
 *     description: Creates a new Developer Platform Project and grants the creator an initial Admin membership (AD-08 §6). Any authenticated Persona User may create a Project.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               slug: { type: string }
 *     responses:
 *       201: { description: Project created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *   get:
 *     tags: [Projects]
 *     summary: List my Projects
 *     description: Lists every Project the authenticated Persona User holds a membership in.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200: { description: List of Projects }
 *       401: { description: Unauthorized }
 */
router.post('/', mutateLimiter, validateBody(createProjectSchema), projectController.create);
router.get('/', projectController.listMine);

const adminRouter = express.Router({ mergeParams: true });
adminRouter.use(projectAdminAuthMiddleware);

/**
 * @openapi
 * /api/v1/projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a Project (Admin only)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project }
 *       404: { description: Project not found (or caller is not a member) }
 *   patch:
 *     tags: [Projects]
 *     summary: Update Project metadata (Admin only)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               slug: { type: string }
 *     responses:
 *       200: { description: Updated Project }
 *       404: { description: Project not found }
 */
adminRouter.get('/', projectController.getOne);
adminRouter.patch(
  '/',
  mutateLimiter,
  validateBody(updateProjectSchema),
  projectController.updateMetadata
);

/**
 * @openapi
 * /api/v1/projects/{projectId}/suspend:
 *   post:
 *     tags: [Projects]
 *     summary: Suspend a Project (Admin only, blueprint Phase 10)
 *     description: >
 *       A reversible, non-destructive kill switch (AD-08 §26) — data is never touched.
 *       Immediately halts credential authentication and runtime execution (enforced by
 *       existing status-check middleware). Only valid from ACTIVE.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project suspended }
 *       400: { description: Project is not currently ACTIVE }
 *       404: { description: Project not found }
 */
adminRouter.post('/suspend', mutateLimiter, projectController.suspend);

/**
 * @openapi
 * /api/v1/projects/{projectId}/reactivate:
 *   post:
 *     tags: [Projects]
 *     summary: Reactivate a suspended Project (Admin only, blueprint Phase 10)
 *     description: >
 *       Only valid for a Project the caller's own Admin authority suspended
 *       (AD-08 §26 restore-symmetry) — a Platform-suspended Project can only
 *       be restored by Platform Admin.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project reactivated }
 *       400: { description: Not currently SUSPENDED, or suspended by Platform Admin authority }
 *       404: { description: Project not found }
 */
adminRouter.post('/reactivate', mutateLimiter, projectController.reactivate);

/**
 * @openapi
 * /api/v1/projects/{projectId}/members:
 *   get:
 *     tags: [Projects]
 *     summary: List Project members (Admin only)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of memberships }
 *   post:
 *     tags: [Projects]
 *     summary: Add a Project Admin (Admin only)
 *     description: v1 supports exactly one role (Admin, AD-08 §9) — adds an existing Persona User by internal ID.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [personaUserId]
 *             properties:
 *               personaUserId: { type: string }
 *     responses:
 *       201: { description: Membership created }
 *       404: { description: Persona User not found }
 */
adminRouter.get('/members', projectController.listMembers);
adminRouter.post(
  '/members',
  mutateLimiter,
  validateBody(addMemberSchema),
  projectController.addMember
);

/**
 * @openapi
 * /api/v1/projects/{projectId}/members/{personaUserId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Remove a Project member (Admin only)
 *     description: Enforces the last-Admin invariant (AD-08 §12) — the sole remaining Admin cannot be removed.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: personaUserId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Membership removed }
 *       400: { description: Cannot remove the last remaining Admin }
 *       404: { description: Membership not found }
 */
adminRouter.delete('/members/:personaUserId', mutateLimiter, projectController.removeMember);

/**
 * @openapi
 * /api/v1/projects/{projectId}/credentials:
 *   get:
 *     tags: [Projects]
 *     summary: List Project credentials, metadata only (Admin only)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of credentials (never includes the secret) }
 *   post:
 *     tags: [Projects]
 *     summary: Mint a new Project credential (Admin only)
 *     description: Returns the plaintext secret exactly once (AD-01 §9.2) — it is never retrievable again after this response.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *     responses:
 *       201: { description: Credential created, secret shown once }
 */
adminRouter.get('/credentials', projectController.listCredentials);
adminRouter.post(
  '/credentials',
  mutateLimiter,
  validateBody(createCredentialSchema),
  projectController.mintCredential
);

/**
 * @openapi
 * /api/v1/projects/{projectId}/credentials/{credentialId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Revoke a Project credential (Admin only)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: credentialId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Credential revoked }
 *       404: { description: Credential not found }
 */
adminRouter.delete('/credentials/:credentialId', mutateLimiter, projectController.revokeCredential);

router.use('/:projectId', adminRouter);

export default router;
