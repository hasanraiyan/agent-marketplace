import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../../middlewares/rateLimiter.middleware.js';
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
router.get('/oauth/owner/callback', mcpController.ownerCallback);
router.get('/oauth/user/callback', mcpController.userCallback);

router.use(authMiddleware);

router.get('/', mcpController.getMyMcps);
router.post('/', mutateLimiter, validateBody(createMcpSchema), mcpController.create);
router.get('/:id', mcpController.getById);
router.get('/:id/agents', mcpController.getUsedByAgents);
router.patch('/:id', mutateLimiter, validateBody(updateMcpSchema), mcpController.update);
router.delete('/:id', mutateLimiter, mcpController.delete);

router.post('/:id/test', mutateLimiter, mcpController.testConnection);
router.get('/:id/resource', mcpController.readResource);
router.post('/:id/call-tool', mutateLimiter, mcpController.callTool);

router.get('/:id/oauth/owner/authorize', mcpController.getOwnerAuthorizeUrl);
router.get('/:id/oauth/user/authorize', mcpController.getUserAuthorizeUrl);
router.get('/:id/oauth/user/status', mcpController.getUserConnectionStatus);
router.delete('/:id/oauth/user/connection', mutateLimiter, mcpController.disconnectUserConnection);
router.delete(
  '/:id/oauth/owner/connection',
  mutateLimiter,
  mcpController.disconnectOwnerConnection
);

export default router;
