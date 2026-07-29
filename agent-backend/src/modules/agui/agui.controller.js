import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import rateLimiterService from '../rateLimiter/rateLimiter.service.js';
import RateLimitError from '../../utils/errors/RateLimitError.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import threadRepository from '../threads/thread.repository.js';
import agentRepository from '../agents/agent.repository.js';
import agentService, { personaExecutionContext } from '../agents/agent.service.js';
import { loggerService } from '../../utils/index.js';
import { foldSubagentEvent, settleTrace } from './subagentTrace.js';
import { readJsonBody, runAgentAsAguiEvents } from './agui.service.js';

const logger = loggerService.getLogger();

class AguiController {
  /**
   * GET / — Protocol info endpoint for AGUI handshake.
   */
  async getProtocolInfo(req, res) {
    res.json({
      protocol: 'ag-ui',
      transport: 'sse',
      status: 'ok',
    });
  }

  /**
   * POST / — Run agent as AGUI SSE event stream.
   *
   * Sets up Server-Sent Events headers, manages concurrency,
   * creates an AbortController tied to the client connection,
   * streams events from runAgentAsAguiEvents, and persists
   * subagent traces after the stream ends.
   */
  async runAgent(req, res, next) {
    const context = req.aguiContext || {};
    const identifier = context.userId || req.ip;
    const concurrencyKey = `concurrency:CHAT:${identifier}`;

    if (rateLimiterService.getConcurrency(concurrencyKey) >= 2) {
      return next(new RateLimitError(30));
    }

    rateLimiterService.incrementConcurrency(concurrencyKey);

    try {
      if (!context.agentId) {
        throw new NotFoundError('Agent ID is required');
      }

      // Check authorization BEFORE starting the SSE response stream
      let agent;
      try {
        agent = await agentRepository.findById(context.agentId);
      } catch {
        // Bad object ID format or database error -> treat as not found
        agent = null;
      }

      if (
        !agent ||
        !agentService.canUserExecuteAgent(agent, personaExecutionContext(context.userId))
      ) {
        throw new NotFoundError('Agent not found');
      }

      const input = await readJsonBody(req);
      const threadId = input.threadId || context.langGraphThreadId || 'default';
      const runId = input.runId || crypto.randomUUID();

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const controller = new AbortController();
      res.on('close', () => controller.abort());

      const send = (event) => {
        if (res.destroyed) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Subagent timelines exist only in the live stream (checkpoints hold just
      // the main thread's messages) — fold them here and persist per task call
      // so the subagent's transcript survives thread reloads.
      const subagentTraces = {};

      send({ type: EventType.RUN_STARTED, threadId, runId });
      for await (const event of runAgentAsAguiEvents({
        ...context,
        messages: input.messages || [],
        resume: input.resume,
        signal: controller.signal,
      })) {
        if (res.destroyed) break;
        if (event?.type === EventType.CUSTOM && event.name === 'subagent_activity') {
          const callId = event.value?.toolCallId;
          if (callId) {
            foldSubagentEvent((subagentTraces[callId] ??= []), event.value);
          }
        }
        send(event);
      }
      send({ type: EventType.RUN_FINISHED, threadId, runId });
      res.end();

      if (context.threadDbId && Object.keys(subagentTraces).length > 0) {
        // Per-key $set merges this run's traces with earlier turns' instead of
        // replacing the whole map. Fire-and-forget — persistence must not
        // delay or fail the response.
        const setOps = {};
        for (const [callId, items] of Object.entries(subagentTraces)) {
          setOps[`subagentTraces.${callId}`] = settleTrace(items);
        }
        threadRepository
          .update(context.threadDbId, { $set: setOps })
          .catch((err) =>
            logger.warn('[AG-UI] failed to persist subagent traces', { err: err.message })
          );
      }
    } catch (err) {
      next(err);
    } finally {
      rateLimiterService.decrementConcurrency(concurrencyKey);
    }
  }
}

export default new AguiController();
