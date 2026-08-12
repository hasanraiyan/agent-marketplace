import express from 'express';
import providerController from './provider.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createProviderSchema,
  updateProviderSchema,
  testConnectionSchema,
} from './provider.validator.js';

const router = express.Router();

// All provider routes require authentication
router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/providers:
 *   get:
 *     tags: [Providers]
 *     summary: List user's provider configurations
 *     description: Returns all LLM provider configurations for the authenticated user, including default model and connectivity flags.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: List of provider configurations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/', providerController.getAll);

/**
 * @openapi
 * /api/v1/providers:
 *   post:
 *     tags: [Providers]
 *     summary: Create a provider configuration
 *     description: Stores an LLM provider (e.g. OpenAI, Anthropic) with its API key. The key is encrypted at rest using AES-256-GCM. Providers are used by agents for inference.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [label, apiKey, defaultModel]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [openai, anthropic, gemini, deepseek, custom]
 *                 default: custom
 *                 description: Which LangChain integration/model-listing strategy to use. Native types (openai/anthropic/gemini/deepseek) resolve baseURL to a canonical preset if omitted.
 *               label:
 *                 type: string
 *                 description: Human-readable name (e.g. "My OpenAI Proxy")
 *               baseURL:
 *                 type: string
 *                 description: API base URL (e.g. https://api.openai.com/v1). Required only when type is "custom" — native types fill in a preset if omitted.
 *               apiKey:
 *                 type: string
 *                 description: Plaintext API key (encrypted at rest via AES-256-GCM)
 *               defaultModel:
 *                 type: string
 *                 description: Default model identifier (e.g. gpt-4o, claude-3-opus)
 *               isDefault:
 *                 type: boolean
 *                 description: Set as the default provider for newly created agents
 *     responses:
 *       201:
 *         description: Provider created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', mutateLimiter, validateBody(createProviderSchema), providerController.create);

/**
 * @openapi
 * /api/v1/providers/test-connection:
 *   post:
 *     tags: [Providers]
 *     summary: Test provider credentials
 *     description: Tests whether the given provider credentials (type + baseURL + apiKey) can successfully make an API call. Does not save the provider.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [openai, anthropic, gemini, deepseek, custom]
 *                 default: custom
 *               baseURL:
 *                 type: string
 *                 description: Required only when type is "custom".
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection test result with success/failure and error details
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/test-connection',
  mutateLimiter,
  validateBody(testConnectionSchema),
  providerController.testCredentials
);

/**
 * @openapi
 * /api/v1/providers/{id}:
 *   put:
 *     tags: [Providers]
 *     summary: Update a provider configuration
 *     description: Updates provider fields. Pass a new apiKey to rotate credentials.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [openai, anthropic, gemini, deepseek, custom]
 *                 description: Switching to "custom" requires baseURL in the same request.
 *               label:
 *                 type: string
 *               baseURL:
 *                 type: string
 *               apiKey:
 *                 type: string
 *                 description: New API key (leave empty to keep existing)
 *               defaultModel:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Provider updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 *   delete:
 *     tags: [Providers]
 *     summary: Delete a provider configuration
 *     description: Permanently deletes the provider and removes it from any agents that reference it.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID
 *     responses:
 *       200:
 *         description: Provider deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 */
router.put('/:id', mutateLimiter, validateBody(updateProviderSchema), providerController.update);
router.delete('/:id', mutateLimiter, providerController.remove);

/**
 * @openapi
 * /api/v1/providers/{id}/test:
 *   post:
 *     tags: [Providers]
 *     summary: Test connection for a specific provider
 *     description: Tests the saved provider configuration by making a live API call with its stored credentials.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID to test
 *     responses:
 *       200:
 *         description: Connection test result
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 */
router.post('/:id/test', mutateLimiter, providerController.testConnection);

/**
 * @openapi
 * /api/v1/providers/{id}/models:
 *   get:
 *     tags: [Providers]
 *     summary: List available models for a provider
 *     description: Queries the provider's API to list available models. Supports OpenAI-compatible /models endpoint.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider ID
 *     responses:
 *       200:
 *         description: List of available model identifiers
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Provider not found
 */
router.get('/:id/models', providerController.getModels);

export default router;
