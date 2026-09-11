import WorkflowRun from './workflowRun.model.js';
import { loggerService } from '../../../utils/index.js';

const logger = loggerService.getLogger();

class WorkflowRunRepository {
  async create(data) {
    const run = new WorkflowRun(data);
    const saved = await run.save();
    logger.debug('[WorkflowRunRepository] created', { runId: saved._id, workflowId: saved.workflowId, threadId: saved.threadId });
    return saved;
  }

  async findById(id) {
    return await WorkflowRun.findById(id);
  }

  async findByProjectAndId(projectId, id) {
    return await WorkflowRun.findOne({ _id: id, projectId });
  }

  async listByWorkflow(workflowId, { page = 1, limit = 20, status, isDryRun, externalUserId } = {}) {
    const filter = { workflowId };
    if (status) filter.status = status;
    if (typeof isDryRun === 'boolean') filter.isDryRun = isDryRun;
    if (externalUserId) filter.externalUserId = externalUserId;

    const skip = (page - 1) * limit;
    return await WorkflowRun.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByWorkflow(workflowId, { status, isDryRun, externalUserId } = {}) {
    const filter = { workflowId };
    if (status) filter.status = status;
    if (typeof isDryRun === 'boolean') filter.isDryRun = isDryRun;
    if (externalUserId) filter.externalUserId = externalUserId;
    return await WorkflowRun.countDocuments(filter);
  }

  async listByProject(projectId, { page = 1, limit = 20, status, isDryRun, externalUserId } = {}) {
    const filter = { projectId };
    if (status) filter.status = status;
    if (typeof isDryRun === 'boolean') filter.isDryRun = isDryRun;
    if (externalUserId) filter.externalUserId = externalUserId;

    const skip = (page - 1) * limit;
    return await WorkflowRun.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByProject(projectId, { status, isDryRun, externalUserId } = {}) {
    const filter = { projectId };
    if (status) filter.status = status;
    if (typeof isDryRun === 'boolean') filter.isDryRun = isDryRun;
    if (externalUserId) filter.externalUserId = externalUserId;
    return await WorkflowRun.countDocuments(filter);
  }

  /**
   * Records or starts a nodeRun execution entry.
   */
  async recordNodeRunStart(runId, { nodeId, nodeType, input }) {
    logger.debug('[WorkflowRunRepository] node run started', { runId, nodeId, nodeType });
    return await WorkflowRun.findByIdAndUpdate(
      runId,
      {
        $push: {
          nodeRuns: {
            nodeId,
            nodeType,
            status: 'running',
            input,
            startedAt: new Date(),
          },
        },
      },
      { new: true }
    );
  }

  /**
   * Completes a nodeRun execution entry with duration, output, tokens, retriesTaken, etc.
   */
  async recordNodeRunCompletion(
    runId,
    nodeId,
    { status = 'completed', output, error, retriesTaken = 0, durationMs = 0, tokens = 0 }
  ) {
    if (status === 'failed') {
      logger.warn('[WorkflowRunRepository] node run failed', { runId, nodeId, error, retriesTaken });
    } else {
      logger.debug('[WorkflowRunRepository] node run completed', { runId, nodeId, status, durationMs, tokens, retriesTaken });
    }
    return await WorkflowRun.findOneAndUpdate(
      { _id: runId, 'nodeRuns.nodeId': nodeId },
      {
        $set: {
          'nodeRuns.$.status': status,
          'nodeRuns.$.output': output,
          'nodeRuns.$.error': error,
          'nodeRuns.$.retriesTaken': retriesTaken,
          'nodeRuns.$.durationMs': durationMs,
          'nodeRuns.$.tokens': tokens,
          'nodeRuns.$.endedAt': new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Updates status and optional extra fields (output, usage, endedAt)
   */
  async updateStatus(runId, status, extraFields = {}) {
    const update = { status, ...extraFields };
    if (['completed', 'failed', 'cancelled'].includes(status) && !update.endedAt) {
      update.endedAt = new Date();
    }
    logger.debug('[WorkflowRunRepository] status updated', { runId, status });
    return await WorkflowRun.findByIdAndUpdate(runId, { $set: update }, { new: true });
  }

  /**
   * Atomically cancels an in-flight or queued workflow run.
   */
  async cancelRun(runId) {
    const cancelled = await WorkflowRun.findOneAndUpdate(
      {
        _id: runId,
        status: { $in: ['queued', 'running', 'paused'] },
      },
      {
        $set: {
          status: 'cancelled',
          endedAt: new Date(),
        },
      },
      { new: true }
    );
    logger.debug('[WorkflowRunRepository] cancelRun', { runId, cancelled: Boolean(cancelled) });
    return cancelled;
  }

  /**
   * Discovers orphaned runs that were left in 'running' state after a backend crash.
   * Used by Agenda recovery sweep job.
   */
  async findOrphanRunningRuns(staleThresholdMs = 60000) {
    const cutoff = new Date(Date.now() - staleThresholdMs);
    const orphans = await WorkflowRun.find({
      status: 'running',
      updatedAt: { $lt: cutoff },
    });
    if (orphans.length > 0) {
      logger.debug('[WorkflowRunRepository] orphan runs found', { count: orphans.length, staleThresholdMs });
    }
    return orphans;
  }
}

export default new WorkflowRunRepository();
