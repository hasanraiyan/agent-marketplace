import User from '../models/User.js';
import Agent from '../models/Agent.js';
import Skill from '../modules/skills/skill.model.js';
import Provider from '../modules/providers/provider.model.js';
import Mcp from '../models/Mcp.js';
import McpUserConnection from '../models/McpUserConnection.js';
import Conversation from '../models/Conversation.js';
import checkpointService from '../services/checkpoint.service.js';
import { loggerService } from '../utils/index.js';
import config from '../config/index.js';

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
