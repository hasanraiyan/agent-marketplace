import express from 'express';
import statusController from './status.controller.js';

const router = express.Router();

/**
 * @openapi
 * /api/v1/status:
 *   get:
 *     tags: [Status]
 *     summary: Public platform status
 *     description: >
 *       Public, unauthenticated (REQ-8, OnlyFounders). `latencyTargets`/
 *       `uptimeTargetPct` are stated goals, not measured SLIs — informal,
 *       not a contractual SLA. `status` reflects live database
 *       connectivity. `incidents` is empty until an incident-tracking
 *       system exists.
 *     responses:
 *       200:
 *         description: Current platform status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [operational, degraded] }
 *                 latencyTargets:
 *                   type: object
 *                   properties:
 *                     chatTimeToFirstTokenMsP95: { type: number }
 *                 uptimeTargetPct: { type: number }
 *                 incidents:
 *                   type: array
 *                   items: { type: object }
 */
router.get('/', statusController.getStatus);

export default router;
