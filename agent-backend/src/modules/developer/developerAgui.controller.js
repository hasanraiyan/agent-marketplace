import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import rateLimiterService from '../rateLimiter/rateLimiter.service.js';
import RateLimitError from '../../utils/errors/RateLimitError.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import BaseError from '../../utils/errors/BaseError.js';
import agentRepository from '../agents/agent.repository.js';
import agentService from '../agents/agent.service.js';
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import { readJsonBody, runAgentAsAguiEvents } from '../agui/agui.service.js';

/**
 * Developer Platform runtime execution (blueprint Phase 8, PR-23b).
 *
 * Deliberately narrower than the Persona /api/v1/agui route for its first
 * version:
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
 * - No x-thread-id / explicit Thread resumption yet — every call uses the
 *   Domain-extended deterministic LangGraph thread id
 *   (agui-${domain}-${agentId}-${externalUserId}, AD-05 §14), which is
 *   already stable/continuous across calls for the same (domain, agent,
 *   externalUser) triple. No Conversation document is created (same
 *   "lazy" fallback mode the Persona route itself supports when no
 *   threadDbId is given — no title, no persisted subagent traces, no
 *   thread-list entry). Named/multiple Threads per external user are a
 *   Developer control-plane (blueprint Phase 9) follow-up, not built here.
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
      const langGraphThreadId = `agui-${domain}-${agentId}-${externalUserId}`;
      const threadId = input.threadId || langGraphThreadId;
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

      send({ type: EventType.RUN_STARTED, threadId, runId });
      for await (const event of runAgentAsAguiEvents({
        agentId,
        userId: externalUserId,
        langGraphThreadId,
        messages: input.messages || [],
        resume: input.resume,
        signal: controller.signal,
        executionContext: context,
      })) {
        if (res.destroyed) break;
        send(event);
      }
      send({ type: EventType.RUN_FINISHED, threadId, runId });
      res.end();
    } catch (err) {
      next(err);
    } finally {
      rateLimiterService.decrementConcurrency(concurrencyKey);
    }
  }
}

export default new DeveloperAguiController();
