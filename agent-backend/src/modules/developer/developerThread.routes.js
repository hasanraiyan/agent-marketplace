import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createThreadSchema, updateThreadSchema } from '../threads/thread.validator.js';
import { bulkDeleteSchema } from '../../utils/validators/bulkDeleteSchema.js';
import { idempotency } from '../../middlewares/idempotencyMiddleware.js';
import developerThreadController from './developerThread.controller.js';
import BaseError from '../../utils/errors/BaseError.js';

/**
 * Developer Thread CRUD routes (blueprint Phase 9, PR-40). Reuses the
 * existing Persona createThreadSchema/updateThreadTitleSchema unmodified.
 *
 * Every route additionally requires a `ProjectRuntimeContext` — a Thread's
 * Subject (AD-04 §15.3) is a person chatting, and only an asserted external
 * user (`x-persona-external-user-id`) has one; a bare Project credential
 * has no Subject to scope a conversation to. Mirrors
 * `developerAgui.routes.js`'s identical requirement for the same reason.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

router.use((req, res, next) => {
  if (req.projectContext?.principalType !== 'ProjectRuntime') {
    return next(
      new BaseError(
        'Managing Threads requires an asserted external user (x-persona-external-user-id)',
        400,
        'EXTERNAL_USER_REQUIRED'
      )
    );
  }
  next();
});

/**
 * @openapi
 * /api/v1/developer/threads:
 *   post:
 *     tags: [Developer]
 *     summary: Create a Thread for the asserted external user
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *       - name: Idempotency-Key
 *         in: header
 *         required: false
 *         schema: { type: string }
 *         description: Optional — a safe retry with the same key replays the original response instead of creating a duplicate Thread.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId]
 *     responses:
 *       201: { description: Thread created }
 *       400: { description: "Validation error, or no asserted external user" }
 *       404: { description: Agent not found (or not executable by this Domain/Subject) }
 *   get:
 *     tags: [Developer]
 *     summary: List the asserted external user's own Threads
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "{ items: Thread[], pagination: { total, page, limit, pages } }" }
 */
router.post('/', idempotency(), validateBody(createThreadSchema), developerThreadController.create);
router.get('/', developerThreadController.getAll);

/**
 * @openapi
 * /api/v1/developer/threads/{threadId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Thread
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: threadId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thread }
 *       404: { description: Thread not found (or not visible to this Domain/Subject) }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a Thread's title and/or archived status (Subject only)
 *     description: >
 *       Both fields are optional — send just `{ isArchived: true }` to
 *       archive a Thread without touching its title, or just `{ title }` to
 *       rename it, or both together.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: threadId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               isArchived: { type: boolean }
 *     responses:
 *       200: { description: Updated Thread }
 *       404: { description: Thread not found or unauthorized }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a Thread (Subject only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: threadId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thread deleted }
 *       404: { description: Thread not found or unauthorized }
 */
router.get('/:threadId', developerThreadController.getOne);
router.patch('/:threadId', validateBody(updateThreadSchema), developerThreadController.update);
router.delete('/:threadId', developerThreadController.remove);

/**
 * @openapi
 * /api/v1/developer/threads/{threadId}/reset:
 *   post:
 *     tags: [Developer]
 *     summary: Reset a Thread's conversation (Subject only)
 *     description: >
 *       Clears message history, workspace files/todos, and subagent traces
 *       in place — the Thread itself (its id and title) is kept, so it can
 *       be reused as a fresh conversation instead of creating a new one.
 *       Long-term agent memory is not affected.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: threadId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reset Thread }
 *       404: { description: Thread not found or unauthorized }
 */
router.post('/:threadId/reset', developerThreadController.reset);

/**
 * @openapi
 * /api/v1/developer/threads/bulk-delete:
 *   post:
 *     tags: [Developer]
 *     summary: Delete multiple of the asserted external user's own Threads in one call
 *     description: >
 *       Best-effort batch delete — one not-found id doesn't abort the
 *       rest. Up to 100 ids per request.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
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
 *       400: { description: "ids missing, empty, over 100 entries, or no asserted external user" }
 */
router.post('/bulk-delete', validateBody(bulkDeleteSchema), developerThreadController.bulkDelete);

/**
 * @openapi
 * /api/v1/developer/threads/{threadId}/messages:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Thread's message history
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: threadId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Message list with subagent traces }
 *       404: { description: Thread not found or unauthorized }
 */
router.get('/:threadId/messages', developerThreadController.getMessages);

export default router;
