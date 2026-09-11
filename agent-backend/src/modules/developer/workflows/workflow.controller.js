import workflowService from './workflow.service.js';
import { paginationEnvelope } from '../../../utils/pagination.js';
import { loggerService } from '../../../utils/index.js';

const logger = loggerService.getLogger();

function getProjectId(req) {
  return req.projectAdminContext?.domain || req.projectContext?.domain || req.params.projectId;
}

function getUserId(req) {
  return req.projectAdminContext?.personaUserId || req.user?._id || req.user?.id;
}

function getContext(req) {
  if (req.projectAdminContext) {
    return {
      principalType: 'ProjectAdmin',
      domain: req.projectAdminContext.domain,
      personaUserId: req.projectAdminContext.personaUserId,
      isProjectAdmin: true,
    };
  }
  if (req.projectContext) {
    return {
      ...req.projectContext,
      isProjectAdmin: req.projectContext.principalType === 'ProjectMachine',
    };
  }
  return {
    principalType: 'PersonaUser',
    personaUserId: getUserId(req),
    isProjectAdmin: true,
  };
}

class WorkflowController {
  async list(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const search = req.query.search;
      const scope = req.query.scope;
      const visibility = req.query.visibility;
      const externalUserId = req.query.externalUserId || context.externalUserId;
      const isEnabled =
        req.query.isEnabled !== undefined ? req.query.isEnabled === 'true' : undefined;

      logger.debug('[WorkflowController] list', { projectId, page, limit, search, scope, visibility });

      const { workflows, total } = await workflowService.listWorkflows(
        projectId,
        {
          page,
          limit,
          search,
          scope,
          visibility,
          externalUserId,
          isEnabled,
        },
        context
      );

      logger.debug('[WorkflowController] list resolved', { projectId, count: workflows.length, total });

      res.json({
        success: true,
        data: paginationEnvelope(workflows, total, page, limit),
      });
    } catch (error) {
      logger.warn(`[WorkflowController] list failed: ${error?.message}`, { statusCode: error?.statusCode });
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const context = getContext(req);
      logger.info('[WorkflowController] create', { projectId, name: req.body?.name, visibility: req.body?.visibility });
      const workflow = await workflowService.createWorkflow(projectId, req.body, userId, context);
      logger.info('[WorkflowController] created', { projectId, workflowId: workflow._id });
      res.status(201).json({ success: true, data: workflow });
    } catch (error) {
      logger.warn(`[WorkflowController] create failed: ${error?.message}`);
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.debug('[WorkflowController] getOne', { projectId, workflowId: req.params.workflowId });
      const workflow = await workflowService.getWorkflow(projectId, req.params.workflowId, context);
      res.json({ success: true, data: workflow });
    } catch (error) {
      logger.warn(`[WorkflowController] getOne failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.info('[WorkflowController] update', { projectId, workflowId: req.params.workflowId });
      const workflow = await workflowService.updateWorkflow(
        projectId,
        req.params.workflowId,
        req.body,
        context
      );
      res.json({ success: true, data: workflow });
    } catch (error) {
      logger.warn(`[WorkflowController] update failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }

  async saveDraft(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.info('[WorkflowController] saveDraft', {
        projectId,
        workflowId: req.params.workflowId,
        nodeCount: req.body?.draft?.nodes?.length,
        edgeCount: req.body?.draft?.edges?.length,
      });
      const workflow = await workflowService.saveDraft(
        projectId,
        req.params.workflowId,
        req.body.draft,
        context
      );
      res.json({ success: true, data: workflow });
    } catch (error) {
      logger.warn(`[WorkflowController] saveDraft failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.info('[WorkflowController] remove', { projectId, workflowId: req.params.workflowId });
      await workflowService.deleteWorkflow(projectId, req.params.workflowId, context);
      logger.info('[WorkflowController] removed', { workflowId: req.params.workflowId });
      res.json({ success: true, message: 'Workflow deleted successfully' });
    } catch (error) {
      logger.warn(`[WorkflowController] remove failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }

  async publish(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      const userId = getUserId(req);
      logger.info('[WorkflowController] publish', { projectId, workflowId: req.params.workflowId });
      const versionDoc = await workflowService.publishWorkflow(
        projectId,
        req.params.workflowId,
        userId,
        context
      );
      logger.info('[WorkflowController] published', { workflowId: req.params.workflowId, version: versionDoc.version });
      res.status(201).json({ success: true, data: versionDoc });
    } catch (error) {
      logger.warn(`[WorkflowController] publish failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }

  async listVersions(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      logger.debug('[WorkflowController] listVersions', { projectId, workflowId: req.params.workflowId, page, limit });
      const { versions, total } = await workflowService.listVersions(
        projectId,
        req.params.workflowId,
        { page, limit },
        context
      );
      res.json({
        success: true,
        data: paginationEnvelope(versions, total, page, limit),
      });
    } catch (error) {
      logger.warn(`[WorkflowController] listVersions failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }

  async getVersion(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.debug('[WorkflowController] getVersion', {
        projectId,
        workflowId: req.params.workflowId,
        version: req.params.version,
      });
      const versionDoc = await workflowService.getVersion(
        projectId,
        req.params.workflowId,
        req.params.version,
        context
      );
      res.json({ success: true, data: versionDoc });
    } catch (error) {
      logger.warn(`[WorkflowController] getVersion failed: ${error?.message}`, {
        workflowId: req.params.workflowId,
        version: req.params.version,
      });
      next(error);
    }
  }

  /**
   * Single run-trigger action supporting both live production and dryRun execution.
   * Scoped to externalUserId if asserted or provided.
   */
  async run(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const context = getContext(req);
      const isDryRun = Boolean(req.body.dryRun || req.body.isDryRun || req.query.dryRun === 'true');
      const input = req.body.input || req.body;
      const version = req.body.version ? Number(req.body.version) : undefined;
      const externalUserId = req.body.externalUserId || req.query.externalUserId || context.externalUserId;

      logger.info('[WorkflowController] run requested', {
        projectId,
        workflowId: req.params.workflowId,
        isDryRun,
        version,
        externalUserId,
      });

      const { run, driver } = await workflowService.runWorkflow({
        workflowId: req.params.workflowId,
        projectId,
        input,
        isDryRun,
        userId,
        externalUserId,
        version,
        context,
      });

      logger.info('[WorkflowController] run started', { workflowId: req.params.workflowId, runId: run._id, threadId: run.threadId });

      const wantsStream =
        req.headers.accept?.includes('text/event-stream') ||
        req.query.stream === 'true' ||
        req.body.stream === true;

      if (wantsStream) {
        logger.debug('[WorkflowController] run subscribing caller to SSE stream', { runId: run._id });
        driver.subscribe(res);
      } else {
        res.status(201).json({
          success: true,
          data: {
            runId: run._id,
            status: run.status,
            isDryRun: run.isDryRun,
            externalUserId: run.externalUserId,
            threadId: run.threadId,
          },
        });
      }
    } catch (error) {
      logger.warn(`[WorkflowController] run failed: ${error?.message}`, {
        workflowId: req.params.workflowId,
        code: error?.code,
      });
      next(error);
    }
  }

  async resume(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const sinceSeq = parseInt(req.query.sinceSeq) || 0;
      logger.debug('[WorkflowController] resume', { projectId, runId: req.params.runId, sinceSeq });
      await workflowService.resumeRun(projectId, req.params.runId, res, sinceSeq);
    } catch (error) {
      logger.warn(`[WorkflowController] resume failed: ${error?.message}`, { runId: req.params.runId });
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.info('[WorkflowController] cancel', { projectId, runId: req.params.runId });
      const cancelledRun = await workflowService.cancelRun(
        projectId,
        req.params.runId,
        context
      );
      logger.info('[WorkflowController] cancelled', { runId: req.params.runId, status: cancelledRun?.status });
      res.json({
        success: true,
        message: 'Workflow run cancelled successfully',
        data: cancelledRun,
      });
    } catch (error) {
      logger.warn(`[WorkflowController] cancel failed: ${error?.message}`, { runId: req.params.runId });
      next(error);
    }
  }

