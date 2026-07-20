import { clerkClient } from '@clerk/express';
import userRepository from '../users/user.repository.js';
import { loggerService } from '../../utils/index.js';
import { NotFoundError } from '../../utils/errors/index.js';
import BaseError from '../../utils/errors/BaseError.js';

const logger = loggerService.getLogger();

class AuthService {
  /**
   * Find a user by clerkId, or sync/create them from Clerk if they do not exist locally.
   * @param {string} clerkId
   * @returns {Promise<Object>} Synchronized user
   */
  async syncUser(clerkId) {
    if (!clerkId) {
      return null;
    }

    try {
      // 1. Try to find the user locally by Clerk ID
      return await userRepository.findByClerkId(clerkId);
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }

    // 2. Fallback auto-sync from Clerk
    try {
      logger.info(`Auto-syncing missing local user for Clerk ID: ${clerkId}`);
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;

      if (!email) {
        throw new Error('Clerk user missing email address');
      }

      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Anonymous';
      const username = clerkUser.username || null;

      let user;
      try {
        // Check if user exists by email but has a different/missing clerkId
        user = await userRepository.findByEmail(email);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }

      if (user) {
        logger.info(`Found existing user by email ${email}, updating with new Clerk ID ${clerkId}`);
        const updateData = {
          clerkId,
          name,
        };
        if (username) {
          updateData.username = username;
        }
        user = await userRepository.update(user.id, updateData);
      } else {
        const createData = {
          clerkId,
          email,
          name,
          role: 'normal',
        };
        if (username) {
          createData.username = username;
        }
        user = await userRepository.create(createData);
        logger.info(`Successfully created new auto-synced user ${clerkId}`);
      }

      return user;
    } catch (syncErr) {
      logger.error('Failed to auto-sync user from Clerk:', syncErr);
      throw new BaseError('User fallback synchronization failed', 401, 'UNAUTHORIZED');
    }
  }
}

export default new AuthService();
