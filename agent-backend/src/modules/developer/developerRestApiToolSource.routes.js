import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createRestApiToolSourceSchema,
  updateRestApiToolSourceSchema,
} from '../restApiToolSources/restApiToolSource.validator.js';
import { bulkDeleteSchema } from '../../utils/validators/bulkDeleteSchema.js';
import { idempotency } from '../../middlewares/idempotencyMiddleware.js';
import developerRestApiToolSourceController from './developerRestApiToolSource.controller.js';

/**
 * Developer RestApiToolSource CRUD + Test Connection routes — discovery
 * protocol for REST API tools (mirrors developerMcp.routes.js).
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/rest-tool-sources:
 *   post:
 *     tags: [Developer]
 *     summary: Register a REST API tool source (a hosted manifest URL Persona pulls tool definitions from)
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
 *       201: { description: REST API tool source created }
 *       409: { description: A REST API tool source with this exact name already exists }
 *   get:
 *     tags: [Developer]
 *     summary: Discover REST API tool sources
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
 *       200: { description: "{ items: RestApiToolSource[], pagination: {...} }" }
 */
router.post(
  '/',
  idempotency(),
  validateBody(createRestApiToolSourceSchema),
  developerRestApiToolSourceController.create
);
router.get('/', developerRestApiToolSourceController.discover);

/**
 * @openapi
 * /api/v1/developer/rest-tool-sources/{sourceId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a REST API tool source
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: REST API tool source }
 *       404: { description: Not found or not visible to this Domain }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a REST API tool source (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated REST API tool source }
 *       409: { description: Another REST API tool source with this name already exists }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a REST API tool source (owner only) — cascades to every tool it discovered
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: REST API tool source deleted }
 *       404: { description: Not found or unauthorized }
 */
router.get('/:sourceId', developerRestApiToolSourceController.getOne);
router.patch(
  '/:sourceId',
  validateBody(updateRestApiToolSourceSchema),
  developerRestApiToolSourceController.update
);
router.delete('/:sourceId', developerRestApiToolSourceController.remove);

/**
 * @openapi
 * /api/v1/developer/rest-tool-sources/{sourceId}/usage:
 *   get:
 *     tags: [Developer]
 *     summary: See what this source discovered, and how many Agents use it, before attempting to delete it
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ toolCount, agentCount, tools }" }
 */
router.get('/:sourceId/usage', developerRestApiToolSourceController.getUsage);

/**
 * @openapi
 * /api/v1/developer/rest-tool-sources/{sourceId}/test:
 *   post:
 *     tags: [Developer]
 *     summary: Test Connection — fetches the source's URL and reconciles the discovered tool list
 *     description: >
 *       Always a full reconciliation (`prune: true`) — mirrors an MCP
 *       server's `testConnection` fully replacing its stored tool list every
 *       call. Materializes/updates real `RestApiTool` documents and removes
 *       ones no longer present in the manifest.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: sourceId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ created, updated, unchanged, deleted }" }
 *       400: { description: Manifest URL unreachable, non-2xx, or invalid payload }
 */
router.post('/:sourceId/test', developerRestApiToolSourceController.testConnection);

/**
 * @openapi
 * /api/v1/developer/rest-tool-sources/bulk-delete:
 *   post:
 *     tags: [Developer]
 *     summary: Delete multiple REST API tool sources in one call
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
router.post(
  '/bulk-delete',
  validateBody(bulkDeleteSchema),
  developerRestApiToolSourceController.bulkDelete
);

export default router;
