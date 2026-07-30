import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createMcpSchema, updateMcpSchema } from '../mcp/mcp.validator.js';
import developerMcpController from './developerMcp.controller.js';

/**
 * Developer MCP CRUD routes (blueprint Phase 9, PR-35). Reuses the existing
 * Persona createMcpSchema/updateMcpSchema unmodified — same reasoning as
 * developerSkill.routes.js: neither declares ownership fields, so Zod
 * already strips any attempt to inject them.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/mcps:
 *   post:
 *     tags: [Developer]
 *     summary: Create an MCP server (Project-owned or ExternalUser-owned)
 *     description: Which kind gets created depends on the credential's asserted identity, same as Developer Agent creation.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, transport, url]
 *     responses:
 *       201: { description: MCP server created }
 *       400: { description: Validation error }
 *       409: { description: An MCP server with this exact name already exists }
 */
router.post('/', validateBody(createMcpSchema), developerMcpController.create);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get an MCP server
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: MCP server }
 *       404: { description: MCP server not found (or not visible to this Domain/Subject) }
 *   patch:
 *     tags: [Developer]
 *     summary: Update an MCP server (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated MCP server }
 *       404: { description: MCP server not found or unauthorized }
 *       409: { description: Another MCP server with this name already exists }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete an MCP server (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: MCP server deleted }
 *       404: { description: MCP server not found or unauthorized }
 */
router.get('/:mcpId', developerMcpController.getOne);
router.patch('/:mcpId', validateBody(updateMcpSchema), developerMcpController.update);
router.delete('/:mcpId', developerMcpController.remove);

export default router;
