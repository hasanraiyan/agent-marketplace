import User from '../users/user.model.js';
import Agent from '../agents/agent.model.js';
import Skill from '../skills/skill.model.js';
import Provider from '../providers/provider.model.js';
import Mcp from '../mcp/mcp.model.js';
import McpUserConnection from '../mcp/mcp-user-connection.model.js';
import Conversation from '../threads/thread.model.js';
import checkpointService from '../threads/checkpoint.service.js';
import projectMembershipService from '../projects/projectMembership.service.js';
import { loggerService } from '../../utils/index.js';
import config from '../../config/index.js';

const logger = loggerService.getLogger();

export default async function deleteInactiveUsers() {
  const retentionDays = config.cron.retentionDays;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Find all users marked as inactive and past the retention period
  const usersToPurge = await User.find({
    isActive: false,
    updatedAt: { $lt: cutoffDate },
  });

  if (usersToPurge.length === 0) {
    return { deletedCount: 0 };
  }

  let deletedCount = 0;

  for (const user of usersToPurge) {
    try {
      const userId = user._id;

      // Developer Platform (blueprint Phase 10, PR-54, AD-08 §13, §42
      // open question #5, resolved): the same last-Admin precondition
      // `userService.deleteUser` now enforces — skip (never silently
      // orphan a Project) rather than reject, since this is a background
      // batch job with no caller to report an error to. The user simply
      // isn't purged this run; they'll be reconsidered next run once
      // they're no longer the sole Admin (or the Project is no longer
      // ACTIVE).
      const blockingProject = await projectMembershipService.findSoleActiveAdminProject(userId);
      if (blockingProject) {
        logger.warn(
          `Skipping purge of inactive user ${userId}: sole remaining Admin of ACTIVE Project ` +
            `"${blockingProject.name}" (${blockingProject._id})`
        );
        continue;
      }

      // 1. Cleanup threads and their LangGraph checkpoints
      const userThreads = await Conversation.find({ userId }).select('threadId');
      const threadIds = userThreads.map((t) => t.threadId);
      if (threadIds.length > 0) {
        await checkpointService.cleanupThreads(threadIds);
        await Conversation.deleteMany({ userId });
      }

      // 2. Delete all other user owned resources
      await Promise.all([
        Agent.deleteMany({ ownerId: userId }),
        Skill.deleteMany({ ownerId: userId }),
        Provider.deleteMany({ ownerId: userId }),
        Mcp.deleteMany({ ownerId: userId }),
        McpUserConnection.deleteMany({ userId }),
      ]);

      // 3. Finally delete the user document
      await User.findByIdAndDelete(userId);

      deletedCount++;
      logger.info(`Successfully purged user ${userId} and all associated data.`);
    } catch (error) {
      logger.error(`Failed to purge user ${user._id}:`, error);
      // Continue to next user
    }
  }

  if (deletedCount > 0) {
    logger.info(`Deleted ${deletedCount} inactive users older than ${retentionDays} days`);
  }

  return { deletedCount };
}
