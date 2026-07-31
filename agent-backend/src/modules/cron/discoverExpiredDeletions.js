import Project from '../projects/project.model.js';
import { PROJECT_STATUS } from '../projects/project.model.js';
import config from '../../config/index.js';
import { enqueueProjectCleanup } from '../jobs/cleanupDeletedProject.job.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Developer Platform (blueprint Phase 10, PR-53, AD-08 §28). The
 * `node-cron` half of the deletion pipeline — a discovery *trigger* only,
 * exactly as §28 specifies: it finds Projects past their deletion grace
 * period and enqueues the actual cleanup as a durable Agenda job
 * (`cleanupDeletedProject.job.js`); it never performs the cleanup itself.
 */
export default async function discoverExpiredDeletions() {
  const gracePeriodMs = config.projects.deletionGracePeriodDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - gracePeriodMs);

  const expiredProjects = await Project.find({
    status: PROJECT_STATUS.DELETING,
    deletionRequestedAt: { $lt: cutoff },
  }).select('_id');

  for (const project of expiredProjects) {
    await enqueueProjectCleanup(project._id);
    logger.info(`[discoverExpiredDeletions] Enqueued cleanup for Project ${project._id}`);
  }

  return { enqueuedCount: expiredProjects.length };
}
