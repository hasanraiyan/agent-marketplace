import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createRestApiToolSchema,
  updateRestApiToolSchema,
  testRestApiToolSchema,
} from '../restApiTools/restApiTool.validator.js';
import { bulkDeleteSchema } from '../../utils/validators/bulkDeleteSchema.js';
import { idempotency } from '../../middlewares/idempotencyMiddleware.js';
import developerRestToolController from './developerRestTool.controller.js';

/**
 * Developer RestApiTool CRUD + test-call routes — the REST API Tool
 * Builder (PERSONA_REST_TOOL_REQUEST.md). Mirrors developerMcp.routes.js.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/rest-tools:
 *   post:
 *     tags: [Developer]
 *     summary: Create a REST API tool (Project-owned or ExternalUser-owned)
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
 *             required: [name, method, url]
 *     responses:
 *       201: { description: REST API tool created }
 *       409: { description: A REST API tool with this exact name already exists }
 *   get:
 *     tags: [Developer]
 *     summary: Discover REST API tools
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
 *       200: { description: "{ items: RestApiTool[], pagination: {...} }" }
 */
router.post(
  '/',
  idempotency(),
  validateBody(createRestApiToolSchema),
  developerRestToolController.create
);
router.get('/', developerRestToolController.discover);

/**
 * @openapi
 * /api/v1/developer/rest-tools/test:
 *   post:
 *     tags: [Developer]
 *     summary: Test-call an unsaved draft or a saved tool by id (the builder's "Send" button)
 *     description: >
 *       Never reachable from the agent tool-calling path. `testValues` may
 *       include `externalUserId` as a stand-in for testing a tool that
 *       references {{externalUserId}}, supplied by the authenticated
 *       tool-author themselves — never persisted, never usable by an agent.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toolId: { type: string }
 *               draft: { type: object }
 *               testValues: { type: object }
 *     responses:
 *       200: { description: "{ status, ok, body, mapped }" }
 *       400: { description: Missing toolId/draft, or a required template value }
 */
router.post('/test', validateBody(testRestApiToolSchema), developerRestToolController.test);

/**
 * @openapi
 * /api/v1/developer/rest-tools/{toolId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a REST API tool
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: toolId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: REST API tool }
 *       404: { description: Not found or not visible to this Domain/Subject }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a REST API tool (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: toolId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated REST API tool }
 *       409: { description: Another REST API tool with this name already exists }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a REST API tool (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: toolId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: REST API tool deleted }
 *       404: { description: Not found or unauthorized }
 */
router.get('/:toolId', developerRestToolController.getOne);
router.patch(
  '/:toolId',
  validateBody(updateRestApiToolSchema),
  developerRestToolController.update
);
router.delete('/:toolId', developerRestToolController.remove);

/**
 * @openapi
 * /api/v1/developer/rest-tools/{toolId}/usage:
 *   get:
 *     tags: [Developer]
 *     summary: See what's using this tool, before attempting to delete it
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: toolId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ agentCount, agents: [{ _id, name }] }" }
 */
router.get('/:toolId/usage', developerRestToolController.getUsage);

/**
 * @openapi
 * /api/v1/developer/rest-tools/{toolId}/test:
 *   post:
 *     tags: [Developer]
 *     summary: Test-call a saved REST API tool by id
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: toolId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ status, ok, body, mapped }" }
 */
router.post('/:toolId/test', developerRestToolController.test);

/**
 * @openapi
 * /api/v1/developer/rest-tools/bulk-delete:
 *   post:
 *     tags: [Developer]
 *     summary: Delete multiple REST API tools in one call
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
  developerRestToolController.bulkDelete
);

export default router;
