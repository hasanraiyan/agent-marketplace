import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import workflowRepository from './workflow.repository.js';
import workflowVersionRepository from './workflowVersion.repository.js';
import workflowRunRepository from './workflowRun.repository.js';
import workflowUsageService from './workflowUsage.service.js';
import { compileWorkflowToStateGraph } from './workflow.factory.js';
import { WorkflowRunDriver } from './workflowRunDriver.js';
import { generateWorkflowMermaid } from './workflowMermaid.js';
import { detectCycle } from './workflow.validator.js';
import agentRepository from '../../agents/agent.repository.js';
import checkpointService from '../../threads/checkpoint.service.js';
import BaseError from '../../../utils/errors/BaseError.js';
import { loggerService } from '../../../utils/index.js';

const logger = loggerService.getLogger();

class WorkflowService {
  /**
   * Evaluates if a given principal context can execute or view a workflow.
   * Parity with isAgentOwner (AD-02 §11.1).
   */
  /**
   * Evaluates if a given principal context can execute or view a workflow.
   * Parity with isAgentOwner (AD-02 §11.1).
   */
  canAccessWorkflow(workflow, context = {}) {
    if (!workflow) return false;
    const { principalType, externalUserId, isProjectAdmin } = context;

    // Project Admin has full access to all workflows in the project
    if (
      isProjectAdmin ||
      principalType === 'ProjectAdmin' ||
      (principalType === 'ProjectMachine' && !externalUserId)
    ) {
      return true;
    }

    // Public and unlisted workflows can be accessed
    if (workflow.visibility === 'public' || workflow.visibility === 'unlisted') {
      return true;
    }

    // If private, only owner can access
    if (workflow.ownerType === 'ExternalUser' && externalUserId) {
      return String(workflow.externalOwnerId) === String(externalUserId);
    }

    if (workflow.ownerType === 'Project') {
      return !externalUserId;
    }

    return false;
  }

  /**
   * Evaluates if a given principal context can mutate (edit, save draft, publish, delete) a workflow.
   * Enforces strict ownership boundaries preventing cross-user mutation attacks.
   */
  canMutateWorkflow(workflow, context = {}) {
    if (!workflow) return false;
    const { principalType, externalUserId, isProjectAdmin } = context;

    // Project Admin (dashboard admin with Clerk session) has full mutation rights
    if (isProjectAdmin || principalType === 'ProjectAdmin') {
      return true;
    }

    // Machine credential without externalUserId represents project backend developer/service
    if (principalType === 'ProjectMachine' && !externalUserId) {
      return true;
    }

    // If workflow is owned by an ExternalUser:
    if (workflow.ownerType === 'ExternalUser') {
      return (
        Boolean(externalUserId) &&
        Boolean(workflow.externalOwnerId) &&
        String(workflow.externalOwnerId) === String(externalUserId)
      );
    }

    // If workflow is owned by Project:
    if (workflow.ownerType === 'Project') {
      // External users cannot mutate project-level workflows
      if (principalType === 'ProjectRuntime' || externalUserId) {
        return false;
      }
      return true;
    }

    return false;
  }

  async createWorkflow(projectId, data, userId, context = {}) {
    const draft = data.draft || {
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          position: { x: 100, y: 150 },
          data: { label: 'Manual Trigger', config: {} },
        },
        {
          id: 'output_1',
          type: 'output',
          position: { x: 500, y: 150 },
          data: { label: 'Output', config: {} },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger_1', target: 'output_1' }],
      trigger: { type: 'manual', config: {} },
    };

    const { hasCycle, cycleNode } = detectCycle(draft.nodes, draft.edges);
    if (hasCycle) {
      throw new BaseError(
        `Cycles are not supported in v1. Node ${cycleNode || 'unknown'} references an ancestor.`,
        400,
        'CYCLE_DETECTED'
      );
    }

    const externalOwnerId = data.externalUserId || context.externalUserId || null;
    const ownerType = externalOwnerId ? 'ExternalUser' : 'Project';
    const visibility = data.visibility || 'private';

    return await workflowRepository.create({
      projectId,
      name: data.name,
      description: data.description,
      isEnabled: data.isEnabled !== false,
      draft,
      ownerType,
      externalOwnerId,
      visibility,
    });
  }

  async getWorkflow(projectId, id, context = {}) {
    const workflow = await workflowRepository.findByProjectAndId(projectId, id);
    if (!workflow) {
      throw new BaseError('Workflow not found', 404, 'NOT_FOUND');
    }

    if (context && Object.keys(context).length > 0 && !this.canAccessWorkflow(workflow, context)) {
      throw new BaseError('Workflow not found', 404, 'NOT_FOUND');
    }

    return workflow;
  }

