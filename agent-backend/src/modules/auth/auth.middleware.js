import { getAuth } from '@clerk/express';
import authService from './auth.service.js';
import BaseError from '../../utils/errors/BaseError.js';

const authMiddleware = async (req, res, next) => {
  try {
    const authState = getAuth(req);
    const clerkId = authState?.userId;

    if (!clerkId) {
      throw new BaseError('Access token required', 401, 'UNAUTHORIZED');
    }

    const user = await authService.syncUser(clerkId);
    req.user = user;
    next();
  } catch (error) {
    if (error.message && error.message.includes('Unauthenticated')) {
      return next(new BaseError('Invalid or expired token', 401, 'UNAUTHORIZED'));
    }
    next(error);
  }
};

export default authMiddleware;
