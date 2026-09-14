import crypto from 'crypto';
import { EventType } from '@ag-ui/core';
import rateLimiterService from '../rateLimiter/rateLimiter.service.js';
import RateLimitError from '../../utils/errors/RateLimitError.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import { DEVELOPER_ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import { readJsonBody, runAgentAsAguiEvents } from '../agui/agui.service.js';
import threadRepository from '../threads/thread.repository.js';
import threadService from '../threads/thread.service.js';
import checkpointService from '../threads/checkpoint.service.js';
import {
  foldSubagentEvent,
  reconcileSubagentTraceKeys,
  extractTaskToolCallIds,
  settleTrace,
} from '../agui/subagentTrace.js';

/**
 * Developer Platform Architect runtime — a machine-credential-authenticated
 * AG-UI-shaped endpoint whose only job is running the dedicated
 * `DEVELOPER_ARCHITECT_AGENT_ID` sentinel with the caller's own
 * `req.projectContext` (a `ProjectMachineContext` or `ProjectRuntimeContext`,
 * set by `developerMachineAuthMiddleware`). Structurally close to
 * `projectArchitect.controller.js`'s `runAgent`, but:
 *   - Authenticated via the Project's own machine credential
 *     (`developerMachineAuthMiddleware`), never Clerk — reachable from
 *     `@personaai/sdk`, unlike the Clerk/Project-Admin-only Project
 *     Architect.
 *   - Works with EITHER principal type reaching this route: a bare
 *     `ProjectMachineContext` (no asserted external user) builds/edits
 *     Agents owned by the whole Project — the SDK-reachable equivalent of
 *     a Project Admin using the Project Architect. An asserted
 *     `ProjectRuntimeContext` (credential + `x-persona-external-user-id`)
 *     builds/edits Agents owned by that one external user instead —
 *     `agentService.createDeveloperAgent`'s existing `context.principalType`
 *     branch already handles both automatically (see
 *     `agent.factory.js`'s DEVELOPER_ARCHITECT_AGENT_ID branch and
 *     `tools/index.js`'s dispatch to the unmodified `projectBuilder.tools.js`
 *     toolbox) — this controller does not need to know which mode it's in.
 *   - Thread scoping MUST differ per external user, unlike the Project
 *     Architect's single Project-wide shared thread: two different
 *     external users talking to their own Architect must never land on
 *     the same LangGraph conversation. See `langGraphThreadId` below.
 *   - **Thread resume:** only exists for an asserted external user
 *     (`ProjectRuntimeContext`) — `thread.service.js`'s Subject model has
 *     no shape for a bare Project credential (same restriction
 *     `developerThread.routes.js` enforces on the Thread CRUD endpoints
 *     themselves), so a bare `ProjectMachineContext` keeps using its single
 *     deterministic per-Project conversation unconditionally, exactly as
 *     before. For a `ProjectRuntimeContext` caller, an `x-thread-id` header
 *     (or `threadId` body field) naming one of `developerThread.controller.js`'s
 *     Threads for this same Architect sentinel resumes that Thread's real
 *     LangGraph checkpoint — same pattern `developerAgui.controller.js`
 *     already uses for regular Agents. A missing/foreign/wrong-agent
 *     `threadId` is a 404 ("Thread not found"), never a silent fallback to
 *     the deterministic conversation, for the same reason
 *     `developerAgui.controller.js` rejects instead of falling back.
 *     Subagent traces are persisted onto the resolved Thread, same as
 *     `projectArchitect.controller.js`.
 */
class DeveloperArchitectController {
  async getProtocolInfo(req, res) {
    res.json({ protocol: 'ag-ui', transport: 'sse', status: 'ok' });
  }

  async runAgent(req, res, next) {
    const context = req.projectContext;
    const scopeKey = context.externalUserId
      ? `${context.domain}:${context.externalUserId}`
      : `${context.domain}:project`;
    const concurrencyKey = `concurrency:CHAT:architect:${scopeKey}`;

    if (rateLimiterService.getConcurrency(concurrencyKey) >= 2) {
      return next(new RateLimitError(30));
    }

    rateLimiterService.incrementConcurrency(concurrencyKey);

    try {
      const input = await readJsonBody(req);
      // Domain-qualified always; further qualified by externalUserId when
      // asserted, so each external user gets their own private conversation
      // instead of sharing one Project-wide thread (the Project Architect's
      // single-shared-thread design is intentional there since every caller
      // is a Project Admin managing the same Project-owned agents — that
      // assumption does not hold here).
      const deterministicThreadId = `architect-${scopeKey}`;
      const threadDbId = req.headers['x-thread-id'] || input.threadId;

      let langGraphThreadId = deterministicThreadId;
      let resolvedThread = null;

      if (threadDbId && context.principalType === 'ProjectRuntime') {
        let thread = null;
        try {
          thread = await threadService.getThreadById(threadDbId, undefined, context);
        } catch {
          thread = null;
        }
        // `thread.agentId` comes back populated (thread.repository.js's
        // findById always populates it for display purposes) — but the
        // Architect sentinel is never a real Agent row, so the populate
        // silently no-ops and leaves the raw id string in place. Compare
        // via `._id` first so a populated regular-Agent thread still
        // matches correctly, falling back to the raw value for the
        // sentinel case.
        const threadAgentId = thread?.agentId?._id ?? thread?.agentId;
        if (!thread || String(threadAgentId) !== String(DEVELOPER_ARCHITECT_AGENT_ID)) {
          throw new NotFoundError('Thread not found');
        }
        langGraphThreadId = thread.threadId;
        resolvedThread = thread;
        await threadRepository.touchLastMessageAt(thread._id);
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

      const subagentTraces = {};

      send({ type: EventType.RUN_STARTED, threadId: langGraphThreadId, runId });
      for await (const event of runAgentAsAguiEvents({
        agentId: DEVELOPER_ARCHITECT_AGENT_ID,
        // `identityKey` (agent.factory.js) — which the /memories/user/ and
        // /memories/agent/ namespaces are keyed by — falls back to
        // `String(userId)` for any non-ProjectRuntime context. A bare
        // ProjectMachineContext has no externalUserId, so without this
        // fallback every Project's machine-credential Architect session
        // would collide onto the literal namespace "undefined". Passing
        // `context.domain` here (same trick projectArchitect.controller.js
        // already uses) keeps it Project-qualified instead. Harmless for the
        // ProjectRuntime case: identityKey ignores `userId` entirely then.
        userId: context.externalUserId ?? context.domain,
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
        let reconciled = subagentTraces;
        try {
          const snapshot = await checkpointService.checkpointer?.getTuple({
            configurable: { thread_id: langGraphThreadId },
          });
          const rawMessages = snapshot?.checkpoint?.channel_values?.messages;
          if (rawMessages) {
            reconciled = reconcileSubagentTraceKeys(subagentTraces, extractTaskToolCallIds(rawMessages));
          }
        } catch {
          // Persist provisional keys if reconciliation fails
        }

        const setOps = {};
        for (const [callId, items] of Object.entries(reconciled)) {
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

export default new DeveloperArchitectController();
