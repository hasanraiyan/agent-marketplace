import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { RunDriver } from '../runDriver.js';
import { withHeartbeats } from '../heartbeat.js';
import { requireParam } from '../routeHelpers.js';
import type { RunContext } from '../types/hooks.js';

interface WorkflowStreamBody {
  input?: unknown;
  dryRun?: boolean;
  version?: number;
}

function parseWorkflowStreamBody(body: unknown): WorkflowStreamBody {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object') {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  const b = body as Record<string, unknown>;
  return {
    input: b.input,
    dryRun: typeof b.dryRun === 'boolean' ? b.dryRun : undefined,
    version: typeof b.version === 'number' ? b.version : undefined,
  };
}

/**
 * Executes a workflow and streams AG-UI events back. Driven by RunDriver,
 * registered under a fresh `runId` (returned via `x-persona-run-id`)
 * allowing reconnections via `GET /workflows/runs/:runId/resume`.
 */
export const workflowStreamRoute: RouteHandler = async (request, ctx) => {
  const workflowId = requireParam(ctx.params, 'id');
  const body = parseWorkflowStreamBody(request.body);
  const userId = request.userId as string;

  const runCtx: RunContext = {
    userId,
    kind: 'workflow',
    workflowId,
    input: body.input,
  };

  await ctx.hooks?.beforeRun?.(runCtx);

  const stream = ctx.client.workflows.stream(workflowId, {
    input: body.input,
    dryRun: body.dryRun,
    version: body.version,
  });

  const runId = crypto.randomUUID();
  const driver = new RunDriver(runId, runCtx, stream, ctx.hooks, ctx.mode);
  ctx.runs.set(runId, driver);

  try {
    await driver.waitForFirstFrame();
  } catch (err) {
    ctx.runs.delete(runId);
    throw err;
  }

  return {
    kind: 'stream',
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-persona-run-id': runId,
    },
    body: withHeartbeats(driver.subscribe(-1), ctx.heartbeatIntervalMs),
  };
};
