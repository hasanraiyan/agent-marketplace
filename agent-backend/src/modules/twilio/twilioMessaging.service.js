import { EventType } from '@ag-ui/core';
import { LRUCache } from 'lru-cache';
import twilioService from './twilio.service.js';
import agentRepository from '../agents/agent.repository.js';
import {
  ARCHITECT_AGENT_ID,
  PROJECT_ARCHITECT_AGENT_ID,
  DEVELOPER_ARCHITECT_AGENT_ID,
} from '../agents/architectConstants.js';
import externalUserService from '../externalUsers/externalUser.service.js';
import projectCredentialRepository from '../projects/projectCredential.repository.js';
import { createProjectRuntimeContext } from '../auth/projectPrincipalContext.js';
import { assertNoGuardedTools } from '../voice/voice.service.js';
import { runAgentAsAguiEvents } from '../agui/agui.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

const ARCHITECT_AGENT_IDS = new Set([
  ARCHITECT_AGENT_ID,
  PROJECT_ARCHITECT_AGENT_ID,
  DEVELOPER_ARCHITECT_AGENT_ID,
]);

// A text turn is typically much faster than a voice call, but tool-heavy
// turns (MCP/RCP/knowledge) can still take a while. Bound it so a stuck
// run never holds the conversation queue forever.
const AGENT_TURN_TIMEOUT_MS = 120_000;

// Twilio retries webhooks on non-2xx / timeout, often with the same
// MessageSid. An hour is far longer than any retry window and keeps the
// cache bounded without a database round-trip per inbound message.
const DEDUPE_MAX = 2000;
const DEDUPE_TTL_MS = 60 * 60 * 1000;

const MAX_INBOUND_BODY_LENGTH = 8000;

const FALLBACK_UNAVAILABLE = 'This assistant is not available right now. Please try again later.';
const FALLBACK_GUARDED =
  'This assistant is not available on this channel yet. Please try again later.';
const FALLBACK_ERROR = 'Sorry, something went wrong while handling your message. Please try again.';
const FALLBACK_EMPTY = "Sorry, I couldn't come up with a reply just now. Please try again.";
const FALLBACK_MEDIA =
  'I can only read text messages right now. Please send your question as text.';

/**
 * SMS / WhatsApp inbound + agent-composed outbound pipeline for Twilio
 * (the text-channel sibling of twilioGateway.js's voice bridge).
 *
 * Identity is shared by E.164 number with voice: same
 * `agui-${projectId}-${agentId}-${phone}` LangGraph thread id, same
 * `ProjectRuntimeContext` (`externalUserId` = normalized phone). A
 * conversation started by phone call therefore continues over WhatsApp or
 * SMS without a separate Thread document — matching the voice bridge's
 * deliberate "no Thread row" behavior.
 *
 * Inbound webhook handling is fire-and-forget: Twilio needs a fast 2xx or
 * it retries (and re-sends), so the controller acknowledges before this
 * pipeline runs. Turns are serialized per (project, agent, phone) so two
 * messages arriving in the same second can't interleave checkpoint writes.
 */
class TwilioMessagingService {
  constructor() {
    this.seenMessageSids = new LRUCache({ max: DEDUPE_MAX, ttl: DEDUPE_TTL_MS });
    this.conversationQueues = new Map();
  }

  /**
   * Returns true if this inbound MessageSid was already handled. Twilio
   * reuses the SID when retrying the same message.
   */
  registerInboundMessage(messageSid) {
    if (!messageSid) return false;
    if (this.seenMessageSids.has(messageSid)) return true;
    this.seenMessageSids.set(messageSid, true);
    return false;
  }

  buildThreadId(projectId, agentId, phone) {
    return `agui-${projectId}-${agentId}-${phone}`;
  }

  /**
   * Serializes work per conversation. Returns the enqueued promise; the
   * queue entry is dropped once it settles so idle conversations don't
   * accumulate in memory.
   */
  enqueueConversation(key, task) {
    const previous = this.conversationQueues.get(key) || Promise.resolve();
    const run = previous.catch(() => {}).then(task);
    const tracked = run.finally(() => {
      if (this.conversationQueues.get(key) === tracked) {
        this.conversationQueues.delete(key);
      }
    });
    this.conversationQueues.set(key, tracked);
    return tracked;
  }

