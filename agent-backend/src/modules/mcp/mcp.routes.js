import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createMcpSchema, updateMcpSchema } from './mcp.validator.js';
import mcpController from './mcp.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

// OAuth callbacks are hit by the external authorization server's browser
// redirect - there is no Clerk session on that request, so these two routes
// deliberately do NOT use authMiddleware. They are also deliberately NOT
// nested under /:id: an OAuth provider's "redirect URIs" allowlist must be
// registered in advance with a fixed URL, but an Mcp's _id doesn't exist
// until after it's created - so the path can't depend on it. Identity
// (mcpId, userId, mode) is recovered entirely from the signed `state` param
// instead (see oauth-state.js).

/**
 * @openapi
 * /api/v1/mcps/oauth/owner/callback:
 *   get:
 *     tags: [MCP OAuth]
 *     summary: OAuth callback for owner-mode authorization
 *     description: >
 *       Called by the external OAuth provider after the MCP owner grants access.
 *       Has NO auth middleware — the external auth server redirects the browser
 *       here and there is no Clerk session on that request. Identity (mcpId,
 *       userId, mode) is recovered from the signed HMAC-SHA256 `state` parameter.
 *     responses:
 *       302:
 *         description: Redirect to the application with the auth result
 */
router.get('/oauth/owner/callback', mcpController.ownerCallback);

/**
 * @openapi
 * /api/v1/mcps/oauth/user/callback:
 *   get:
 *     tags: [MCP OAuth]
 *     summary: OAuth callback for user-mode authorization
 *     description: >
 *       Called by the external OAuth provider after an end-user grants access.
 *       Same no-auth pattern as the owner callback — identity is recovered from
 *       the signed `state` parameter.
 *     responses:
 *       302:
 *         description: Redirect to the application with the auth result
 */
router.get('/oauth/user/callback', mcpController.userCallback);

router.use(authMiddleware);

