import userRepository from './user.repository.js';
import threadRepository from '../threads/thread.repository.js';
import checkpointService from '../threads/checkpoint.service.js';
import agentRepository from '../agents/agent.repository.js';
import skillRepository from '../skills/skill.repository.js';
import providerRepository from '../providers/provider.repository.js';
import mcpRepository from '../mcp/mcp.repository.js';
import mcpUserConnectionRepository from '../mcp/mcp-user-connection.repository.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

class UserService {
  /**
   * Deletes a user profile and cleans up all associated resources (agents, skills, providers, threads, etc.).
   */
  async deleteUser(userId) {
    logger.info('User requested account deletion via service', { userId });

    // 1. Cleanup threads and their LangGraph checkpoints
    const { threadIds } = await threadRepository.deleteAllByUser(userId);
    if (threadIds && threadIds.length > 0) {
      await checkpointService.cleanupThreads(threadIds);
    }

    // 2. Delete all other user owned resources via repository calls
    await Promise.all([
      agentRepository.deleteManyByOwner(userId),
      skillRepository.deleteManyByOwner(userId),
      providerRepository.deleteManyByOwner(userId),
      mcpRepository.deleteManyByOwner(userId),
      mcpUserConnectionRepository.deleteManyByUser(userId),
    ]);

    // 3. Finally delete the user document
    await userRepository.delete(userId);

    logger.info('Account and all associated data deleted successfully via service', { userId });
    return true;
  }
}

export default new UserService();
