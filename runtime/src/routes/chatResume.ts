import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { withHeartbeats } from '../heartbeat.js';

/**
 * Reattaches to an in-flight or recently-finished chat run started by
 * `POST /chat` (its `runId`, from the `x-persona-run-id` response header),
 * replaying every frame after `?since=<seq>` (default `-1`, i.e. from the
 * start) and then continuing to stream live frames until the run finishes.
 *
 * This is what makes a dropped connection recoverable without losing
 * generated content or duplicating the turn: the run itself was never tied
 * to the original HTTP response (see `RunDriver`), so a new response can
 * pick up exactly where the old one left off.
 */
export const resumeChatRoute: RouteHandler = async (request, ctx) => {
  const runId = ctx.params.runId;
  if (!runId) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', '"runId" path parameter is required.');
  }

  const driver = ctx.runs.get(runId);
  // A run that belongs to a different user is reported identically to one
  // that doesn't exist — never confirm another user's run id is valid.
  if (!driver || driver.runCtx.userId !== request.userId) {
    throw new RuntimeHttpError(
      404,
      'RUN_NOT_FOUND',
      `No resumable run found for id "${runId}". It may have finished and been evicted, or never existed.`
    );
  }

  const sinceRaw = request.query.since;
  const parsed = sinceRaw !== undefined ? Number.parseInt(sinceRaw, 10) : -1;
  const sinceSeq = Number.isNaN(parsed) ? -1 : parsed;

  return {
    kind: 'stream',
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-persona-run-id': runId,
    },
    body: withHeartbeats(driver.subscribe(sinceSeq), ctx.heartbeatIntervalMs),
  };
};
