import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowDraft,
  WorkflowRunStatus,
  WorkflowVisibility,
} from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import {
  json,
  noContent,
  requireBodyObject,
  requireParam,
  requireStringField,
  toInt,
} from '../routeHelpers.js';

/** Always on — read-only discovery of available workflows. */
export const listWorkflows: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.workflows.list({
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    search: request.query.search,
    scope: request.query.scope as 'mine' | 'public' | 'all' | undefined,
    visibility: request.query.visibility as WorkflowVisibility | undefined,
    isEnabled:
      request.query.isEnabled !== undefined
        ? request.query.isEnabled === 'true'
        : undefined,
  });
  return json(200, items);
};

// Everything below requires capabilities.workflowsWrite — authoring workflows
// is Project-admin/builder work, not something an ordinary end-user session does.

export const createWorkflow: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: CreateWorkflowInput = {
    name: requireStringField(body, 'name'),
    description: typeof body.description === 'string' ? body.description : undefined,
    visibility: body.visibility as WorkflowVisibility | undefined,
    isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : undefined,
    draft: (body.draft as WorkflowDraft) ?? undefined,
  };
  const idempotencyKey = request.headers['idempotency-key'];
  const workflow = await ctx.client.workflows.create(input, idempotencyKey);
  return json(201, workflow);
};

export const getWorkflow: RouteHandler = async (_request, ctx) => {
  const workflow = await ctx.client.workflows.get(requireParam(ctx.params, 'id'));
  return json(200, workflow);
};

export const updateWorkflow: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const input: UpdateWorkflowInput = {
    name: typeof body.name === 'string' ? body.name : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    visibility: body.visibility as WorkflowVisibility | undefined,
    isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : undefined,
    draft: (body.draft as WorkflowDraft) ?? undefined,
  };
  const updated = await ctx.client.workflows.update(
    requireParam(ctx.params, 'id'),
    input
  );
  return json(200, updated);
};

export const deleteWorkflow: RouteHandler = async (_request, ctx) => {
  await ctx.client.workflows.delete(requireParam(ctx.params, 'id'));
  return noContent();
};

export const saveWorkflowDraft: RouteHandler = async (request, ctx) => {
  const body = requireBodyObject(request.body);
  const draft = body as unknown as WorkflowDraft;
  const updated = await ctx.client.workflows.saveDraft(
    requireParam(ctx.params, 'id'),
    draft
  );
  return json(200, updated);
};

export const publishWorkflow: RouteHandler = async (_request, ctx) => {
  const version = await ctx.client.workflows.publish(requireParam(ctx.params, 'id'));
  return json(201, version);
};

export const listWorkflowVersions: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.workflows.listVersions(
    requireParam(ctx.params, 'id'),
    {
      page: toInt(request.query.page),
      limit: toInt(request.query.limit),
    }
  );
  return json(200, items);
};

export const getWorkflowVersion: RouteHandler = async (_request, ctx) => {
  const versionNum = toInt(ctx.params.version);
  const version = await ctx.client.workflows.getVersion(
    requireParam(ctx.params, 'id'),
    versionNum ?? 1
  );
  return json(200, version);
};

export const getWorkflowMermaid: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.workflows.getMermaid(requireParam(ctx.params, 'id'));
  return json(200, result);
};

export const listWorkflowRuns: RouteHandler = async (request, ctx) => {
  const items = await ctx.client.workflows.listRuns(requireParam(ctx.params, 'id'), {
    page: toInt(request.query.page),
    limit: toInt(request.query.limit),
    status: request.query.status as WorkflowRunStatus | undefined,
    isDryRun:
      request.query.isDryRun !== undefined
        ? request.query.isDryRun === 'true'
        : undefined,
  });
  return json(200, items);
};

export const getWorkflowRun: RouteHandler = async (_request, ctx) => {
  const run = await ctx.client.workflows.getRun(requireParam(ctx.params, 'runId'));
  return json(200, run);
};

export const cancelWorkflowRun: RouteHandler = async (_request, ctx) => {
  const result = await ctx.client.workflows.cancel(requireParam(ctx.params, 'runId'));
  return json(200, result);
};
