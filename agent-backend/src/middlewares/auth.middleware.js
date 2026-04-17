import { requireAuth, clerkMiddleware } from '@clerk/express';
import User from '../models/User.js';
import BaseError from '../utils/errors/BaseError.js';

const baseClerkMiddleware = clerkMiddleware();
const requireAuthMiddleware = requireAuth();

const authMiddleware = async (req, res, next) => {
  try {
    // 1. First run clerkMiddleware to parse the token into req.auth
    await new Promise((resolve, reject) => {
      baseClerkMiddleware(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // 2. Then run requireAuth to verify authentication state
    await new Promise((resolve, reject) => {
      requireAuthMiddleware(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const clerkId = req.auth.userId;

    if (!clerkId) {
      throw new BaseError('Access token required', 401, 'UNAUTHORIZED');
    }

    // Try finding the user by their Clerk ID (assuming clerkId mapped to some field, or maybe just email if sync not full)
    // Actually, usually sync creates a user using Clerk ID. We will assume the user has a clerkId field in our DB.
    // For now, let's map the user using the clerk ID in the DB. Wait, does our user schema have a clerkId field? We need to update User model.
    let user = await User.findOne({ clerkId });

    // In case webhook hasn't processed yet or this is a first-time use without webhook,
    // we could dynamically create them, or fail. We'll fail for now and rely on sync step.
    if (!user) {
      throw new BaseError('User not found in local database', 401, 'UNAUTHORIZED');
    }

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
