import { getAuth } from '@clerk/express';
import authService from './auth.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authState = getAuth(req);
    const clerkId = authState?.userId;

    if (clerkId) {
      try {
        const user = await authService.syncUser(clerkId);
        if (user) {
          req.user = user;
        }
      } catch (syncErr) {
        // Optional auth should not fail the request if sync fails, just log it
        logger.error('[OptionalAuth] Sync failed:', syncErr.message);
      }
    }
    next();
  } catch (error) {
    logger.error('[OptionalAuth] Error:', error.message);
    next();
  }
};

export default optionalAuthMiddleware;
