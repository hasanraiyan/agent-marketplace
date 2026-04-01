import { verifyAccessToken } from '../services/auth.service.js';
import User from '../models/User.js';
import BaseError from '../utils/errors/BaseError.js';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BaseError('Access token required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new BaseError('User not found', 401, 'UNAUTHORIZED');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new BaseError('Invalid or expired token', 401, 'UNAUTHORIZED'));
    }
    next(error);
  }
};

export default authMiddleware;
