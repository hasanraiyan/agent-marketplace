import { verifyAccessToken } from '../services/auth.service.js';
import User from '../models/User.js';

/**
 * Optional authentication middleware.
 * If a token is provided and valid, req.user will be populated.
 * If no token is provided, or the token is invalid, it securely continues without populating req.user.
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue anonymously
    }

    const token = authHeader.split(' ')[1];
    
    // Use try/catch specifically for the token verification so invalid tokens
    // just result in an anonymous session rather than crashing the request.
    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    } catch (err) {
      // Invalid/expired token -> silent fallback to anonymous
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default optionalAuthMiddleware;
