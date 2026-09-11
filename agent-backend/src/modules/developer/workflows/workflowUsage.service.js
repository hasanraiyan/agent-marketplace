import Project, { PROJECT_STATUS } from '../../projects/project.model.js';
import workflowRunRepository from './workflowRun.repository.js';
import BaseError from '../../../utils/errors/BaseError.js';

class WorkflowUsageService {
  /**
   * Pre-flight balance check: rejects run initiation if Project is suspended or balance is insufficient.
   * EXPLICITLY BYPASSED when isDryRun: true (Gap 7 & 9 in research.md and TODO.md).
   */
  async checkPreflightBalance(projectId, isDryRun = false) {
    if (isDryRun) {
      return { allowed: true, isDryRun: true };
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new BaseError('Project not found', 404, 'NOT_FOUND');
    }

    if (project.status === PROJECT_STATUS.SUSPENDED) {
      throw new BaseError('Project is suspended', 403, 'PROJECT_SUSPENDED');
    }

    if (project.status === PROJECT_STATUS.DELETING || project.status === PROJECT_STATUS.DELETED) {
      throw new BaseError('Project is not active', 400, 'PROJECT_INACTIVE');
    }

    // If the project has credit tracking or limits, verify balance >= 1
    if (typeof project.credits === 'number' && project.credits <= 0) {
      throw new BaseError(
        'Insufficient credits to initiate workflow run. Please top up your project balance.',
        402,
        'INSUFFICIENT_CREDITS'
      );
    }

    return { allowed: true, isDryRun: false };
  }

  /**
   * Aggregates usage metrics from executed node runs.
   */
  calculateUsage(nodeRuns = []) {
    let totalTokens = 0;
    let agentTurns = 0;
    let toolCalls = 0;

    for (const nr of nodeRuns) {
      if (nr.nodeType === 'agentStep') {
        agentTurns += 1;
        if (typeof nr.tokens === 'number') {
          totalTokens += nr.tokens;
        }
      } else if (nr.nodeType === 'toolStep') {
        toolCalls += 1;
      }
    }

    // Nominal credit estimation: 1 credit base + 1 credit per agent turn + token factor
    const creditsDeducted = Math.max(1, agentTurns + Math.ceil(totalTokens / 2000));

    return {
      totalTokens,
      agentTurns,
      toolCalls,
      creditsDeducted,
    };
  }

  /**
   * Atomically records usage and deducts balance upon workflow completion.
   * Explicitly bypassed when isDryRun: true.
   */
  async recordAndDeductUsage(projectId, runId, nodeRuns = [], isDryRun = false) {
    const usage = this.calculateUsage(nodeRuns);

    if (isDryRun) {
      usage.creditsDeducted = 0;
      await workflowRunRepository.updateStatus(runId, 'completed', { usage });
      return usage;
    }

    // Update project credits if project tracks credits
    if (usage.creditsDeducted > 0) {
      await Project.findOneAndUpdate(
        { _id: projectId, credits: { $exists: true } },
        { $inc: { credits: -usage.creditsDeducted } }
      );
    }

    await workflowRunRepository.updateStatus(runId, 'completed', { usage });
    return usage;
  }
}

export default new WorkflowUsageService();
