import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createProviderSchema, updateProviderSchema } from '../providers/provider.validator.js';
import developerProviderController from './developerProvider.controller.js';

/**
 * Developer Provider CRUD routes (blueprint Phase 9, PR-38). Reuses the
 * existing Persona createProviderSchema/updateProviderSchema unmodified —
 * same reasoning as developerMcp.routes.js: neither declares ownership
 * fields, so Zod already strips any attempt to inject them.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/providers:
 *   post:
 *     tags: [Developer]
 *     summary: Create a Provider (Project-owned)
 *     description: Provider ownership is narrower than other Developer resources (AD-06 §21) — PersonaUser/Project only, never ExternalUser.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, baseURL, apiKey, defaultModel]
 *     responses:
 *       201: { description: Provider created }
 *       400: { description: Validation error, or an ExternalUser-asserted request (unsupported for Providers) }
 */
router.post('/', validateBody(createProviderSchema), developerProviderController.create);

/**
 * @openapi
 * /api/v1/developer/providers/{providerId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Provider
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: providerId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Provider }
 *       404: { description: Provider not found (or not visible to this Domain) }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a Provider (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: providerId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated Provider }
 *       404: { description: Provider not found or unauthorized }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a Provider (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: providerId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Provider deleted }
 *       404: { description: Provider not found or unauthorized }
 */
router.get('/:providerId', developerProviderController.getOne);
router.patch(
  '/:providerId',
  validateBody(updateProviderSchema),
  developerProviderController.update
);
router.delete('/:providerId', developerProviderController.remove);

/**
 * @openapi
 * /api/v1/developer/providers/{providerId}/test-connection:
 *   post:
 *     tags: [Developer]
 *     summary: Test a Provider's credentials (owner only, blueprint Phase 9, PR-47a)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: providerId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Connection successful }
 *       400: { description: Connection failed }
 *       404: { description: Provider not found or unauthorized }
 */
router.post('/:providerId/test-connection', developerProviderController.testConnection);

/**
 * @openapi
 * /api/v1/developer/providers/{providerId}/models:
 *   get:
 *     tags: [Developer]
 *     summary: List a Provider's available models (owner only, blueprint Phase 9, PR-47a)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: providerId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Model list }
 *       404: { description: Provider not found or unauthorized }
 */
router.get('/:providerId/models', developerProviderController.getModels);

export default router;
