import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createProjectSecretSchema,
  updateProjectSecretSchema,
} from '../projects/projectSecret.validator.js';
import { bulkDeleteSchema } from '../../utils/validators/bulkDeleteSchema.js';
import { idempotency } from '../../middlewares/idempotencyMiddleware.js';
import developerSecretController from './developerSecret.controller.js';

/**
 * Developer ProjectSecret CRUD routes — project-level secret management for
 * the REST API Tool Builder's Auth tab (PERSONA_REST_TOOL_REQUEST.md item
 * 2). Mirrors developerMcp.routes.js exactly.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/secrets:
 *   post:
 *     tags: [Developer]
 *     summary: Create a Project secret
 *     description: >
 *       The plaintext value is stored reversibly encrypted and is never
 *       returned by this or any other endpoint, including this one — the
 *       caller already has the plaintext, since they just supplied it.
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
 *             required: [label, value]
 *             properties:
 *               label: { type: string }
 *               value: { type: string }
 *     responses:
 *       201: { description: Secret created (value never included in the response) }
 *       409: { description: A secret with this exact label already exists }
 *   get:
 *     tags: [Developer]
 *     summary: List this Project's secrets
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200: { description: "Secret[] (label + metadata only, never the value)" }
 */
router.post(
  '/',
  idempotency(),
  validateBody(createProjectSecretSchema),
  developerSecretController.create
);
router.get('/', developerSecretController.list);

/**
 * @openapi
 * /api/v1/developer/secrets/{secretId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Project secret's metadata
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: secretId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Secret metadata }
 *       404: { description: Not found or unauthorized }
 *   patch:
 *     tags: [Developer]
 *     summary: Rename a secret or rotate its value
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: secretId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated secret metadata }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a secret
 *     description: Blocked while any REST API tool still references it — see the usage endpoint.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: secretId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Secret deleted }
 *       400: { description: Still referenced by one or more REST API tools }
 *       404: { description: Not found or unauthorized }
 */
router.get('/:secretId', developerSecretController.getOne);
router.patch(
  '/:secretId',
  validateBody(updateProjectSecretSchema),
  developerSecretController.update
);
router.delete('/:secretId', developerSecretController.remove);

/**
 * @openapi
 * /api/v1/developer/secrets/{secretId}/usage:
 *   get:
 *     tags: [Developer]
 *     summary: See what's using this secret, before attempting to delete it
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: secretId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ restApiToolCount, restApiTools: [{ _id, name }] }" }
 */
router.get('/:secretId/usage', developerSecretController.getUsage);

/**
 * @openapi
 * /api/v1/developer/secrets/bulk-delete:
 *   post:
 *     tags: [Developer]
 *     summary: Delete multiple secrets in one call
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
router.post('/bulk-delete', validateBody(bulkDeleteSchema), developerSecretController.bulkDelete);

export default router;
