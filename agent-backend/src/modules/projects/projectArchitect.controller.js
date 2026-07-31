import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import rateLimiterService from '../rateLimiter/rateLimiter.service.js';
import RateLimitError from '../../utils/errors/RateLimitError.js';
import { PROJECT_ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import { readJsonBody, runAgentAsAguiEvents } from '../agui/agui.service.js';

/**
 * Project Agent Architect runtime (blueprint Phase 11.5, PR-62) — a
 * Clerk-session-authenticated AG-UI-shaped endpoint whose only job is
 * running the dedicated `PROJECT_ARCHITECT_AGENT_ID` sentinel with the
 * caller's own `ProjectAdminContext`. Structurally similar to
 * `developerAgui.controller.js`'s `runAgent`, but:
 *   - Authenticated via Clerk + `projectAdminAuthMiddleware` (this
 *     Project's own Admin), never a Project's own machine credential.
 *   - Always targets this one specific sentinel agent — there is nothing
 *     else to select, so no `x-agent-id` header is read.
 *   - No Thread resume / subagent-trace persistence: this conversation has
 *     no DB-backed Thread document (Project Thread CRUD is scoped to
 *     `ProjectRuntimeContext` only, not Admins) — just a deterministic
 *     LangGraph thread id scoped to the Project, one shared conversation
 *     per Project regardless of which of its Admins is chatting (matches
 *     `agent.factory.js`'s PROJECT_ARCHITECT_AGENT_ID cache-key reasoning).
 *   - The Persona `/api/v1/agui` route and the machine-credential
 *     `/api/v1/developer/agui` route are both untouched by this addition.
 */
class ProjectArchitectController {
  async getProtocolInfo(req, res) {
    res.json({ protocol: 'ag-ui', transport: 'sse', status: 'ok' });
  }

  async runAgent(req, res, next) {
    const context = req.projectAdminContext;
    const concurrencyKey = `concurrency:CHAT:architect:${context.domain}`;

    if (rateLimiterService.getConcurrency(concurrencyKey) >= 2) {
      return next(new RateLimitError(30));
    }

    rateLimiterService.incrementConcurrency(concurrencyKey);

    try {
      const input = await readJsonBody(req);
      const langGraphThreadId = `architect-${context.domain}`;
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
        agentId: PROJECT_ARCHITECT_AGENT_ID,
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

export default new ProjectArchitectController();
