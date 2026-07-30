import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
} from '../knowledge/knowledge.validator.js';
import developerKnowledgeController from './developerKnowledge.controller.js';

/**
 * Developer Knowledge CRUD routes (blueprint Phase 9, PR-32). Reuses the
 * existing Persona createKnowledgeBaseSchema/updateKnowledgeBaseSchema
 * unmodified — same reasoning as the Agent/Skill Developer routes.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/knowledge:
 *   post:
 *     tags: [Developer]
 *     summary: Create a Knowledge Base (Project-owned or ExternalUser-owned)
 *     description: >
 *       Which kind gets created depends on the credential's asserted
 *       identity. providerId is REQUIRED here (unlike the Persona route,
 *       which can auto-resolve the caller's default Provider) — no
 *       equivalent "default Provider" concept exists for a Project or
 *       ExternalUser yet.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, providerId]
 *     responses:
 *       201: { description: Knowledge Base created }
 *       400: { description: Validation error, or missing providerId }
 */
router.post('/', validateBody(createKnowledgeBaseSchema), developerKnowledgeController.create);

/**
 * @openapi
 * /api/v1/developer/knowledge:
 *   get:
 *     tags: [Developer]
 *     summary: Discover Knowledge Bases (blueprint Phase 9, PR-45, AD-07 §19)
 *     description: >
 *       A genuinely separate code path — Knowledge has no Persona
 *       marketplace-browse feature to accidentally reuse. For a bare
 *       Project credential: every Knowledge Base in this Project's own
 *       Domain, any owner type. For a credential paired with
 *       x-persona-external-user-id: scope=mine returns only that
 *       external user's own Knowledge Bases; omitting it returns this
 *       Domain's public Knowledge Bases only.
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
 *       - name: scope
 *         in: query
 *         schema: { type: string, enum: [mine] }
 *     responses:
 *       200: { description: List of Knowledge Bases }
 */
router.get('/', developerKnowledgeController.discover);

/**
 * @openapi
 * /api/v1/developer/knowledge/{kbId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Knowledge Base
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Knowledge Base }
 *       404: { description: Knowledge Base not found (or not visible to this Domain/Subject) }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a Knowledge Base (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated Knowledge Base }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a Knowledge Base (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: kbId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Knowledge Base deleted }
 */
router.get('/:kbId', developerKnowledgeController.getOne);
router.patch(
  '/:kbId',
  validateBody(updateKnowledgeBaseSchema),
  developerKnowledgeController.update
);
router.delete('/:kbId', developerKnowledgeController.remove);

export default router;
