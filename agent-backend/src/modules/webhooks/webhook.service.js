import userRepository from '../users/user.repository.js';
import projectInvitationService from '../projects/projectInvitation.service.js';
import projectInvitationRepository from '../projects/projectInvitation.repository.js';
import { loggerService } from '../../utils/index.js';
import { NotFoundError, ValidationError } from '../../utils/errors/index.js';

const logger = loggerService.getLogger();

class WebhookService {
  /**
   * createUser - Handles user.created Clerk event
   */
  async createUser(data) {
    const { id, email_addresses, first_name, last_name, username } = data;
    const email = email_addresses[0]?.email_address;
    const name = `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous';

    let createdUser = null;
    try {
      createdUser = await userRepository.create({
        clerkId: id,
        email,
        name,
        username: username || undefined,
        role: 'normal',
      });
      logger.info(`Successfully created user ${id} in DB`);
    } catch (dbError) {
      if (dbError.code === 11000 || (dbError.message && dbError.message.includes('exists'))) {
        logger.info(`User ${id} or email ${email} already exists in DB, treating as success`);
      } else {
        logger.error('Error saving user to database:', dbError);
        throw dbError;
      }
    }

    // Grant Admin memberships for any pending Project invitations sent to
    // this email (AD-08 §11). Best-effort — must never fail user creation;
    // if the row already existed we still resolve (findByEmail below).
    try {
      const personaUserId = createdUser?._id ?? (await userRepository.findByEmail(email))._id;
      await projectInvitationService.resolvePendingForEmail(email, personaUserId);
    } catch (error) {
      logger.warn('Failed to resolve pending invitations on user.created', {
        error: error.message,
      });
    }
  }

  /**
   * handleInvitationCreated - Backfills the local invitation row for a
   * Clerk invitation whose local write failed after the Clerk call (orphan
   * healing). The normal path writes the row in the API at creation time.
   */
  async handleInvitationCreated(data) {
    try {
      await projectInvitationService.backfillCreatedInvitation(data);
    } catch (error) {
      logger.error('Error backfilling invitation on invitation.created:', error);
      throw error;
    }
  }

  /**
   * handleInvitationAccepted - Grants the Admin membership once the invitee
   * accepts (Clerk's invitation.accepted webhook).
   */
  async handleInvitationAccepted(data) {
    try {
      await projectInvitationService.handleInvitationAccepted(data);
    } catch (error) {
      logger.error('Error processing invitation.accepted:', error);
      throw error;
    }
  }

  /**
   * handleInvitationRevoked - Mirrors a Clerk-side revoke into the local row.
   */
  async handleInvitationRevoked(data) {
    try {
      await projectInvitationService.handleInvitationRevoked(data);
    } catch (error) {
      logger.error('Error processing invitation.revoked:', error);
      throw error;
    }
  }

  /**
   * updateUser - Handles user.updated Clerk event
   */
  async updateUser(data) {
    const { id, email_addresses, first_name, last_name, username } = data;
    const email = email_addresses[0]?.email_address;
    const name = `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous';

    try {
      let user;
      try {
        user = await userRepository.findByClerkId(id);
      } catch (error) {
        if (error instanceof NotFoundError) {
          logger.warn(`User ${id} not found for update, skipping`);
          return;
        }
        throw error;
      }

      await userRepository.update(user.id, {
        email,
        name,
        username: username || undefined,
      });
      logger.info(`Successfully updated user ${id} in DB`);
    } catch (dbError) {
      logger.error('Error updating user in database:', dbError);
      throw dbError;
    }
  }

  /**
   * deleteUser - Handles user.deleted Clerk event
   */
  async deleteUser(data) {
    const { id } = data;
    try {
      let user;
      try {
        user = await userRepository.findByClerkId(id);
      } catch (error) {
        if (error instanceof NotFoundError) {
          logger.warn(`User ${id} not found for deletion, skipping`);
          return;
        }
        throw error;
      }

      await userRepository.delete(user.id);
      logger.info(`Successfully deleted user ${id} from DB`);
    } catch (dbError) {
      logger.error('Error deleting user from database:', dbError);
      throw dbError;
    }
  }
}

export default new WebhookService();
