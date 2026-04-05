import BaseError from '../utils/errors/BaseError.js';

const adminMiddleware = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      throw new BaseError('Admin access required', 403, 'FORBIDDEN');
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default adminMiddleware;
