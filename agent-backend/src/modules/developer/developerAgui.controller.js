import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import rateLimiterService from '../rateLimiter/rateLimiter.service.js';
import RateLimitError from '../../utils/errors/RateLimitError.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import BaseError from '../../utils/errors/BaseError.js';
import agentRepository from '../agents/agent.repository.js';
import agentService from '../agents/agent.service.js';
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import threadRepository from '../threads/thread.repository.js';
import threadService from '../threads/thread.service.js';
import { foldSubagentEvent, settleTrace } from '../agui/subagentTrace.js';
import { readJsonBody, runAgentAsAguiEvents } from '../agui/agui.service.js';

/**
 * Developer Platform runtime execution (blueprint Phase 8, PR-23b; Thread
 * resume wired in at blueprint Phase 9, PR-41).
 *
 * - Only ProjectRuntimeContext callers may execute an Agent — a bare
 *   ProjectMachineContext (no asserted external user) has no Subject to
 *   scope a conversation, memory, or rate limit to, so it's rejected
 *   outright rather than silently falling back to some shared identity.
 * - The Architect meta-agent (ARCHITECT_AGENT_ID) is explicitly blocked.
 *   `canUserExecuteAgent`'s virtual-agent branch always returns true
 *   regardless of context (by design, for the Persona-only Architect), so
 *   it does NOT enforce a Domain match — this route must not rely on that
 *   check alone to keep Project callers away from Persona's own
 *   agent-management tooling.
 * - **Thread resume (PR-41):** an `x-thread-id` header (or `threadId` body
 *   field) naming one of PR-40's real Threads is now looked up via
 *   `threadService.getThreadById` (Subject + Domain verified) and, if it
 *   also belongs to the requested `agentId`, resumes that Thread's real
 *   LangGraph checkpoint — mirroring the Persona `/api/v1/agui` route's
 *   own `agui.routes.js` middleware exactly, including its "no valid
 *   thread was given" silent-fallback behavior (PR-15's fix, AD-05 §29):
 *   a missing/foreign/wrong-agent thread id is never a request error, it
 *   just falls back to the domain-extended deterministic thread id, same
 *   as before this PR. `lastMessageAt` is touched and subagent traces are
 *   persisted onto the resolved Thread document, same as Persona's own
 *   `agui.controller.js`. Omitting `x-thread-id` keeps the exact PR-23b
 *   behavior (one implicit conversation per (Agent, external user), no
 *   Conversation document touched) — this is additive, not a breaking
 *   change to existing callers.
 */
class DeveloperAguiController {
  async getProtocolInfo(req, res) {
    res.json({ protocol: 'ag-ui', transport: 'sse', status: 'ok' });
  }

  async runAgent(req, res, next) {
    const context = req.projectContext;

    if (context?.principalType !== 'ProjectRuntime') {
      return next(
        new BaseError(
          'Executing an Agent requires an asserted external user (x-persona-external-user-id)',
          400,
          'EXTERNAL_USER_REQUIRED'
        )
      );
    }

    const { domain, externalUserId } = context;
    const agentId = req.headers['x-agent-id'] || req.query.agentId;
    const concurrencyKey = `concurrency:CHAT:${domain}:${externalUserId}`;

    if (rateLimiterService.getConcurrency(concurrencyKey) >= 2) {
      return next(new RateLimitError(30));
    }

    rateLimiterService.incrementConcurrency(concurrencyKey);

    try {
      if (!agentId) {
        throw new NotFoundError('Agent ID is required');
      }
      if (String(agentId) === ARCHITECT_AGENT_ID) {
        // Existence-hiding (AD-07 §29): same not-found shape as any other
        // rejected agentId, never a distinguishable error revealing that
        // this id is special.
        throw new NotFoundError('Agent not found');
      }

      let agent;
      try {
        agent = await agentRepository.findById(agentId);
      } catch {
        agent = null;
      }

      if (!agent || !agentService.canUserExecuteAgent(agent, context)) {
        throw new NotFoundError('Agent not found');
      }

      const input = await readJsonBody(req);
      const deterministicThreadId = `agui-${domain}-${agentId}-${externalUserId}`;
      const threadDbId = req.headers['x-thread-id'] || input.threadId;

      let langGraphThreadId = deterministicThreadId;
      let resolvedThread = null;
      if (threadDbId) {
        try {
          const thread = await threadService.getThreadById(threadDbId, undefined, context);
          // `thread.agentId` comes back populated (thread.repository.js's
          // findById always populates it for display purposes), so it must
          // be compared via its `._id` — comparing the populated document
          // itself with a bare id string never matches.
          const threadAgentId = thread.agentId?._id ?? thread.agentId;
          if (String(threadAgentId) === String(agentId)) {
            langGraphThreadId = thread.threadId;
            resolvedThread = thread;
            await threadRepository.touchLastMessageAt(thread._id);
          }
        } catch {
          // Not found / not this Subject's / wrong Domain — fall back to
          // the deterministic thread id, same silent-fallback contract as
          // the Persona route (PR-15).
        }
      }

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

      // Subagent timelines exist only in the live stream (checkpoints hold
      // just the main thread's messages) — fold them here and persist onto
      // the resolved Thread, same as Persona's agui.controller.js.
      const subagentTraces = {};

      send({ type: EventType.RUN_STARTED, threadId: langGraphThreadId, runId });
      for await (const event of runAgentAsAguiEvents({
        agentId,
        userId: externalUserId,
        langGraphThreadId,
        threadDbId: resolvedThread?._id,
        messages: input.messages || [],
        resume: input.resume,
        signal: controller.signal,
        executionContext: context,
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
      send({ type: EventType.RUN_FINISHED, threadId: langGraphThreadId, runId });
      res.end();

      if (resolvedThread && Object.keys(subagentTraces).length > 0) {
        // Per-key $set merges this run's traces with earlier turns' instead
        // of replacing the whole map. Fire-and-forget — persistence must
        // not delay or fail the response.
        const setOps = {};
        for (const [callId, items] of Object.entries(subagentTraces)) {
          setOps[`subagentTraces.${callId}`] = settleTrace(items);
        }
        threadRepository.update(resolvedThread._id, { $set: setOps }).catch(() => {});
      }
    } catch (err) {
      next(err);
    } finally {
      rateLimiterService.decrementConcurrency(concurrencyKey);
    }
  }
}

export default new DeveloperAguiController();
