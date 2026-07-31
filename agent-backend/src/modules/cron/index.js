import cron from 'node-cron';
import { loggerService } from '../../utils/index.js';
import config from '../../config/index.js';
import deleteInactiveUsers from './deleteInactiveUsers.js';
import discoverExpiredDeletions from './discoverExpiredDeletions.js';

const logger = loggerService.getLogger();

const jobs = [];

function registerJob(name, schedule, task) {
  if (process.env.DISABLE_CRON === 'true') {
    logger.info(`Cron job "${name}" disabled via DISABLE_CRON`);
    return;
  }

  const job = cron.schedule(schedule, async () => {
    logger.info(`Cron job "${name}" started`);
    try {
      await task();
      logger.info(`Cron job "${name}" completed`);
    } catch (error) {
      logger.error(`Cron job "${name}" failed:`, error);
    }
  });

  jobs.push({ name, job });
  logger.info(`Cron job "${name}" registered with schedule: ${schedule}`);
}

export function startAllCronJobs() {
  registerJob('deleteInactiveUsers', config.cron.deleteInactiveUsers, deleteInactiveUsers);
  registerJob(
    'discoverExpiredDeletions',
    config.cron.discoverExpiredDeletions,
    discoverExpiredDeletions
  );

  logger.info(`Registered ${jobs.length} cron jobs`);
}

export function stopAllCronJobs() {
  for (const { name, job } of jobs) {
    job.stop();
    logger.info(`Cron job "${name}" stopped`);
  }
  jobs.length = 0;
}

export default { startAllCronJobs, stopAllCronJobs };