  /**
   * Inbound SMS/WhatsApp message. Resolves to a small result object; never
   * throws — errors are logged and (where possible) answered with a
   * generic reply, because the HTTP layer has already responded 200.
   */
  async handleInboundMessage({
    projectId,
    agentId,
    from,
    body,
    messageSid,
    profileName,
    mediaUrls = [],
  }) {
    const phone = twilioService.normalizePhoneNumber(from);
    if (!projectId || !agentId || !phone) {
      logger.warn('[TwilioMessaging] Ignoring inbound message with missing routing info', {
        projectId,
        agentId,
        from,
        messageSid,
      });
      return { handled: false, reason: 'missing_routing' };
    }

    const channel = twilioService.detectChannel(from);
    const text = String(body || '')
      .trim()
      .slice(0, MAX_INBOUND_BODY_LENGTH);

    if (!text) {
      if (mediaUrls.length > 0) {
        await this.reply({ projectId, phone, channel, text: FALLBACK_MEDIA });
      }
      return { handled: false, reason: 'empty_body' };
    }

    const key = `${projectId}:${agentId}:${phone}`;
    return this.enqueueConversation(key, async () => {
      logger.info('[TwilioMessaging] Agent turn started', {
        projectId,
        agentId,
        channel,
        messageSid,
      });

      const agent = await this.resolveChannelAgent(projectId, agentId);
      if (!agent) {
        logger.warn('[TwilioMessaging] Agent unavailable for inbound conversation', {
          projectId,
          agentId,
          messageSid,
        });
        await this.reply({ projectId, phone, channel, text: FALLBACK_UNAVAILABLE });
        return { handled: false, reason: 'agent_unavailable' };
      }

      try {
        assertNoGuardedTools(agent);
      } catch (err) {
        logger.warn('[TwilioMessaging] Refusing agent with guarded tools', {
          projectId,
          agentId,
          messageSid,
        });
        await this.reply({ projectId, phone, channel, text: FALLBACK_GUARDED });
        return { handled: false, reason: 'guarded_tools', errorCode: err?.code };
      }

      try {
        const { reply, runError } = await this.generateAgentReply({
          projectId,
          agentId,
          phone,
          text,
          displayName: profileName,
        });

        const outgoing = reply || (runError ? FALLBACK_ERROR : FALLBACK_EMPTY);

        const sent = await this.reply({ projectId, phone, channel, text: outgoing });
        return {
          handled: true,
          replied: Boolean(sent),
          runError: runError ? { code: runError.code, message: runError.message } : null,
        };
      } catch (err) {
        logger.error('[TwilioMessaging] Agent turn failed', {
          projectId,
          agentId,
          messageSid,
          err: err?.message,
        });
        await this.reply({ projectId, phone, channel, text: FALLBACK_ERROR });
        return { handled: false, reason: 'run_failed', errorCode: err?.code };
      }
    });
  }

