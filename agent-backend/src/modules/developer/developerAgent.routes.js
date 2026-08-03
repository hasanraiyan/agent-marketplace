import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createAgentSchema, updateAgentSchema } from '../agents/agent.validator.js';
import { bulkDeleteSchema } from '../../utils/validators/bulkDeleteSchema.js';
import developerAgentController from './developerAgent.controller.js';

/**
 * Developer Agent CRUD routes (blueprint Phase 9, PR-26). Reuses the
 * existing Persona `createAgentSchema`/`updateAgentSchema` unmodified —
 * neither schema declares `domain`/`ownerType`/`ownerId`/`externalOwnerId`,
 * so Zod's default strip-unknown-keys behavior already prevents a caller
 * from injecting them (same reasoning already verified for the Persona
 * routes these schemas serve).
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/agents:
 *   post:
 *     tags: [Developer]
 *     summary: Create an Agent (Project-owned or ExternalUser-owned)
 *     description: >
 *       Which kind of Agent gets created depends on the credential's
 *       asserted identity: a bare Project credential creates a
 *       Project-owned Agent; pairing it with x-persona-external-user-id
 *       creates an Agent owned by that external user.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, systemPrompt, providerId]
 *     responses:
 *       201: { description: Agent created }
 *       400: { description: "Validation error, or invalid Provider" }
 */
router.post('/', validateBody(createAgentSchema), developerAgentController.create);

/**
 * @openapi
 * /api/v1/developer/agents:
 *   get:
 *     tags: [Developer]
 *     summary: Discover Agents
 *     description: >
 *       Results are always scoped to your own Domain — never leaked across
 *       Projects.
 *       For a bare Project credential (ProjectMachineContext/
 *       ProjectAdminContext): every Agent in this Project's own Domain,
 *       any owner type — "Project discovery". For a credential paired
 *       with x-persona-external-user-id (ProjectRuntimeContext):
 *       `scope=mine` returns only that external user's own Agents;
 *       omitting it returns this Domain's public Agents only
 *       ("Project-public browse"). systemPrompt/providerId are stripped
 *       from any result the caller doesn't own.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: category
 *         in: query
 *         schema: { type: string }
 *       - name: scope
 *         in: query
 *         schema: { type: string, enum: [mine] }
 *         description: ProjectRuntimeContext only — "mine" restricts to the asserted external user's own Agents.
 *     responses:
 *       200: { description: List of Agents }
 */
router.get('/', developerAgentController.discover);

/**
 * @openapi
 * /api/v1/developer/agents/{agentId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get an Agent
 *     description: Same visibility rules as Persona (public/unlisted visible in-Domain, private only to the owner). The owner sees full details; non-owners never see systemPrompt/providerId.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: agentId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Agent }
 *       404: { description: Agent not found (or not visible to this Domain/Subject) }
 *   patch:
 *     tags: [Developer]
 *     summary: Update an Agent (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: agentId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated Agent }
 *       401: { description: Unauthorized (not the owner) }
 *       404: { description: Agent not found }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete (soft-delete) an Agent (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: agentId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Agent deleted }
 *       401: { description: Unauthorized (not the owner) }
 *       404: { description: Agent not found }
 */
router.get('/:agentId', developerAgentController.getOne);
router.patch('/:agentId', validateBody(updateAgentSchema), developerAgentController.update);
router.delete('/:agentId', developerAgentController.remove);

/**
 * @openapi
 * /api/v1/developer/agents/bulk-delete:
 *   post:
 *     tags: [Developer]
 *     summary: Delete multiple Agents in one call
 *     description: >
 *       Best-effort batch delete — one blocked/not-found id doesn't abort
 *       the rest. Up to 100 ids per request.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string }
 *                 maxItems: 100
 *     responses:
 *       200: { description: "{ deleted: string[], failed: [{ id, reason }] }" }
 *       400: { description: "ids missing, empty, or over 100 entries" }
 */
router.post('/bulk-delete', validateBody(bulkDeleteSchema), developerAgentController.bulkDelete);

export default router;
