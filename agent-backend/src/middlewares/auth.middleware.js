import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';
import User from '../models/User.js';
import BaseError from '../utils/errors/BaseError.js';
import { loggerService } from '../utils/index.js';

const baseClerkMiddleware = clerkMiddleware();
const logger = loggerService.getLogger();

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Extract auth state using getAuth (populated by global clerkMiddleware)
    const authState = getAuth(req);
    const clerkId = authState?.userId;

    if (!clerkId) {
      throw new BaseError('Access token required', 401, 'UNAUTHORIZED');
    }

    // Try finding the user by their Clerk ID
    let user = await User.findOne({ clerkId });

    // Auto-sync fallback for users created before webhook integration, dropped databases, or email-only records
    if (!user) {
      try {
        logger.info(`Auto-syncing missing local user for Clerk ID: ${clerkId}`);
        const clerkUser = await clerkClient.users.getUser(clerkId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;

        if (!email) {
          throw new Error('Clerk user missing email address');
        }

        const name =
          `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Anonymous';
        const username = clerkUser.username || null;

        // Check if user exists by email but has a different/missing clerkId
        user = await User.findOne({ email });

        if (user) {
          logger.info(
            `Found existing user by email ${email}, updating with new Clerk ID ${clerkId}`
          );
          user.clerkId = clerkId;
          user.name = name; // Sync name while we're at it
          if (username) user.username = username;
          await user.save();
        } else {
          user = await User.create({
            clerkId,
            email,
            name,
            username: username || undefined,
            role: 'normal',
          });
          logger.info(`Successfully created new auto-synced user ${clerkId}`);
        }
      } catch (syncErr) {
        logger.error('Failed to auto-sync user from Clerk:', syncErr);
        throw new BaseError('User fallback synchronization failed', 401, 'UNAUTHORIZED');
      }
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