  async listWorkflows(projectId, options = {}, context = {}) {
    const opts = { ...options };
    const { externalUserId, scope } = opts;

    if (context.principalType === 'ProjectRuntime' || externalUserId) {
      const targetUserId = context.externalUserId || externalUserId;
      if (scope === 'mine') {
        opts.externalOwnerId = targetUserId;
      } else {
        // External user sees their own workflows + public ones
        opts.customFilter = {
          $or: [
            { externalOwnerId: targetUserId },
            { visibility: 'public' },
          ],
        };
      }
    }

    const [workflows, total] = await Promise.all([
      workflowRepository.listByProject(projectId, opts),
      workflowRepository.countByProject(projectId, opts),
    ]);
    return { workflows, total };
  }

  async updateWorkflow(projectId, id, data, context = {}) {
    const workflow = await this.getWorkflow(projectId, id, context);
    if (context && Object.keys(context).length > 0 && !this.canMutateWorkflow(workflow, context)) {
      throw new BaseError('Not authorized to modify this workflow', 403, 'FORBIDDEN');
    }

    if (data.draft) {
      const { hasCycle, cycleNode } = detectCycle(data.draft.nodes, data.draft.edges);
      if (hasCycle) {
        throw new BaseError(
          `Cycles are not supported in v1. Node ${cycleNode || 'unknown'} references an ancestor.`,
          400,
          'CYCLE_DETECTED'
        );
      }
    }

    return await workflowRepository.update(id, data);
  }

  async saveDraft(projectId, id, draft, context = {}) {
    const workflow = await this.getWorkflow(projectId, id, context);
    if (context && Object.keys(context).length > 0 && !this.canMutateWorkflow(workflow, context)) {
      throw new BaseError('Not authorized to modify this workflow', 403, 'FORBIDDEN');
    }

    const { hasCycle, cycleNode } = detectCycle(draft.nodes, draft.edges);
    if (hasCycle) {
      throw new BaseError(
        `Cycles are not supported in v1. Node ${cycleNode || 'unknown'} references an ancestor.`,
        400,
        'CYCLE_DETECTED'
      );
    }

    return await workflowRepository.updateDraft(id, draft);
  }

  async deleteWorkflow(projectId, id, context = {}) {
    const workflow = await this.getWorkflow(projectId, id, context);
    if (context && Object.keys(context).length > 0 && !this.canMutateWorkflow(workflow, context)) {
      throw new BaseError('Not authorized to delete this workflow', 403, 'FORBIDDEN');
    }
    return await workflowRepository.deleteByProjectAndId(projectId, id);
  }

  /**
   * Publishes an immutable WorkflowVersion snapshot and snapshots all referenced agents.
   */
  async publishWorkflow(projectId, id, userId, context = {}) {
    const workflow = await this.getWorkflow(projectId, id, context);
    if (context && Object.keys(context).length > 0 && !this.canMutateWorkflow(workflow, context)) {
      throw new BaseError('Not authorized to publish this workflow', 403, 'FORBIDDEN');
    }
    const draft = workflow.draft;

    if (!draft || !draft.nodes || draft.nodes.length === 0) {
      throw new BaseError('Cannot publish an empty workflow draft', 400, 'EMPTY_WORKFLOW');
    }

    const { hasCycle, cycleNode } = detectCycle(draft.nodes, draft.edges);
    if (hasCycle) {
      throw new BaseError(
        `Cycles are not supported in v1. Node ${cycleNode || 'unknown'} references an ancestor.`,
        400,
        'CYCLE_DETECTED'
      );
    }

    // Snapshot referenced agents for agentStep nodes
    const agentSnapshots = new Map();
    for (const node of draft.nodes) {
      if (node.type === 'agentStep' && node.data?.config?.agentId) {
        const agentDoc = await agentRepository.findById(node.data.config.agentId);
        if (agentDoc) {
          agentSnapshots.set(node.id, {
            modelName: agentDoc.modelName || 'default',
            systemPrompt: agentDoc.systemPrompt || '',
            tools: (agentDoc.tools || []).map((t) => (typeof t === 'string' ? t : t.name)),
          });
        }
      }
    }

    const nextVersion = (workflow.publishedVersion || 0) + 1;

    const versionDoc = await workflowVersionRepository.create({
      workflowId: workflow._id,
      projectId,
      version: nextVersion,
      definition: {
        nodes: draft.nodes,
        edges: draft.edges,
        trigger: draft.trigger,
      },
      agentSnapshots,
      publishedBy: userId,
    });

    await workflowRepository.incrementPublishedVersion(workflow._id);

    return versionDoc;
  }