/**
 * @openapi
 * /api/v1/mcps:
 *   get:
 *     tags: [MCP]
 *     summary: List MCP servers
 *     description: Returns all MCP server connectors configured by the authenticated user.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: MCP servers list
 *       401:
 *         description: Unauthorized
 *   post:
 *     tags: [MCP]
 *     summary: Create an MCP server connector
 *     description: Creates a new MCP (Model Context Protocol) server configuration. Supports HTTP and SSE transports with optional OAuth or API key authentication.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, transport, url]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Display name for the MCP server
 *               transport:
 *                 type: string
 *                 enum: [http, sse]
 *                 description: Transport protocol
 *               url:
 *                 type: string
 *                 description: MCP server URL
 *               authType:
 *                 type: string
 *                 enum: [none, oauth, apiKey]
 *                 default: none
 *                 description: Authentication type required by the MCP server
 *               authMode:
 *                 type: string
 *                 enum: [owner, user]
 *                 description: Who performs the OAuth flow (owner = admin, user = end-user)
 *               apiKey:
 *                 type: string
 *                 description: API key for authType=apiKey (encrypted at rest)
 *     responses:
 *       201:
 *         description: MCP server created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', mcpController.getMyMcps);
router.post('/', mutateLimiter, validateBody(createMcpSchema), mcpController.create);

/**
 * @openapi
 * /api/v1/mcps/{id}:
 *   get:
 *     tags: [MCP]
 *     summary: Get MCP server details
 *     description: Returns the MCP server configuration including auth status.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: MCP server details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 *   patch:
 *     tags: [MCP]
 *     summary: Update MCP server
 *     description: Updates MCP server configuration fields.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               transport:
 *                 type: string
 *                 enum: [http, sse]
 *               url:
 *                 type: string
 *               authType:
 *                 type: string
 *                 enum: [none, oauth, apiKey]
 *               isEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: MCP server updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 *   delete:
 *     tags: [MCP]
 *     summary: Delete MCP server
 *     description: Permanently deletes the MCP server connector and its OAuth tokens.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: MCP server deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.get('/:id', mcpController.getById);
router.patch('/:id', mutateLimiter, validateBody(updateMcpSchema), mcpController.update);
router.delete('/:id', mutateLimiter, mcpController.delete);

/**
 * @openapi
 * /api/v1/mcps/{id}/agents:
 *   get:
 *     tags: [MCP]
 *     summary: List agents using this MCP server
 *     description: Returns all agents that have this MCP server configured as a tool source.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Agents list
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.get('/:id/agents', mcpController.getUsedByAgents);

/**
 * @openapi
 * /api/v1/mcps/{id}/test:
 *   post:
 *     tags: [MCP]
 *     summary: Test MCP server connection
 *     description: Attempts to connect to the MCP server and list its available tools/resources to verify the configuration works.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Connection test result with available tools and resources
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.post('/:id/test', mutateLimiter, mcpController.testConnection);

/**
 * @openapi
 * /api/v1/mcps/{id}/resource:
 *   get:
 *     tags: [MCP]
 *     summary: Read an MCP resource
 *     description: Reads a resource exposed by the MCP server (e.g. files, database tables, API endpoints). The resource URI is passed as a query parameter.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Resource content
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.get('/:id/resource', mcpController.readResource);

/**
 * @openapi
 * /api/v1/mcps/{id}/call-tool:
 *   post:
 *     tags: [MCP]
 *     summary: Call an MCP tool directly
 *     description: Invokes a tool on the MCP server directly (bypasses the agent runtime). Used for testing tool configurations.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Tool call result
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.post('/:id/call-tool', mutateLimiter, mcpController.callTool);

/**
 * @openapi
 * /api/v1/mcps/{id}/oauth/owner/authorize:
 *   get:
 *     tags: [MCP OAuth]
 *     summary: Get OAuth authorization URL (owner mode)
 *     description: >
 *       Generates and returns the authorization URL for the MCP owner to visit.
 *       Uses OAuth 2.0 with PKCE and Dynamic Client Registration (RFC 7591).
 *       The state parameter is signed with HMAC-SHA256 to prevent CSRF attacks.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Authorization URL for browser redirect
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.get('/:id/oauth/owner/authorize', mcpController.getOwnerAuthorizeUrl);

/**
 * @openapi
 * /api/v1/mcps/{id}/oauth/user/authorize:
 *   get:
 *     tags: [MCP OAuth]
 *     summary: Get OAuth authorization URL (user mode)
 *     description: >
 *       Similar to owner authorize but for end-users. The MCP server's OAuth
 *       client must support per-user access tokens. The state parameter encodes
 *       the specific user making the request.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Authorization URL for browser redirect
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.get('/:id/oauth/user/authorize', mcpController.getUserAuthorizeUrl);

/**
 * @openapi
 * /api/v1/mcps/{id}/oauth/user/status:
 *   get:
 *     tags: [MCP OAuth]
 *     summary: Check user OAuth connection status
 *     description: Checks whether the current user has an active OAuth connection to this MCP server.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Connection status (connected/disconnected with token metadata)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server not found
 */
router.get('/:id/oauth/user/status', mcpController.getUserConnectionStatus);

/**
 * @openapi
 * /api/v1/mcps/{id}/oauth/user/connection:
 *   delete:
 *     tags: [MCP OAuth]
 *     summary: Disconnect user OAuth connection
 *     description: Revokes the user's OAuth access token for this MCP server.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: OAuth connection disconnected
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server or connection not found
 */
router.delete('/:id/oauth/user/connection', mutateLimiter, mcpController.disconnectUserConnection);

/**
 * @openapi
 * /api/v1/mcps/{id}/oauth/owner/connection:
 *   delete:
 *     tags: [MCP OAuth]
 *     summary: Disconnect owner OAuth connection
 *     description: Revokes the owner's OAuth access token for this MCP server.
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: OAuth connection disconnected
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: MCP server or connection not found
 */
router.delete(
  '/:id/oauth/owner/connection',
  mutateLimiter,
  mcpController.disconnectOwnerConnection
);

export default router;
