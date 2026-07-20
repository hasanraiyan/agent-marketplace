import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import memoryController from './memory.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

router.use(authMiddleware);

// File-based memory: memories are markdown virtual files, the same ones agents
// read/write through their /memories/ filesystem routes.

/**
 * @openapi
 * /api/v1/memory:
 *   get:
 *     tags: [Memory]
 *     summary: List memory files
 *     description: Returns all memory files (markdown virtual files) for the authenticated user. These are the same files agents read/write through their filesystem routes.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: List of memory files with their content
 *       401:
 *         description: Unauthorized
 */
router.get('/', memoryController.getAll);

/**
 * @openapi
 * /api/v1/memory/file:
 *   put:
 *     tags: [Memory]
 *     summary: Write a memory file
 *     description: Creates or overwrites a memory file. Memories are markdown virtual files that persist agent context across sessions. Supports user and agent namespaces.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, content]
 *             properties:
 *               key:
 *                 type: string
 *                 description: Memory file key (filename without extension)
 *               content:
 *                 type: string
 *                 description: Memory content in markdown format
 *               namespace:
 *                 type: string
 *                 enum: [user, agent]
 *                 default: user
 *                 description: Memory namespace (user-level or agent-level)
 *     responses:
 *       200:
 *         description: Memory file written
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *   delete:
 *     tags: [Memory]
 *     summary: Delete a memory file
 *     description: Removes a specific memory file by key and namespace.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key]
 *             properties:
 *               key:
 *                 type: string
 *                 description: Memory file key to delete
 *               namespace:
 *                 type: string
 *                 enum: [user, agent]
 *                 default: user
 *                 description: Memory namespace
 *     responses:
 *       200:
 *         description: Memory file deleted
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put('/file', mutateLimiter, memoryController.writeFile);
router.delete('/file', mutateLimiter, memoryController.removeFile);

/**
 * @openapi
 * /api/v1/memory/all:
 *   delete:
 *     tags: [Memory]
 *     summary: Clear all memory
 *     description: Permanently deletes all memory files for the authenticated user. Irreversible.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: All memory cleared
 *       401:
 *         description: Unauthorized
 */
router.delete('/all', mutateLimiter, memoryController.clearAll);

export default router;
