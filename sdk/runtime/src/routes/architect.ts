import type { ChatMessageInput, ChatResume } from '@personaai/sdk';
import type { RouteHandler } from '../routing.js';
import { RuntimeHttpError } from '../errors.js';
import { RunDriver } from '../runDriver.js';
import { withHeartbeats } from '../heartbeat.js';
import type { RunContext } from '../types/hooks.js';

interface ArchitectBody {
  messages: ChatMessageInput[];
  resume?: ChatResume;
}

function parseArchitectBody(body: unknown): ArchitectBody {
  if (typeof body !== 'object' || body === null) {
    throw new RuntimeHttpError(400, 'INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) {
    throw new RuntimeHttpError(
      400,
      'INVALID_REQUEST',
      '"messages" is required and must be an array.'
    );
  }
  return {
    messages: b.messages as ChatMessageInput[],
    resume: (b.resume as ChatResume | undefined) ?? undefined,
  };
}

/**
 * Starts a run against the Architect — a co-pilot that creates/edits Agents
 * on the caller's behalf via tool calls, as the asserted external user (so
 * it builds/edits *their* agents, not the Project's shared roster). Requires
 * capabilities.architect. Reuses the exact same RunDriver/reconnect/
 * heartbeat mechanics as `POST /chat` (see routes/chat.ts) — the Architect
 * just has no `agentId`/`threadId` of its own to pass through.
 */
export const architectRoute: RouteHandler = async (request, ctx) => {
  const logger = ctx.logger.child('architect');
  logger.debug('architectRoute start', { userId: request.userId });
  const body = parseArchitectBody(request.body);
  logger.trace('architectRoute body', {
    messageCount: body.messages?.length ?? 0,
    hasResume: !!body.resume,
  });
  const userId = request.userId as string;

  const runCtx: RunContext = {
    userId,
    kind: 'architect',
    messages: body.messages,
  };

  logger.debug('beforeRun hook (architect)', { userId });
  await ctx.hooks?.beforeRun?.(runCtx);
  logger.trace('beforeRun completed (architect)');

  logger.debug('starting architect stream');
  const stream = ctx.client.architect.stream({
    messages: body.messages,
    resume: body.resume,
  });

  const runId = crypto.randomUUID();
  logger.info('architect run created', { runId, userId });
  const driver = new RunDriver(runId, runCtx, stream, ctx.hooks, ctx.mode);
  ctx.runs.set(runId, driver);
  logger.debug('architect driver registered', { runId, trackedRuns: ctx.runs.size });

  try {
    await driver.waitForFirstFrame();
    logger.debug('architect first frame ready', { runId });
  } catch (err) {
    logger.warn('architect run failed before first frame', {
      runId,
      error: err instanceof Error ? err.message : String(err),
    });
    ctx.runs.delete(runId);
    throw err;
  }

  logger.info('architect stream ready', { runId });
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
