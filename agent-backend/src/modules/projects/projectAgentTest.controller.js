import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import rateLimiterService from '../rateLimiter/rateLimiter.service.js';
import RateLimitError from '../../utils/errors/RateLimitError.js';
import agentService from '../agents/agent.service.js';
import { readJsonBody, runAgentAsAguiEvents } from '../agui/agui.service.js';

/**
 * Developer Studio "Test" playground — lets a Project Admin chat with one
 * of their OWN Agents (not the fixed Architect sentinel) to see its actual
 * configured behavior before wiring it into a real integration. Structurally
 * a near-exact copy of `projectArchitect.controller.js`'s `runAgent` — same
 * Clerk + `projectAdminAuthMiddleware` auth, same raw-body/SSE handling,
 * same `runAgentAsAguiEvents` engine — with two differences:
 *   - `agentId` comes from the URL (`:agentId`), not a hardcoded sentinel.
 *   - Ownership is checked explicitly via `agentService.getDeveloperAgentById`
 *     (throws if the agent doesn't exist or isn't this Project's) BEFORE any
 *     streaming starts — the Architect route skips this because there's
 *     nothing to select, but here a Project Admin could otherwise supply any
 *     agentId in the URL, including one they don't own.
 */
class ProjectAgentTestController {
  async getProtocolInfo(req, res) {
    res.json({ protocol: 'ag-ui', transport: 'sse', status: 'ok' });
  }

  async runAgent(req, res, next) {
    const context = req.projectAdminContext;
    const { agentId } = req.params;

    try {
      await agentService.getDeveloperAgentById(agentId, context);
    } catch {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const concurrencyKey = `concurrency:CHAT:agent-test:${context.domain}:${agentId}`;
    if (rateLimiterService.getConcurrency(concurrencyKey) >= 2) {
      return next(new RateLimitError(30));
    }
    rateLimiterService.incrementConcurrency(concurrencyKey);

    try {
      const input = await readJsonBody(req);
      const langGraphThreadId = `agent-test-${context.domain}-${agentId}`;
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

      send({ type: EventType.RUN_STARTED, threadId: langGraphThreadId, runId });
      for await (const event of runAgentAsAguiEvents({
        agentId,
        userId: context.domain,
        langGraphThreadId,
        messages: input.messages || [],
        resume: input.resume,
        signal: controller.signal,
        executionContext: context,
      })) {
        if (res.destroyed) break;
        send(event);
      }
      send({ type: EventType.RUN_FINISHED, threadId: langGraphThreadId, runId });
      res.end();
    } catch (err) {
      next(err);
    } finally {
      rateLimiterService.decrementConcurrency(concurrencyKey);
    }
  }
}

export default new ProjectAgentTestController();
