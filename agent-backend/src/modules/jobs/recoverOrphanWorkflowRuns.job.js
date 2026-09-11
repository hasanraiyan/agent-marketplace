import agenda from './agenda.js';
import { loggerService } from '../../utils/index.js';
import workflowRunRepository from '../developer/workflows/workflowRun.repository.js';
import workflowRepository from '../developer/workflows/workflow.repository.js';
import { WorkflowRunDriver } from '../developer/workflows/workflowRunDriver.js';

const logger = loggerService.getLogger();

export const RECOVER_ORPHAN_WORKFLOW_RUNS_JOB = 'recover-orphan-workflow-runs';

/**
 * Background recovery job that scans for orphaned workflow runs whose server-side
 * execution driver was lost due to a backend process crash or restart (Phase 3.4).
 * Reuses Agenda on MongoDB (Zero Redis).
 */
agenda.define(RECOVER_ORPHAN_WORKFLOW_RUNS_JOB, async (job) => {
  try {
    const staleRuns = await workflowRunRepository.findOrphanRunningRuns(30000); // 30s stale threshold

    for (const run of staleRuns) {
      const activeDriver = WorkflowRunDriver.get(run._id.toString());
      if (!activeDriver) {
        logger.warn(
          `[WorkflowRecovery] Found orphaned workflow run ${run._id} with no active in-memory driver. Recovering...`
        );

        // Transition run to failed with explicit server restart notice
        await workflowRunRepository.updateStatus(run._id, 'failed', {
          output: {
            recoveredAt: new Date(),
            reason: 'Execution halted due to server process restart. Checkpoint state preserved.',
          },
        });

        // Decrement active runs counter
        await workflowRepository.decrementActiveRuns(run.workflowId);
        logger.info(`[WorkflowRecovery] Successfully recovered orphan run ${run._id}`);
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
