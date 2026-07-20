import express from 'express';
import agentController from './agent.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import optionalAuthMiddleware from '../auth/optional-auth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createAgentSchema,
  updateAgentSchema,
  searchAgentSchema,
  countAgentSchema,
} from './agent.validator.js';

const router = express.Router();

// --- Public/Optional Auth Routes ---
// These routes handle their own internal visibility/security checks.

/**
 * @openapi
 * /api/v1/agents/search:
 *   post:
 *     tags: [Agents]
 *     summary: Search agents with filters
 *     description: |
 *       Searches agents with full-text and category filtering. Works with optional auth:
 *       authenticated users see their own private agents, unauthenticated requests see
 *       only public agents. Supports pagination.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 type: string
 *                 description: Full-text search across name and description
 *               category:
 *                 type: string
 *                 enum: [productivity, coding, creative, research, roleplay, other]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               ownerId:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [private, unlisted, public]
 *               page:
 *                 type: integer
 *                 default: 1
 *               limit:
 *                 type: integer
 *                 default: 10
 *     responses:
 *       200:
 *         description: Paginated search results with agent items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post(
  '/search',
  optionalAuthMiddleware,
  validateBody(searchAgentSchema),
  agentController.search
);

/**
 * @openapi
 * /api/v1/agents/count:
 *   post:
 *     tags: [Agents]
 *     summary: Count agents matching filters
 *     description: Returns the count of agents matching the given filters, without returning the items. Useful for building UI counters. Works with optional auth.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [productivity, coding, creative, research, roleplay, other]
 *     responses:
 *       200:
 *         description: Count result
 */
router.post(
  '/count',
  optionalAuthMiddleware,
  validateBody(countAgentSchema),
  agentController.count
);

/**
 * @openapi
 * /api/v1/agents/slug/{slug}:
 *   get:
 *     tags: [Agents]
 *     summary: Get agent by URL slug
 *     description: Public endpoint. Returns agent details by their human-readable URL slug. No authentication required.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: URL slug (e.g. "my-coding-assistant")
 *     responses:
 *       200:
 *         description: Agent details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Agent not found
 */
router.get('/slug/:slug', optionalAuthMiddleware, agentController.getBySlug);

/**
 * @openapi
 * /api/v1/agents/{id}:
 *   get:
 *     tags: [Agents]
 *     summary: Get agent by ID
 *     description: Returns agent details by internal MongoDB ID. Auth-optional — unauthenticated requests see only public agents.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent details
 *       404:
 *         description: Agent not found
 */
router.get('/:id', optionalAuthMiddleware, agentController.getOne);

// --- Protected Routes ---
// These routes strictly require an authenticated user.
router.use(authMiddleware);

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/agents/{id}/memory:
 *   get:
 *     tags: [Agents]
 *     summary: Get agent-specific memory
 *     description: Retrieves the persistent memory data stored for this agent, including learned preferences and past context.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent memory data (key-value store)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.get('/:id/memory', agentController.getMemory);

/**
 * @openapi
 * /api/v1/agents/{id}/memory/{key}:
 *   delete:
 *     tags: [Agents]
 *     summary: Delete a specific memory key
 *     description: Removes a single key from the agent's persistent memory store.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Memory key to delete
 *     responses:
 *       200:
 *         description: Memory key deleted
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id/memory/:key', agentController.deleteMemory);

/**
 * @openapi
 * /api/v1/agents:
 *   post:
 *     tags: [Agents]
 *     summary: Create a new agent
 *     description: Creates an agent with a system prompt, assigned LLM provider, and configuration options like web search and visibility.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, systemPrompt, providerId]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Agent display name
 *               description:
 *                 type: string
 *                 description: Short description of what the agent does
 *               systemPrompt:
 *                 type: string
 *                 description: The system prompt that defines agent behavior and personality
 *               providerId:
 *                 type: string
 *                 description: ID of the LLM provider this agent will use
 *               modelName:
 *                 type: string
 *                 description: Model identifier (overrides provider's defaultModel)
 *               webSearchEnabled:
 *                 type: boolean
 *                 default: false
 *                 description: Enable web search capability (uses Tavily)
 *               visibility:
 *                 type: string
 *                 enum: [private, unlisted, public]
 *                 default: private
 *               category:
 *                 type: string
 *                 enum: [productivity, coding, creative, research, roleplay, other]
 *     responses:
 *       201:
 *         description: Agent created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', mutateLimiter, validateBody(createAgentSchema), agentController.create);

/**
 * @openapi
 * /api/v1/agents/{id}:
 *   patch:
 *     tags: [Agents]
 *     summary: Update an agent
 *     description: Updates agent configuration fields. Only the provided fields are changed.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               systemPrompt:
 *                 type: string
 *               modelName:
 *                 type: string
 *               webSearchEnabled:
 *                 type: boolean
 *               visibility:
 *                 type: string
 *                 enum: [private, unlisted, public]
 *               category:
 *                 type: string
 *                 enum: [productivity, coding, creative, research, roleplay, other]
 *     responses:
 *       200:
 *         description: Agent updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 *   delete:
 *     tags: [Agents]
 *     summary: Delete an agent
 *     description: Permanently deletes the agent and its associated threads and memory.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Agent not found
 */
router.patch('/:id', mutateLimiter, validateBody(updateAgentSchema), agentController.update);
router.delete('/:id', mutateLimiter, agentController.remove);

export default router;
