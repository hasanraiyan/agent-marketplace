import express from 'express';
import healthController from './health.controller.js';

const router = express.Router();

/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Server health check
 *     description: Returns basic server status and uptime information.
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.get('/', healthController.getHealth);

/**
 * @openapi
 * /api/v1/health/db:
 *   get:
 *     tags: [Health]
 *     summary: Database connectivity health check
 *     description: Tests the MongoDB connection and reports whether the database is reachable.
 *     responses:
 *       200:
 *         description: Database is connected and responsive
 *       503:
 *         description: Database is disconnected or unreachable
 */
router.get('/db', healthController.getDbHealth);

export default router;
