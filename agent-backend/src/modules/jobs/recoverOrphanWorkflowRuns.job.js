import agenda from './agenda.js';
import { loggerService } from '../../utils/index.js';
import workflowRunRepository from '../developer/workflows/workflowRun.repository.js';
import workflowService from '../developer/workflows/workflow.service.js';
import { WorkflowRunDriver } from '../developer/workflows/workflowRunDriver.js';

const logger = loggerService.getLogger();

export const RECOVER_ORPHAN_WORKFLOW_RUNS_JOB = 'recover-orphan-workflow-runs';

/**
 * Background recovery job that scans for orphaned workflow runs whose server-side
 * execution driver was lost due to a backend process crash or restart (Phase 3.4).
 * Reuses Agenda on MongoDB (Zero Redis) and resumes execution from LangGraph MongoDB checkpoints.
 */
agenda.define(RECOVER_ORPHAN_WORKFLOW_RUNS_JOB, async (job) => {
  try {
    // 5-minute stale threshold to prevent premature recovery of live multi-step workflows (Finding #6 in review.md)
    const staleRuns = await workflowRunRepository.findOrphanRunningRuns(300000);

    for (const run of staleRuns) {
      const activeDriver = WorkflowRunDriver.get(run._id.toString());
      if (!activeDriver) {
        logger.warn(
          `[WorkflowRecovery] Found orphaned workflow run ${run._id} with no active in-memory driver. Attempting checkpoint resumption...`
        );

        // Resume from MongoDB checkpoint via workflowService (Finding #1 in review.md)
        await workflowService.resumeOrphanRun(run._id);
        logger.info(`[WorkflowRecovery] Processed orphan run recovery for ${run._id}`);
      }
    }
  } catch (error) {
    logger.error('[WorkflowRecovery] Error during orphan recovery scan:', error);
  }
});

// Schedule periodic recovery sweep
agenda.on('ready', async () => {
  try {
    await agenda.every('2 minutes', RECOVER_ORPHAN_WORKFLOW_RUNS_JOB);
  } catch (err) {
    logger.warn('[WorkflowRecovery] Failed to schedule recurring orphan recovery:', err.message);
  }
});