  /**
   * Admin-composed outbound: runs the agent on the same shared thread for
   * this phone number, then delivers its reply over the requested channel.
   * Unlike an inbound wave, the caller awaits the final Twilio result.
   */
  async sendAgentMessage({ projectId, agentId, to, channel = null, prompt, displayName = null }) {
    const phone = twilioService.normalizePhoneNumber(to);
    if (!phone) {
      const err = new Error('Recipient "to" is required (E.164 format, e.g. +91...)');
      err.statusCode = 400;
      err.code = 'PHONE_NUMBER_REQUIRED';
      throw err;
    }
    if (!agentId) {
      const err = new Error('Agent ID is required');
      err.statusCode = 400;
      err.code = 'AGENT_ID_REQUIRED';
      throw err;
    }

    const text = String(prompt || '').trim();
    if (!text) {
      const err = new Error('A prompt is required to compose an agent message');
      err.statusCode = 400;
      err.code = 'MESSAGE_PROMPT_REQUIRED';
      throw err;
    }

    const agent = await this.resolveChannelAgent(projectId, agentId);
    if (!agent) {
      const err = new Error('Agent not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    assertNoGuardedTools(agent);

    const resolvedChannel =
      channel === 'whatsapp' || channel === 'sms' ? channel : twilioService.detectChannel(to);
    const key = `${projectId}:${agentId}:${phone}`;

    return this.enqueueConversation(key, async () => {
      const { reply, runError } = await this.generateAgentReply({
        projectId,
        agentId,
        phone,
        text: text.slice(0, MAX_INBOUND_BODY_LENGTH),
        displayName,
      });

      if (runError) {
        const err = new Error(runError.message || 'Agent run failed');
        err.statusCode = 502;
        err.code = runError.code || 'AGENT_RUN_FAILED';
        throw err;
      }
      if (!reply) {
        const err = new Error('The agent produced an empty reply');
        err.statusCode = 502;
        err.code = 'AGENT_EMPTY_REPLY';
        throw err;
      }

      const result = await twilioService.sendMessage({
        projectId,
        to: phone,
        channel: resolvedChannel,
        body: reply,
      });

      return { agentId, ...result };
    });
  }

  /**
   * Runs one agent turn on the caller's shared conversation thread and
   * collects the assistant's text. Tool activity, reasoning, and state
   * snapshots are intentionally ignored — only final text is deliverable
   * over SMS/WhatsApp.
   */
  async generateAgentReply({ projectId, agentId, phone, text, displayName = null }) {
    const credentialId = await this.resolveCredentialId(projectId);
    const executionContext = createProjectRuntimeContext({
      domain: projectId,
      credentialId,
      externalUserId: phone,
    });

    await externalUserService.resolveOrCreate(projectId, phone, displayName ? { displayName } : {});

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TURN_TIMEOUT_MS);

    let reply = '';
    let runError = null;

    try {
      for await (const event of runAgentAsAguiEvents({
        agentId,
        userId: phone,
        langGraphThreadId: this.buildThreadId(projectId, agentId, phone),
        messages: [{ role: 'user', content: text }],
        signal: controller.signal,
        executionContext,
        // The Project owner deliberately exposed this Agent on their own
        // Twilio number, so default-private Agents must be runnable here —
        // the same reasoning as the voice bridge. Domain ownership is
        // still enforced above by resolveChannelAgent.
        allowPrivateExecution: true,
      })) {
        if (
          event?.type === EventType.TEXT_MESSAGE_CHUNK ||
          event?.type === EventType.TEXT_MESSAGE_CONTENT
        ) {
          if (event.delta) reply += event.delta;
        } else if (event?.type === EventType.RUN_ERROR) {
          runError = event;
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    return { reply: reply.trim(), runError };
  }

  /**
   * Resolves an Agent that may be exposed on a Project's Twilio number:
   * it must belong to this Project, not be soft-deleted or deactivated,
   * and never be one of the virtual Architect agents.
   */
  async resolveChannelAgent(projectId, agentId) {
    if (!agentId || ARCHITECT_AGENT_IDS.has(String(agentId))) return null;

    let agent = null;
    try {
      agent = await agentRepository.findById(agentId);
    } catch {
      return null;
    }

    if (!agent || agent.deletedAt || agent.isActive === false) return null;
    if (String(agent.domain) !== String(projectId)) return null;

    return agent;
  }

  /**
   * Same resolution the voice bridge uses: the project's active machine
   * credential when one exists, otherwise the literal 'twilio' marker
   * (there is no registered credential, but the context shape requires one).
   */
  async resolveCredentialId(projectId) {
    try {
      const credentials = await projectCredentialRepository.findByProject(projectId);
      const active = credentials?.find((credential) => credential.status === 'ACTIVE');
      if (active) return String(active._id);
    } catch (err) {
      logger.warn('[TwilioMessaging] Error finding project credential, defaulting to twilio', {
        projectId,
        err: err?.message,
      });
    }
    return 'twilio';
  }

  /** Sends a body back to the caller's phone; never throws. */
  async reply({ projectId, phone, channel, text }) {
    const body = String(text || '').trim();
    if (!body) return null;

    try {
      return await twilioService.sendMessage({ projectId, to: phone, channel, body });
    } catch (err) {
      logger.error('[TwilioMessaging] Failed to send reply', {
        projectId,
        channel,
        code: err?.code,
        err: err?.message,
      });
      return null;
    }
  }

  /** Test seam: clears dedupe + in-flight queues. */
  resetForTests() {
    this.seenMessageSids.clear();
    this.conversationQueues.clear();
  }
}

export default new TwilioMessagingService();