  async listVersions(projectId, workflowId, options = {}, context = {}) {
    await this.getWorkflow(projectId, workflowId, context);
    const [versions, total] = await Promise.all([
      workflowVersionRepository.listByWorkflow(workflowId, options),
      workflowVersionRepository.countByWorkflow(workflowId),
    ]);
    return { versions, total };
  }

  async getVersion(projectId, workflowId, version, context = {}) {
    await this.getWorkflow(projectId, workflowId, context);
    const versionDoc = await workflowVersionRepository.findByWorkflowAndVersion(
      workflowId,
      Number(version)
    );
    if (!versionDoc) {
      throw new BaseError(`Version ${version} not found for workflow`, 404, 'VERSION_NOT_FOUND');
    }
    return versionDoc;
  }

  /**
   * Triggers a workflow execution.
   * Handles pre-flight balance checks, atomic concurrency gating, run creation,
   * RunDriver allocation, and background LangGraph execution.
   */
  async runWorkflow({
    workflowId,
    projectId,
    input = {},
    isDryRun = false,
    userId,
    externalUserId,
    version,
    context = {},
  }) {
    const workflow = await this.getWorkflow(projectId, workflowId, context);

    // 1. Pre-flight balance check (bypassed if isDryRun is true)
    await workflowUsageService.checkPreflightBalance(projectId, isDryRun);

    // 2. Concurrency check and atomic slot reservation (Gap 4)
    const activeWorkflow = await workflowRepository.checkAndIncrementActiveRuns(workflowId, 5);
    if (!activeWorkflow) {
      throw new BaseError(
        'Concurrency limit reached for this workflow (maximum 5 concurrent runs). Please wait for active runs to finish.',
        429,
        'CONCURRENCY_LIMIT_EXCEEDED'
      );
    }

    // 3. Resolve executable definition & agent snapshots
    let executableDef;
    let effectiveVersion = 0;
    let agentSnapshots = null;

    if (version) {
      const versionDoc = await workflowVersionRepository.findByWorkflowAndVersion(
        workflowId,
        Number(version)
      );
      if (!versionDoc) {
        await workflowRepository.decrementActiveRuns(workflowId);
        throw new BaseError(`Version ${version} not found`, 404, 'VERSION_NOT_FOUND');
      }
      executableDef = versionDoc.definition;
      effectiveVersion = versionDoc.version;
      agentSnapshots = versionDoc.agentSnapshots;
    } else if (workflow.publishedVersion > 0) {
      const versionDoc = await workflowVersionRepository.findByWorkflowAndVersion(
        workflowId,
        workflow.publishedVersion
      );
      if (versionDoc) {
        executableDef = versionDoc.definition;
        effectiveVersion = versionDoc.version;
        agentSnapshots = versionDoc.agentSnapshots;
      } else {
        executableDef = workflow.draft;
        effectiveVersion = 0;
      }
    } else {
      executableDef = workflow.draft;
      effectiveVersion = 0;
    }

    const threadId = crypto.randomUUID();
    const effectiveExternalUserId = externalUserId || context.externalUserId || null;

    // 4. Create WorkflowRun in MongoDB
    const run = await workflowRunRepository.create({
      workflowId: workflow._id,
      workflowVersion: effectiveVersion,
      projectId,
      triggeredBy: {
        type: effectiveExternalUserId ? 'external_user' : 'manual',
        userId: userId ? String(userId) : undefined,
      },
      externalUserId: effectiveExternalUserId,
      status: 'running',
      isDryRun: Boolean(isDryRun),
      threadId,
    });

    // 5. Allocate in-memory WorkflowRunDriver for decoupled streaming & reconnection
    const driver = new WorkflowRunDriver({
      runId: run._id,
      workflowId: workflow._id,
      projectId,
      threadId,
    });

    // 6. Execute workflow asynchronously in background
    this._executeWorkflowGraph({
      runId: run._id,
      workflowId: workflow._id,
      projectId,
      threadId,
      executableDef,
      agentSnapshots,
      input,
      isDryRun,
      userId,
      driver,
    }).catch((err) => {
      logger.error(`[WorkflowEngine] Background run ${run._id} error:`, err);
    });

    return { run, driver };
  }

