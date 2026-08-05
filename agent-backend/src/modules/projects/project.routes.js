import express from 'express';
import multer from 'multer';
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
import { createProviderSchema, updateProviderSchema } from '../providers/provider.validator.js';
import { createSkillSchema, updateSkillSchema } from '../skills/skill.validator.js';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
} from '../knowledge/knowledge.validator.js';
import { createMcpSchema, updateMcpSchema } from '../mcp/mcp.validator.js';
import { createAgentSchema, updateAgentSchema } from '../agents/agent.validator.js';
import { createStoreSchema, updateStoreSchema } from '../stores/store.validator.js';

const router = express.Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

// Mirrors developerKnowledge.routes.js's exact upload config — memory
// storage only, never written to disk, same size/type limits.
const knowledgeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
    ];
    const allowedExts = /\.(pdf|txt|md|json|csv)$/i;
    const extOk = allowedExts.test(file.originalname);
    const mimeOk = allowedMimes.includes(file.mimetype);

    if (extOk || mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Unsupported file type. Allowed: PDF, TXT, MD, CSV, JSON'));
  },
});

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
 *       400: { description: "Not currently SUSPENDED, or suspended by Platform Admin authority" }
 *       404: { description: Project not found }
 */
adminRouter.post('/reactivate', mutateLimiter, projectController.reactivate);

/**
 * @openapi
 * /api/v1/projects/{projectId}/delete:
 *   post:
 *     tags: [Projects]
 *     summary: Request Project deletion (Admin only, blueprint Phase 10)
 *     description: >
 *       Immediately halts credential authentication and runtime execution
 *       (enforced by existing status-check middleware, same as suspension).
 *       Starts a grace period during which deletion may still be cancelled
 *       (AD-08 §28) — actual data cleanup is asynchronous and not performed
 *       by this endpoint. Valid from ACTIVE or SUSPENDED.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project deletion requested }
 *       400: { description: Project is not ACTIVE or SUSPENDED }
 *       404: { description: Project not found }
 */
adminRouter.post('/delete', mutateLimiter, projectController.requestDeletion);

/**
 * @openapi
 * /api/v1/projects/{projectId}/cancel-deletion:
 *   post:
 *     tags: [Projects]
 *     summary: Cancel a pending Project deletion (Admin only, blueprint Phase 10)
 *     description: >
 *       Only valid while the deletion grace period hasn't elapsed. Always
 *       returns the Project to ACTIVE, regardless of whether it was
 *       SUSPENDED before the deletion request.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Project deletion cancelled, Project restored to ACTIVE" }
 *       400: { description: "Not pending deletion, or the grace period has already elapsed" }
 *       404: { description: Project not found }
 */
adminRouter.post('/cancel-deletion', mutateLimiter, projectController.cancelDeletion);

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
 *       201: { description: "Credential created, secret shown once" }
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

/**
 * @openapi
 * /api/v1/projects/{projectId}/agents:
 *   get:
 *     tags: [Projects]
 *     summary: List this Project's Agents (Admin only, blueprint Phase 11)
 *     description: >
 *       Read-only resource browsing for Developer Studio — reuses the same
 *       Discovery Contract `agentService.discoverAgents` built in PR-43,
 *       just called with `ProjectAdminContext` (Clerk session) instead of a
 *       machine credential. Studio never touches a Project's own API key.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of Agents }
 */
adminRouter.get('/agents', projectController.listAgents);

/**
 * Full create/edit/delete for a Project's own Agents from Developer Studio
 * (Phase 11.5, PR-61) — same pass-through reasoning as the Skills/Knowledge/
 * MCP/Providers write routes below (PR-60): `agentService.createDeveloperAgent`/
 * `updateAgent`/`deleteAgent` already accept `ProjectAdminContext`.
 */
adminRouter.post(
  '/agents',
  mutateLimiter,
  validateBody(createAgentSchema),
  projectController.createAgent
);
adminRouter.patch(
  '/agents/:agentId',
  mutateLimiter,
  validateBody(updateAgentSchema),
  projectController.updateAgent
);
adminRouter.delete('/agents/:agentId', mutateLimiter, projectController.deleteAgent);
adminRouter.post('/agents/bulk-delete', mutateLimiter, projectController.bulkDeleteAgents);

/**
 * @openapi
 * /api/v1/projects/{projectId}/audit-logs:
 *   get:
 *     tags: [Projects]
 *     summary: List this Project's audit trail (Admin only, Feature 6)
 *     description: >
 *       Project-lifecycle events only (credential minted/revoked, membership
 *       changes, suspend/restore) — resource CRUD (Agent/Skill/Knowledge/
 *       Provider/MCP) isn't logged here yet.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *       - name: eventType
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated audit log entries }
 */
adminRouter.get('/audit-logs', projectController.listAuditLogs);

/**
 * Full create/edit/delete for a Project's own Skills/Knowledge/MCP/
 * Providers from Developer Studio (Phase 11.5) — the read-only PR-55
 * `list*` routes above stay as-is; these are new siblings on the same
 * `adminRouter`, reusing the identical service methods and Zod validators
 * the SDK's `developer*.routes.js` files already import, just with
 * `req.projectAdminContext` (Clerk session) instead of `req.projectContext`
 * (machine credential/API key).
 */
