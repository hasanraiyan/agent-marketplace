import crypto from 'crypto';
import mongoose from 'mongoose';
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
import threadRepository from '../threads/thread.repository.js';
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
const SESSION_INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

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

      // 1. Resolve whether this phone number belongs to a known external user
      let subject = phone;
      if (typeof externalUserService?.findByPhoneNumber === 'function') {
        try {
          const mappedUser = await externalUserService.findByPhoneNumber(projectId, phone);
          if (mappedUser?.externalUserId) {
            subject = mappedUser.externalUserId;
          }
        } catch {
          // Ignore lookup error
        }
      }

      // 2. Handle session rolling window and /new commands (like ChatGPT/Perplexity on WhatsApp)
      const isNewChatCmd = /^\s*(\/new|\/reset|new chat)\b/i.test(text);
      const promptText = text.replace(/^\s*(\/new|\/reset|new chat)\s*/i, '').trim();

      // If user just sent "/new" with no other prompt:
      if (isNewChatCmd && !promptText) {
        if (typeof threadRepository?.create === 'function') {
          const channelLabel =
            channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'Phone';
          await threadRepository.create({
            domain: projectId,
            subjectType: 'ExternalUser',
            externalUserId: subject,
            agentId,
            threadId: crypto.randomUUID(),
            title: `${channelLabel} Chat`,
            lastMessageAt: new Date(),
          });
        }
        await this.reply({
          projectId,
          phone,
          channel,
          text: 'Started a new conversation! How can I help you today?',
        });
        return { handled: true, replied: true };
      }

      // 3. Find or create an active Thread document so turns are visible in the web chat UI
      let thread = null;
      if (
        mongoose.connection.readyState === 1 &&
        typeof threadRepository?.findLatestBySubjectAndAgent === 'function'
      ) {
        try {
          const subjectFilter = {
            domain: projectId,
            subjectType: 'ExternalUser',
            externalUserId: subject,
          };
          const latest = await threadRepository.findLatestBySubjectAndAgent(subjectFilter, agentId);
          const isSessionRecent =
            !isNewChatCmd &&
            latest?.lastMessageAt &&
            Date.now() - new Date(latest.lastMessageAt).getTime() < SESSION_INACTIVITY_TIMEOUT_MS;

          if (latest && isSessionRecent) {
            thread = latest;
            await threadRepository.touchLastMessageAt(thread._id);
          } else if (typeof threadRepository?.create === 'function') {
            const channelLabel =
              channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'Phone';
            thread = await threadRepository.create({
              domain: projectId,
              subjectType: 'ExternalUser',
              externalUserId: subject,
              agentId,
              threadId: crypto.randomUUID(),
              title: `${channelLabel} Chat`,
              lastMessageAt: new Date(),
            });
          }
        } catch (err) {
          logger.warn(
            '[TwilioMessaging] Failed to resolve or touch thread, falling back to deterministic thread id',
            { err: err?.message }
          );
        }
      }

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
        const { reply, runError } = await this.generateReply({
          projectId,
          agentId,
          externalUserId: subject,
          text,
          displayName: profileName,
          threadId: thread?.threadId || null,
          channel,
        });

        if (thread?._id) {
          await threadRepository.touchLastMessageAt(thread._id).catch(() => {});
        }

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
   * collects the assistant's text, without sending anything. Identity is
   * the phone number — the Persona-hosted convention shared by SMS,
   * WhatsApp and voice.
   */
  async generateAgentReply({ projectId, agentId, phone, text, displayName = null }) {
    const { reply, runError } = await this.generateReply({
      projectId,
      agentId,
      externalUserId: phone,
      text,
      displayName,
    });
    return { reply, runError };
  }

  /**
   * Runs one agent turn for a caller-resolved external user and returns the
   * reply **without delivering it** — the bring-your-own-Twilio flow, where
   * the developer's own webhook returns the text as TwiML `<Message>` (or
   * reads it aloud) instead of Persona sending through its own account.
   *
   * `externalUserId` is asserted by the Project credential (never the phone
   * number), so a WhatsApp message here continues the same thread as that
   * user's web chat and phone calls. Tool activity, reasoning, and state
   * snapshots are ignored — only final text is channel-deliverable.
   */
  async generateReply({
    projectId,
    agentId,
    externalUserId,
    text,
    displayName = null,
    threadId = null,
    channel = null,
  }) {
    const subject = String(externalUserId || '').trim();
    if (!subject) {
      const err = new Error('An external user id is required');
      err.statusCode = 400;
      err.code = 'EXTERNAL_USER_REQUIRED';
      throw err;
    }
    if (!agentId) {
      const err = new Error('Agent ID is required');
      err.statusCode = 400;
      err.code = 'AGENT_ID_REQUIRED';
      throw err;
    }

    const body = String(text ?? '')
      .trim()
      .slice(0, MAX_INBOUND_BODY_LENGTH);
    if (!body) {
      const err = new Error('A message text is required');
      err.statusCode = 400;
      err.code = 'MESSAGE_TEXT_REQUIRED';
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

    const credentialId = await this.resolveCredentialId(projectId);
    const executionContext = createProjectRuntimeContext({
      domain: projectId,
      credentialId,
      externalUserId: subject,
    });

    await externalUserService.resolveOrCreate(
      projectId,
      subject,
      displayName ? { displayName } : {}
    );

    const langGraphThreadId = threadId || this.buildThreadId(projectId, agentId, subject);

    // Ensure a Thread document exists in conversations collection so it appears in the web chat UI
    if (
      mongoose.connection.readyState === 1 &&
      typeof threadRepository?.findById === 'function' &&
      typeof threadRepository?.create === 'function'
    ) {
      try {
        let existingThread = await threadRepository.findById(langGraphThreadId);
        if (!existingThread) {
          const channelLabel =
            channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : 'Chat';
          await threadRepository.create({
            domain: projectId,
            subjectType: 'ExternalUser',
            externalUserId: subject,
            agentId,
            threadId: langGraphThreadId,
            title: `${channelLabel} Chat`,
            lastMessageAt: new Date(),
          });
        } else if (existingThread?._id && typeof threadRepository?.touchLastMessageAt === 'function') {
          await threadRepository.touchLastMessageAt(existingThread._id).catch(() => {});
        }
      } catch (err) {
        logger.warn('[TwilioMessaging] Failed to create or touch Thread document in generateReply', {
          err: err?.message,
        });
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TURN_TIMEOUT_MS);

    let reply = '';
    let runError = null;

    try {
      for await (const event of runAgentAsAguiEvents({
        agentId,
        userId: subject,
        langGraphThreadId,
        messages: [{ role: 'user', content: body, ...(channel ? { channel } : {}) }],
        signal: controller.signal,
        executionContext,
        turnContext: channel ? { channel } : undefined,
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

    return { reply: reply.trim(), threadId: langGraphThreadId, runError };
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
