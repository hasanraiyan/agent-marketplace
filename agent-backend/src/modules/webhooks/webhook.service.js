import userRepository from '../../repositories/userRepository.js';
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

    try {
      await userRepository.create({
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