  /**
   * Internal async background execution loop.
   */
  async _executeWorkflowGraph({
    runId,
    workflowId,
    projectId,
    threadId,
    executableDef,
    agentSnapshots,
    input,
    isDryRun,
    userId,
    driver,
  }) {
    driver.pushEvent({
      type: EventType.RUN_STARTED,
      threadId,
      runId: runId.toString(),
      isDryRun,
      timestamp: new Date().toISOString(),
    });

    try {
      const executionContext = {
        driver,
        runId,
        isDryRun,
        agentSnapshots,
        userId,
        domain: projectId.toString(),
      };

      const stateGraph = compileWorkflowToStateGraph(executableDef, executionContext);

      // Attach checkpointer if available
      const checkpointer = checkpointService.checkpointer;
      const app = stateGraph.compile({ checkpointer });

      const initialState = {
        runId: runId.toString(),
        workflowId: workflowId.toString(),
        projectId: projectId.toString(),
        trigger: { payload: input },
      };

      const finalState = await app.invoke(initialState, {
        configurable: { thread_id: threadId },
        signal: driver.signal,
      });

      if (driver.signal.aborted) return;

      // Deduct credits and update usage
      const updatedRun = await workflowRunRepository.findById(runId);
      const usage = await workflowUsageService.recordAndDeductUsage(
        projectId,
        runId,
        updatedRun?.nodeRuns || [],
        isDryRun
      );

      // Complete run
      await workflowRunRepository.updateStatus(runId, 'completed', {
        output: finalState?.output || null,
        usage,
      });

      driver.pushEvent({
        type: EventType.RUN_FINISHED,
        runId: runId.toString(),
        output: finalState?.output,
        usage,
        timestamp: new Date().toISOString(),
      });

      driver.finish(finalState?.output);
    } catch (error) {
      if (driver.signal.aborted) {
        logger.info(`[WorkflowEngine] Run ${runId} was aborted by user cancellation`);
        return;
      }

      logger.error(`[WorkflowEngine] Run ${runId} failed:`, error);
      await workflowRunRepository.updateStatus(runId, 'failed', {
        output: { error: error.message },
      });

      driver.fail(error);
    }
  }

  async getRun(projectId, runId, context = {}) {
    const run = await workflowRunRepository.findByProjectAndId(projectId, runId);
    if (!run) {
      throw new BaseError('Workflow run not found', 404, 'NOT_FOUND');
    }

    if (context.principalType === 'ProjectRuntime' && context.externalUserId) {
      if (run.externalUserId && String(run.externalUserId) !== String(context.externalUserId)) {
        throw new BaseError('Workflow run not found', 404, 'NOT_FOUND');
      }
    }

    return run;
  }

  async listRuns(projectId, workflowId, options = {}, context = {}) {
    await this.getWorkflow(projectId, workflowId, context);
    const opts = { ...options };

    if (context.principalType === 'ProjectRuntime' && context.externalUserId) {
      opts.externalUserId = context.externalUserId;
    }

    const [runs, total] = await Promise.all([
      workflowRunRepository.listByWorkflow(workflowId, opts),
      workflowRunRepository.countByWorkflow(workflowId, opts),
    ]);
    return { runs, total };
  }

  /**
   * Resumes streaming for an in-flight or completed run.
   * If driver is in memory, re-attaches SSE stream;
   * otherwise falls back to serving the current snapshot from Mongo (Phase 3.3).
   */
  async resumeRun(projectId, runId, res, sinceSeq = 0) {
    const activeDriver = WorkflowRunDriver.get(runId);
    if (activeDriver) {
      activeDriver.subscribe(res, sinceSeq);
      return;
    }

    // Fallback: serve current state snapshot from Mongo
    const run = await this.getRun(projectId, runId);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const snapshotEvent = {
      type: EventType.CUSTOM,
      name: 'workflow_run_snapshot',
      seq: 1,
      value: {
        runId: run._id,
        status: run.status,
        nodeRuns: run.nodeRuns,
        output: run.output,
        usage: run.usage,
      },
    };

    res.write(`data: ${JSON.stringify(snapshotEvent)}\n\n`);
    res.end();
  }

  /**
   * Mid-flight run cancellation (Gap 6 / TODO.md 1.4).
   */
  async cancelRun(projectId, runId, context = {}) {
    await this.getRun(projectId, runId, context);

    const activeDriver = WorkflowRunDriver.get(runId);
    if (activeDriver) {
      await activeDriver.abort('Workflow execution cancelled by user');
    } else {
      const run = await workflowRunRepository.cancelRun(runId);
      if (run) {
        await workflowRepository.decrementActiveRuns(run.workflowId);
      }
    }

    return await workflowRunRepository.findById(runId);
  }

  /**
   * Generates a Mermaid flowchart string for this workflow.
   */
  async getMermaid(projectId, workflowId, context = {}) {
    const workflow = await this.getWorkflow(projectId, workflowId, context);
    return generateWorkflowMermaid(workflow);
  }
}

export default new WorkflowService();
