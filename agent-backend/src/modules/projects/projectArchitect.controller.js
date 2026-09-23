import crypto from 'crypto';
import mongoose from 'mongoose';
import { EventType } from '@ag-ui/core';
import rateLimiterService from '../rateLimiter/rateLimiter.service.js';
import RateLimitError from '../../utils/errors/RateLimitError.js';
import { PROJECT_ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import { readJsonBody, runAgentAsAguiEvents } from '../agui/agui.service.js';
import Conversation from '../threads/thread.model.js';
import checkpointService from '../threads/checkpoint.service.js';
import {
  foldSubagentEvent,
  reconcileSubagentTraceKeys,
  extractTaskToolCallIds,
  settleTrace,
} from '../agui/subagentTrace.js';

/**
 * Project Agent Architect runtime (blueprint Phase 11.5, PR-62) — a
 * Clerk-session-authenticated AG-UI-shaped endpoint whose only job is
 * running the dedicated `PROJECT_ARCHITECT_AGENT_ID` sentinel with the
 * caller's own `ProjectAdminContext`. Structurally near-identical to
 * `projectAgentTest.controller.js`'s `runAgent`, but:
 *   - Always targets this one specific sentinel agent — there is nothing
 *     else to select, so no `x-agent-id` header is read.
 *   - Thread resume works against `Conversation` rows scoped to
 *     `agentId: PROJECT_ARCHITECT_AGENT_ID` (created via
 *     `project.controller.js`'s thread-CRUD handlers, which special-case
 *     this same sentinel) — the default thread id is
 *     `architect-${domain}`, matching the single deterministic id this
 *     route used before per-thread history existed, so existing
 *     conversations keep resolving to the same LangGraph checkpoint.
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
      const requestedThreadId = req.headers['x-thread-id'] || input.threadId;
      const defaultThreadId = `architect-${context.domain}`;

      let resolvedThread = null;
      let langGraphThreadId = defaultThreadId;

      if (requestedThreadId && requestedThreadId !== 'default' && requestedThreadId !== 'new') {
        const query = mongoose.isValidObjectId(requestedThreadId)
          ? { _id: requestedThreadId, domain: context.domain, agentId: PROJECT_ARCHITECT_AGENT_ID }
          : {
              threadId: requestedThreadId,
              domain: context.domain,
              agentId: PROJECT_ARCHITECT_AGENT_ID,
            };
        resolvedThread = await Conversation.findOne(query);
        if (resolvedThread) {
          langGraphThreadId = resolvedThread.threadId;
        }
      }

      if (!resolvedThread) {
        resolvedThread = await Conversation.findOne({
          domain: context.domain,
          agentId: PROJECT_ARCHITECT_AGENT_ID,
          threadId: langGraphThreadId,
        });
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
        agentId: PROJECT_ARCHITECT_AGENT_ID,
        userId: context.domain,
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

      if (resolvedThread) {
        await Conversation.findByIdAndUpdate(resolvedThread._id, {
          lastMessageAt: new Date(),
        }).catch(() => {});
        if (Object.keys(subagentTraces).length > 0) {
          let reconciled = subagentTraces;
          try {
            const snapshot = await checkpointService.checkpointer?.getTuple({
              configurable: { thread_id: langGraphThreadId },
            });
            const rawMessages = snapshot?.checkpoint?.channel_values?.messages;
            if (rawMessages) {
              reconciled = reconcileSubagentTraceKeys(
                subagentTraces,
                extractTaskToolCallIds(rawMessages)
              );
            }
          } catch {
            // Persist provisional keys if reconciliation fails
          }

          const setOps = {};
          for (const [callId, items] of Object.entries(reconciled)) {
            setOps[`subagentTraces.${callId}`] = settleTrace(items);
          }
          await Conversation.findByIdAndUpdate(resolvedThread._id, { $set: setOps }).catch(
            () => {}
          );
        }
      }
    } catch (err) {
      next(err);
    } finally {
      rateLimiterService.decrementConcurrency(concurrencyKey);
    }
  }
}

export default new ProjectArchitectController();
