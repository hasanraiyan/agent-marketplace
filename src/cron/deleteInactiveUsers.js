import User from '../models/User.js';
import { loggerService } from '../utils/index.js';
import config from '../config/index.js';

const logger = loggerService.getLogger();

export default async function deleteInactiveUsers() {
  const retentionDays = config.cron.retentionDays;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await User.deleteMany({
    isActive: false,
    updatedAt: { $lt: cutoffDate },
  });

  if (result.deletedCount > 0) {
    logger.info(`Deleted ${result.deletedCount} inactive users older than ${retentionDays} days`);
  }

  return result;
}
