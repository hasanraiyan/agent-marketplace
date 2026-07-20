import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createSkillSchema, updateSkillSchema } from './skill.validator.js';
import skillController from './skill.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/skills/search:
 *   get:
 *     tags: [Skills]
 *     summary: Search skills
 *     description: Full-text search across skill names and descriptions.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: q
 *         in: query
 *         schema:
 *           type: string
 *         description: Search query string
 *     responses:
 *       200:
 *         description: Search results
 *       401:
 *         description: Unauthorized
 */
router.get('/search', authMiddleware, skillController.search);

/**
 * @openapi
 * /api/v1/skills/public:
 *   get:
 *     tags: [Skills]
 *     summary: List public skills
 *     description: Returns all skills marked as public across all users. Used for the skill marketplace.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Public skills list
 *       401:
 *         description: Unauthorized
 */
router.get('/public', authMiddleware, skillController.getPublicSkills);

/**
 * @openapi
 * /api/v1/skills:
 *   get:
 *     tags: [Skills]
 *     summary: List own skills
 *     description: Returns all skills created by the authenticated user.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Skills list
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [Skills]
 *     summary: Create a skill
 *     description: Creates a reusable skill with instructions that agents can reference. Skills are markdown-based instruction files stored on the filesystem.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, instructions]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Skill name
 *               description:
 *                 type: string
 *                 description: Brief description of what the skill does
 *               instructions:
 *                 type: string
 *                 description: Full skill instructions written in markdown
 *               isPublic:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the skill is publicly visible
 *     responses:
 *       201:
 *         description: Skill created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', authMiddleware, skillController.getMySkills);
router.post(
  '/',
  authMiddleware,
  mutateLimiter,
  validateBody(createSkillSchema),
  skillController.create
);

/**
 * @openapi
 * /api/v1/skills/{id}:
 *   get:
 *     tags: [Skills]
 *     summary: Get skill by ID
 *     description: Returns a skill's full details including its instructions.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill ID
 *     responses:
 *       200:
 *         description: Skill details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Skill not found
 *   patch:
 *     tags: [Skills]
 *     summary: Update a skill
 *     description: Updates skill metadata or instructions. Only the owner can update.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               instructions:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Skill updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Skill not found
 *   delete:
 *     tags: [Skills]
 *     summary: Delete a skill
 *     description: Permanently deletes a skill and its associated instruction file.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill ID
 *     responses:
 *       200:
 *         description: Skill deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Skill not found
 */
router.get('/:id', authMiddleware, skillController.getById);
router.patch(
  '/:id',
  authMiddleware,
  mutateLimiter,
  validateBody(updateSkillSchema),
  skillController.update
);
router.delete('/:id', authMiddleware, mutateLimiter, skillController.delete);

/**
 * @openapi
 * /api/v1/skills/{id}/agents:
 *   get:
 *     tags: [Skills]
 *     summary: List agents using a skill
 *     description: Returns all agents that reference this skill.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Skill ID
 *     responses:
 *       200:
 *         description: Agents list
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Skill not found
 */
router.get('/:id/agents', authMiddleware, skillController.getUsedByAgents);

export default router;