  async getRun(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.debug('[WorkflowController] getRun', { projectId, runId: req.params.runId });
      const run = await workflowService.getRun(projectId, req.params.runId, context);
      res.json({ success: true, data: run });
    } catch (error) {
      logger.warn(`[WorkflowController] getRun failed: ${error?.message}`, { runId: req.params.runId });
      next(error);
    }
  }

  async listRuns(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;
      const externalUserId = req.query.externalUserId || context.externalUserId;
      const isDryRun =
        req.query.isDryRun !== undefined ? req.query.isDryRun === 'true' : undefined;

      logger.debug('[WorkflowController] listRuns', {
        projectId,
        workflowId: req.params.workflowId,
        status,
        isDryRun,
        page,
        limit,
      });

      const { runs, total } = await workflowService.listRuns(
        projectId,
        req.params.workflowId,
        {
          page,
          limit,
          status,
          isDryRun,
          externalUserId,
        },
        context
      );

      res.json({
        success: true,
        data: paginationEnvelope(runs, total, page, limit),
      });
    } catch (error) {
      logger.warn(`[WorkflowController] listRuns failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }

  async getMermaid(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      logger.debug('[WorkflowController] getMermaid', { projectId, workflowId: req.params.workflowId });
      const mermaid = await workflowService.getMermaid(
        projectId,
        req.params.workflowId,
        context
      );
      res.json({ success: true, data: { mermaid } });
    } catch (error) {
      logger.warn(`[WorkflowController] getMermaid failed: ${error?.message}`, { workflowId: req.params.workflowId });
      next(error);
    }
  }
}

export default new WorkflowController();
