import express from 'express';
import adminController from './admin.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import adminMiddleware from './admin.middleware.js';

const router = express.Router();

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (admin only)
 *     description: Returns a paginated list of all registered users. Requires the admin role.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — requires admin role
 */
router.get('/users', authMiddleware, adminMiddleware, adminController.listUsers);

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Permanently delete a user (admin only)
 *     description: Hard-deletes the specified user and all associated data (agents, threads, providers, skills, MCP servers, knowledge bases, memories, uploads) from the database.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to permanently delete
 *     responses:
 *       200:
 *         description: User and all associated data permanently deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — requires admin role
 *       404:
 *         description: User not found
 */
router.delete('/users/:id', authMiddleware, adminMiddleware, adminController.deleteUser);

export default router;
