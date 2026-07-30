import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createSkillSchema, updateSkillSchema } from '../skills/skill.validator.js';
import developerSkillController from './developerSkill.controller.js';

/**
 * Developer Skill CRUD routes (blueprint Phase 9, PR-29). Reuses the
 * existing Persona createSkillSchema/updateSkillSchema unmodified — same
 * reasoning as developerAgent.routes.js: neither declares ownership
 * fields, so Zod already strips any attempt to inject them.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/skills:
 *   post:
 *     tags: [Developer]
 *     summary: Create a Skill (Project-owned or ExternalUser-owned)
 *     description: Which kind gets created depends on the credential's asserted identity, same as Developer Agent creation.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, instructions]
 *     responses:
 *       201: { description: Skill created }
 *       400: { description: Validation error }
 *       409: { description: A Skill with this exact name already exists }
 */
router.post('/', validateBody(createSkillSchema), developerSkillController.create);

/**
 * @openapi
 * /api/v1/developer/skills:
 *   get:
 *     tags: [Developer]
 *     summary: Discover Skills (blueprint Phase 9, PR-44, AD-07 §19)
 *     description: >
 *       A genuinely separate code path from Persona's marketplace search.
 *       For a bare Project credential (ProjectMachineContext/
 *       ProjectAdminContext): every Skill in this Project's own Domain,
 *       any owner type. For a credential paired with
 *       x-persona-external-user-id (ProjectRuntimeContext): scope=mine
 *       returns only that external user's own Skills; omitting it
 *       returns this Domain's public Skills only.
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
 *       200: { description: List of Skills }
 */
router.get('/', developerSkillController.discover);

/**
 * @openapi
 * /api/v1/developer/skills/{skillId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Skill
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: skillId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Skill }
 *       404: { description: Skill not found (or not visible to this Domain/Subject) }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a Skill (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: skillId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated Skill }
 *       404: { description: Skill not found or unauthorized }
 *       409: { description: Another Skill with this name already exists }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a Skill (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: skillId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Skill deleted }
 *       404: { description: Skill not found or unauthorized }
 */
router.get('/:skillId', developerSkillController.getOne);
router.patch('/:skillId', validateBody(updateSkillSchema), developerSkillController.update);
router.delete('/:skillId', developerSkillController.remove);

export default router;
