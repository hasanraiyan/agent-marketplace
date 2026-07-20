import express from 'express';
import threadController from './thread.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createThreadSchema, updateThreadTitleSchema } from './thread.validator.js';

const router = express.Router();

// ALL thread endpoints strictly require authentication!
// Chatting is tied to account quotas/ownership in the system.
router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/threads:
 *   post:
 *     tags: [Threads]
 *     summary: Create a new thread
 *     description: Creates a new conversation thread linked to an agent. Returns the thread with an auto-generated LangGraph thread ID.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId]
 *             properties:
 *               agentId:
 *                 type: string
 *                 description: ID of the agent to chat with
 *               title:
 *                 type: string
 *                 description: Optional title for the thread (auto-generated if omitted)
 *     responses:
 *       201:
 *         description: Thread created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', mutateLimiter, validateBody(createThreadSchema), threadController.create);

/**
 * @openapi
 * /api/v1/threads:
 *   get:
 *     tags: [Threads]
 *     summary: List user threads
 *     description: Returns all conversation threads for the authenticated user, ordered by most recent activity.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: List of threads
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/', threadController.getAllByUser);

/**
 * @openapi
 * /api/v1/threads:
 *   delete:
 *     tags: [Threads]
 *     summary: Delete all user threads
 *     description: Permanently deletes every thread belonging to the authenticated user, including checkpoint data from the LangGraph checkpointer.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: All threads deleted
 *       401:
 *         description: Unauthorized
 */
router.delete('/', mutateLimiter, threadController.deleteAll);

/**
 * @openapi
 * /api/v1/threads/{id}:
 *   get:
 *     tags: [Threads]
 *     summary: Get a thread by ID
 *     description: Returns thread details including the agent ID, title, and timestamps.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Thread ID
 *     responses:
 *       200:
 *         description: Thread details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Thread not found
 *   delete:
 *     tags: [Threads]
 *     summary: Delete a single thread
 *     description: Permanently deletes a single thread and its checkpoint data.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Thread ID to delete
 *     responses:
 *       200:
 *         description: Thread deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Thread not found
 */
router.get('/:id', threadController.getOne);
router.delete('/:id', mutateLimiter, threadController.delete);

/**
 * @openapi
 * /api/v1/threads/{id}/title:
 *   patch:
 *     tags: [Threads]
 *     summary: Update thread title
 *     description: Changes the display title of a thread.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Thread ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 description: New thread title
 *     responses:
 *       200:
 *         description: Thread title updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Thread not found
 */
router.patch(
  '/:id/title',
  mutateLimiter,
  validateBody(updateThreadTitleSchema),
  threadController.updateTitle
);

/**
 * @openapi
 * /api/v1/threads/{id}/messages:
 *   get:
 *     tags: [Threads]
 *     summary: Get message history for a thread
 *     description: Retrieves the full message history for a thread, reconstructed from the LangGraph checkpointer's persisted graph state. Includes user messages, assistant responses, and subagent traces.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Thread ID
 *     responses:
 *       200:
 *         description: Message list with subagent traces
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Thread not found
 */
router.get('/:id/messages', threadController.getMessages);

export default router;
