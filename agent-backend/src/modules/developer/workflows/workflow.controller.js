import workflowService from './workflow.service.js';
import { paginationEnvelope } from '../../../utils/pagination.js';

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

      res.json({
        success: true,
        data: paginationEnvelope(workflows, total, page, limit),
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const context = getContext(req);
      const workflow = await workflowService.createWorkflow(projectId, req.body, userId, context);
      res.status(201).json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      const workflow = await workflowService.getWorkflow(projectId, req.params.workflowId, context);
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      const workflow = await workflowService.updateWorkflow(
        projectId,
        req.params.workflowId,
        req.body,
        context
      );
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }

  async saveDraft(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const workflow = await workflowService.saveDraft(
        projectId,
        req.params.workflowId,
        req.body.draft
      );
      res.json({ success: true, data: workflow });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const projectId = getProjectId(req);
      await workflowService.deleteWorkflow(projectId, req.params.workflowId);
      res.json({ success: true, message: 'Workflow deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async publish(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const userId = getUserId(req);
      const versionDoc = await workflowService.publishWorkflow(
        projectId,
        req.params.workflowId,
        userId
      );
      res.status(201).json({ success: true, data: versionDoc });
    } catch (error) {
      next(error);
    }
  }

  async listVersions(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { versions, total } = await workflowService.listVersions(
        projectId,
        req.params.workflowId,
        { page, limit }
      );
      res.json({
        success: true,
        data: paginationEnvelope(versions, total, page, limit),
      });
    } catch (error) {
      next(error);
    }
  }

  async getVersion(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const versionDoc = await workflowService.getVersion(
        projectId,
        req.params.workflowId,
        req.params.version
      );
      res.json({ success: true, data: versionDoc });
    } catch (error) {
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

      const wantsStream =
        req.headers.accept?.includes('text/event-stream') ||
        req.query.stream === 'true' ||
        req.body.stream === true;

      if (wantsStream) {
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
      next(error);
    }
  }

  async resume(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const sinceSeq = parseInt(req.query.sinceSeq) || 0;
      await workflowService.resumeRun(projectId, req.params.runId, res, sinceSeq);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const cancelledRun = await workflowService.cancelRun(projectId, req.params.runId);
      res.json({
        success: true,
        message: 'Workflow run cancelled successfully',
        data: cancelledRun,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRun(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const context = getContext(req);
      const run = await workflowService.getRun(projectId, req.params.runId, context);
      res.json({ success: true, data: run });
    } catch (error) {
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
      next(error);
    }
  }

  async getMermaid(req, res, next) {
    try {
      const projectId = getProjectId(req);
      const mermaid = await workflowService.getMermaid(projectId, req.params.workflowId);
      res.json({ success: true, data: { mermaid } });
    } catch (error) {
      next(error);
    }
  }
}

export default new WorkflowController();