adminRouter.post(
  '/providers',
  mutateLimiter,
  validateBody(createProviderSchema),
  projectController.createProvider
);
adminRouter.patch(
  '/providers/:providerId',
  mutateLimiter,
  validateBody(updateProviderSchema),
  projectController.updateProvider
);
adminRouter.delete('/providers/:providerId', mutateLimiter, projectController.deleteProvider);
adminRouter.post(
  '/providers/:providerId/test-connection',
  projectController.testProviderConnection
);
adminRouter.get('/providers/:providerId/models', projectController.getProviderModels);
adminRouter.get('/providers/:providerId/usage', projectController.getProviderUsage);
adminRouter.post('/providers/bulk-delete', mutateLimiter, projectController.bulkDeleteProviders);

adminRouter.post(
  '/skills',
  mutateLimiter,
  validateBody(createSkillSchema),
  projectController.createSkill
);
adminRouter.patch(
  '/skills/:skillId',
  mutateLimiter,
  validateBody(updateSkillSchema),
  projectController.updateSkill
);
adminRouter.delete('/skills/:skillId', mutateLimiter, projectController.deleteSkill);
adminRouter.get('/skills/:skillId/usage', projectController.getSkillUsage);
adminRouter.post('/skills/bulk-delete', mutateLimiter, projectController.bulkDeleteSkills);

adminRouter.post(
  '/stores',
  mutateLimiter,
  validateBody(createStoreSchema),
  projectController.createStore
);
adminRouter.patch(
  '/stores/:storeId',
  mutateLimiter,
  validateBody(updateStoreSchema),
  projectController.updateStore
);
adminRouter.delete('/stores/:storeId', mutateLimiter, projectController.deleteStore);

adminRouter.post(
  '/knowledge',
  mutateLimiter,
  validateBody(createKnowledgeBaseSchema),
  projectController.createKnowledge
);
adminRouter.patch(
  '/knowledge/:kbId',
  mutateLimiter,
  validateBody(updateKnowledgeBaseSchema),
  projectController.updateKnowledge
);
adminRouter.delete('/knowledge/:kbId', mutateLimiter, projectController.deleteKnowledge);
adminRouter.get('/knowledge/:kbId/usage', projectController.getKnowledgeUsage);
adminRouter.post('/knowledge/bulk-delete', mutateLimiter, projectController.bulkDeleteKnowledge);
adminRouter.post('/knowledge/:kbId/search', projectController.searchKnowledge);
adminRouter.post(
  '/knowledge/:kbId/documents',
  mutateLimiter,
  knowledgeUpload.array('files', 10),
  projectController.uploadKnowledgeDocuments
);
adminRouter.get('/knowledge/:kbId/documents', projectController.listKnowledgeDocuments);
adminRouter.delete(
  '/knowledge/:kbId/documents/:sourceName',
  mutateLimiter,
  projectController.deleteKnowledgeDocument
);

adminRouter.post(
  '/mcps',
  mutateLimiter,
  validateBody(createMcpSchema),
  projectController.createMcp
);
adminRouter.patch(
  '/mcps/:mcpId',
  mutateLimiter,
  validateBody(updateMcpSchema),
  projectController.updateMcp
);
adminRouter.delete('/mcps/:mcpId', mutateLimiter, projectController.deleteMcp);
adminRouter.get('/mcps/:mcpId/usage', projectController.getMcpUsage);
adminRouter.post('/mcps/bulk-delete', mutateLimiter, projectController.bulkDeleteMcps);
adminRouter.get('/mcps/:mcpId/oauth/owner/authorize', projectController.getMcpOwnerAuthorizeUrl);
adminRouter.delete(
  '/mcps/:mcpId/oauth/owner/connection',
  mutateLimiter,
  projectController.disconnectMcpOwnerConnection
);

/**
 * @openapi
 * /api/v1/projects/{projectId}/skills:
 *   get:
 *     tags: [Projects]
 *     summary: List this Project's Skills (Admin only, blueprint Phase 11)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of Skills }
 */
adminRouter.get('/skills', projectController.listSkills);

/**
 * @openapi
 * /api/v1/projects/{projectId}/stores:
 *   get:
 *     tags: [Projects]
 *     summary: List this Project's Stores (Admin only)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of Stores }
 */
adminRouter.get('/stores', projectController.listStores);

/**
 * @openapi
 * /api/v1/projects/{projectId}/knowledge:
 *   get:
 *     tags: [Projects]
 *     summary: List this Project's Knowledge Bases (Admin only, blueprint Phase 11)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of Knowledge Bases }
 */
adminRouter.get('/knowledge', projectController.listKnowledge);

/**
 * @openapi
 * /api/v1/projects/{projectId}/mcps:
 *   get:
 *     tags: [Projects]
 *     summary: List this Project's MCP connectors (Admin only, blueprint Phase 11)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of MCP connectors }
 */
adminRouter.get('/mcps', projectController.listMcps);

/**
 * @openapi
 * /api/v1/projects/{projectId}/providers:
 *   get:
 *     tags: [Projects]
 *     summary: List this Project's Providers (Admin only, blueprint Phase 11)
 *     description: >
 *       Provider has no Discovery Contract equivalent (AD-04 — control-plane
 *       only, no public-browse concept) — this is a plain Domain-scoped
 *       list via `providerService.listProvidersForProject`.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of Providers (never includes decrypted API keys) }
 */
adminRouter.get('/providers', projectController.listProviders);

router.use('/:projectId', adminRouter);

export default router;
