import userRepository from './user.repository.js';
import threadRepository from '../threads/thread.repository.js';
import checkpointService from '../threads/checkpoint.service.js';
import agentRepository from '../agents/agent.repository.js';
import skillRepository from '../skills/skill.repository.js';
import providerRepository from '../providers/provider.repository.js';
import mcpRepository from '../mcp/mcp.repository.js';
import mcpUserConnectionRepository from '../mcp/mcp-user-connection.repository.js';
import projectMembershipService from '../projects/projectMembership.service.js';
import ValidationError from '../../utils/errors/ValidationError.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

class UserService {
  /**
   * Deletes a user profile and cleans up all associated resources (agents, skills, providers, threads, etc.).
   *
   * Developer Platform (blueprint Phase 10, PR-54, AD-08 §13): gains a
   * precondition — reject if the user is the sole remaining Admin of any
   * ACTIVE Project, mirroring `removeMember`'s existing last-Admin
   * invariant (AD-08 §12) applied to the indirect account-deletion path.
   * The cascade below is otherwise untouched.
   */
  async deleteUser(userId) {
    const blockingProject = await projectMembershipService.findSoleActiveAdminProject(userId);
    if (blockingProject) {
      throw new ValidationError(
        `Cannot delete your account while you are the sole remaining Admin of the ACTIVE ` +
          `Project "${blockingProject.name}" (AD-08 §13) — add another Admin, or suspend/delete ` +
          `the Project, first.`
      );
    }

    logger.info('User requested account deletion via service', { userId });

    // 1. Cleanup threads and their LangGraph checkpoints
    const { threadIds } = await threadRepository.deleteAllBySubject({ userId });
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
