import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createRcpSourceSchema, updateRcpSourceSchema } from '../rcpSources/rcpSource.validator.js';
import { bulkDeleteSchema } from '../../utils/validators/bulkDeleteSchema.js';
import { idempotency } from '../../middlewares/idempotencyMiddleware.js';
import developerRcpSourceController from './developerRcpSource.controller.js';

/**
 * Developer RcpSource CRUD + Test Connection routes — discovery protocol
 * for RCP (REST Connector Protocol, npm `rcp-sdk`) tools, independent of
 * REST Tool Sources (mirrors developerRestApiToolSource.routes.js's shape).
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/rcp-sources:
 *   post:
 *     tags: [Developer]
 *     summary: Register an RCP source (a hosted manifest URL Persona discovers tools from live, via rcp-sdk)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: Idempotency-Key
 *         in: header
 *         required: false
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, url]
 *     responses:
 *       201: { description: RCP source created }
 *       409: { description: An RCP source with this exact name already exists }
 *   get:
 *     tags: [Developer]
 *     summary: Discover RCP sources
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
 *     responses:
 *       200: { description: "{ items: RcpSource[], pagination: {...} }" }
 */
router.post('/', idempotency(), validateBody(createRcpSourceSchema), developerRcpSourceController.create);
router.get('/', developerRcpSourceController.discover);

/**
 * @openapi
 * /api/v1/developer/rcp-sources/{sourceId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get an RCP source
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: RCP source }
 *       404: { description: Not found or not visible to this Domain }
 *   patch:
 *     tags: [Developer]
 *     summary: Update an RCP source (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated RCP source }
 *       409: { description: Another RCP source with this name already exists }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete an RCP source (owner only) — detaches it from every Agent using it
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: RCP source deleted }
 *       404: { description: Not found or unauthorized }
 */
router.get('/:sourceId', developerRcpSourceController.getOne);
router.patch('/:sourceId', validateBody(updateRcpSourceSchema), developerRcpSourceController.update);
router.delete('/:sourceId', developerRcpSourceController.remove);

/**
 * @openapi
 * /api/v1/developer/rcp-sources/{sourceId}/usage:
 *   get:
 *     tags: [Developer]
 *     summary: See how many Agents use this source before attempting to delete it
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ agentCount, agents }" }
 */
router.get('/:sourceId/usage', developerRcpSourceController.getUsage);

/**
 * @openapi
 * /api/v1/developer/rcp-sources/{sourceId}/test:
 *   post:
 *     tags: [Developer]
 *     summary: Test Connection — discovers the source's manifest via rcp-sdk and stores a display-only tool summary
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ tools }" }
 *       400: { description: Manifest unreachable, non-2xx, invalid payload, or unsupported rcpVersion }
 */
router.post('/:sourceId/test', developerRcpSourceController.testConnection);

/**
 * @openapi
 * /api/v1/developer/rcp-sources/bulk-delete:
 *   post:
 *     tags: [Developer]
 *     summary: Delete multiple RCP sources in one call
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: string }, maxItems: 100 }
 *     responses:
 *       200: { description: "{ deleted: string[], failed: [{ id, reason }] }" }
 */
router.post('/bulk-delete', validateBody(bulkDeleteSchema), developerRcpSourceController.bulkDelete);

export default router;
