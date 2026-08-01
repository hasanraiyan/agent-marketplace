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
 * /api/v1/developer/mcps:
 *   get:
 *     tags: [Developer]
 *     summary: Discover MCP servers
 *     description: >
 *       A genuinely separate code path from any Persona listing. Mcp has
 *       no isPublic/visibility field, so unlike Agent/Skill/Knowledge
 *       there is no separate "public browse" subset — a bare Project
 *       credential OR a ProjectRuntimeContext without scope=mine both
 *       see every MCP in this Project's own Domain, any owner type.
 *       scope=mine (ProjectRuntimeContext only) narrows to just that
 *       external user's own MCPs.
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
 *       200: { description: List of MCP servers }
 */
router.get('/', developerMcpController.discover);

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

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/test:
 *   post:
 *     tags: [Developer]
 *     summary: Test an MCP server's connection (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Discovered tools/resources }
 *       404: { description: MCP server not found or unauthorized }
 */
router.post('/:mcpId/test', developerMcpController.testConnection);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/resource:
 *   get:
 *     tags: [Developer]
 *     summary: Read an MCP resource (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: uri
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Resource content }
 *       400: { description: Missing uri }
 *       404: { description: MCP server not found or unauthorized }
 */
router.get('/:mcpId/resource', developerMcpController.readResource);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/call-tool:
 *   post:
 *     tags: [Developer]
 *     summary: Call an MCP tool (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               arguments: { type: object }
 *     responses:
 *       200: { description: Tool result }
 *       400: { description: Missing tool name }
 *       404: { description: MCP server not found or unauthorized }
 */
router.post('/:mcpId/call-tool', developerMcpController.callTool);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/oauth/owner/authorize:
 *   get:
 *     tags: [Developer]
 *     summary: Start the owner OAuth flow (owner only)
 *     description: >
 *       No separate Developer callback route exists — the OAuth redirect
 *       URI is a single, pre-registered URL that completes via the
 *       existing Persona callback route regardless of who initiated the
 *       flow, since the signed state alone carries the initiating context.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Authorization URL }
 *       404: { description: MCP server not found or unauthorized }
 */
router.get('/:mcpId/oauth/owner/authorize', developerMcpController.getOwnerAuthorizeUrl);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/oauth/user/authorize:
 *   get:
 *     tags: [Developer]
 *     summary: Start the per-user OAuth flow (ProjectRuntimeContext only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Authorization URL }
 *       400: { description: No asserted external user }
 *       404: { description: "MCP server not found, wrong Domain, or not configured for per-user auth" }
 */
router.get('/:mcpId/oauth/user/authorize', developerMcpController.getUserAuthorizeUrl);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/oauth/user/status:
 *   get:
 *     tags: [Developer]
 *     summary: Get the calling Subject's own per-user connection status
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Connection status }
 */
router.get('/:mcpId/oauth/user/status', developerMcpController.getUserConnectionStatus);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/oauth/user/connection:
 *   delete:
 *     tags: [Developer]
 *     summary: Disconnect the calling Subject's own per-user connection
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Disconnected }
 */
router.delete('/:mcpId/oauth/user/connection', developerMcpController.disconnectUserConnection);

/**
 * @openapi
 * /api/v1/developer/mcps/{mcpId}/oauth/owner/connection:
 *   delete:
 *     tags: [Developer]
 *     summary: Disconnect the owner-mode connection (owner only)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: mcpId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Owner connection disconnected }
 *       404: { description: MCP server not found or unauthorized }
 */
router.delete('/:mcpId/oauth/owner/connection', developerMcpController.disconnectOwnerConnection);

export default router;
