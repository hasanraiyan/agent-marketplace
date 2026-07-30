import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createAgentSchema, updateAgentSchema } from '../agents/agent.validator.js';
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
 *       400: { description: Validation error, or invalid Provider }
 */
router.post('/', validateBody(createAgentSchema), developerAgentController.create);

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

export default router;
