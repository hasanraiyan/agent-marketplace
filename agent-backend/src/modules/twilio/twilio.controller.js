import twilioService from './twilio.service.js';
import twilioMessagingService from './twilioMessaging.service.js';
import { loggerService } from '../../utils/index.js';
import { successFormatter } from '../../utils/formatters/index.js';
import BaseError from '../../utils/errors/BaseError.js';
import { TWILIO_WS_PATH } from './twilioGateway.js';
import crypto from 'crypto';
import { mintVoiceTicket } from '../voice/voiceTicket.service.js';
import externalUserService from '../externalUsers/externalUser.service.js';
import threadRepository from '../threads/thread.repository.js';

const logger = loggerService.getLogger();

class TwilioController {
  /**
   * Handles incoming Twilio Voice Webhook (both for inbound calls and answered outbound calls).
   * Generates and returns TwiML with <Connect><Stream>.
   */
  async handleVoiceWebhook(req, res) {
    try {
      const projectId = req.query.projectId || req.params.projectId;
      const agentId = req.query.agentId || req.params.agentId;
      const callerPhone = req.query?.callerPhone || req.body?.From || 'unknown-caller';

      if (!projectId || !agentId) {
        logger.warn('[TwilioController] Missing projectId or agentId in webhook request', {
          query: req.query,
          params: req.params,
        });
        const errorTwiML = twilioService.buildUnavailableTwiML(
          'We are sorry, this phone number is not configured with an agent.'
        );
        res.type('text/xml');
        return res.send(errorTwiML);
      }

      const isValid = await twilioService.validateRequest(req, projectId);
      if (!isValid) {
        return res.status(403).send('Forbidden: Invalid Twilio signature');
      }

      // Determine public WSS URL for Twilio
      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps = forwardedProto
        ? forwardedProto.split(',')[0].trim() === 'https'
        : req.protocol === 'https';
      const wsProtocol = isHttps ? 'wss' : 'ws';
      const host = req.get('host');

      // Persona-hosted numbers authenticate the media stream the same way
      // every other caller does: with a single-use ticket minted here, after
      // this webhook's own Twilio signature check. Identity is still the
      // phone number on this path (there is no developer-side user to
      // assert), so the call continues the phone's existing conversation.
      const phone = twilioService.normalizePhoneNumber(callerPhone) || callerPhone;
      const callSid = req.body?.CallSid || null;
      let subjectId = phone;
      const mappedUser = await externalUserService.findByPhoneNumber(projectId, phone);
      if (mappedUser?.externalUserId) {
        subjectId = mappedUser.externalUserId;
      }

      let threadId = `agui-${projectId}-${agentId}-${phone}`;
      try {
        const subjectFilter = {
          domain: projectId,
          subjectType: 'ExternalUser',
          externalUserId: subjectId,
        };
        let thread = await threadRepository.findLatestBySubjectAndAgent(subjectFilter, agentId);
        if (!thread) {
          thread = await threadRepository.create({
            domain: projectId,
            subjectType: 'ExternalUser',
            externalUserId: subjectId,
            agentId,
            threadId: crypto.randomUUID(),
            title: 'Phone Call',
            lastMessageAt: new Date(),
          });
        } else {
          await threadRepository.touchLastMessageAt(thread._id);
        }
        if (thread?.threadId) {
          threadId = thread.threadId;
        }
      } catch (e) {
        logger.warn('[TwilioController] Failed to resolve thread for voice call', { err: e?.message });
      }

      const { ticket } = mintVoiceTicket({
        principalType: 'ProjectRuntime',
        audience: 'telephony',
        domain: projectId,
        agentId,
        subjectId,
        credentialId: 'twilio',
        threadId,
        telephony: { channel: 'voice', from: phone, callSid },
        context: { callerPhone: phone, channel: 'voice', callSid },
      });

      const wsUrl = `${wsProtocol}://${host}${TWILIO_WS_PATH}?ticket=${encodeURIComponent(ticket)}`;

      logger.info('[TwilioController] Generating TwiML for media stream', {
        projectId,
        agentId,
        callSid,
      });

      const twiml = twilioService.buildConnectStreamTwiML({ wsUrl });

      res.type('text/xml');
      return res.send(twiml);
    } catch (err) {
      logger.error('[TwilioController] Error in handleVoiceWebhook', { err: err?.message });
      const errorTwiML = twilioService.buildUnavailableTwiML();
      res.type('text/xml');
      return res.status(500).send(errorTwiML);
    }
  }

  /**
   * Receives Twilio status callbacks (initiated, ringing, answered, completed).
   */
  handleStatusCallback(req, res) {
    const { CallSid, CallStatus, CallDuration, From, To } = req.body || {};
    logger.info('[TwilioController] Call status update', {
      CallSid,
      CallStatus,
      CallDuration,
      From,
      To,
    });
    return res.status(204).end();
  }

  /**
   * Handles inbound SMS / WhatsApp messages from Twilio.
   *
   * Acknowledges with an empty 200 before running the agent: Twilio retries
   * any non-2xx webhook, and an agent turn can take far longer than the
   * webhook timeout. The reply itself is delivered out-of-band through the
   * REST API (see twilioMessaging.service.js).
   */
  async handleInboundMessage(req, res) {
    const projectId = req.query.projectId || req.params.projectId;
    const agentId = req.query.agentId || req.params.agentId;

    if (!projectId || !agentId) {
      // Misconfigured webhook URL — acknowledge so Twilio stops retrying.
      logger.warn('[TwilioController] Inbound message without projectId/agentId', {
        query: req.query,
      });
      return res.status(200).type('text/plain').send('ignored');
    }

    try {
      const isValid = await twilioService.validateRequest(req, projectId);
      if (!isValid) {
        return res.status(403).send('Forbidden: Invalid Twilio signature');
      }
    } catch (err) {
      logger.error('[TwilioController] Failed to validate inbound message signature', {
        projectId,
        err: err?.message,
      });
      return res.status(403).send('Forbidden: Invalid Twilio signature');
    }

    const { From, Body, MessageSid, SmsMessageSid, ProfileName, NumMedia } = req.body || {};
    const messageSid = MessageSid || SmsMessageSid;

    // Twilio retries reuse the same MessageSid; never run the same user
    // message through the agent twice.
    if (twilioMessagingService.registerInboundMessage(messageSid)) {
      logger.info('[TwilioController] Ignoring duplicate inbound message', {
        projectId,
        messageSid,
      });
      return res.status(200).type('text/plain').send('duplicate');
    }

    const mediaUrls = [];
    const mediaCount = Number.parseInt(NumMedia || '0', 10) || 0;
    for (let i = 0; i < mediaCount; i += 1) {
      const url = req.body?.[`MediaUrl${i}`];
      if (url) mediaUrls.push(url);
    }

    twilioMessagingService
      .handleInboundMessage({
        projectId,
        agentId,
        from: From,
        body: Body,
        messageSid,
        profileName: ProfileName,
        mediaUrls,
      })
      .catch((err) => {
        logger.error('[TwilioController] Inbound message pipeline failed', {
          projectId,
          agentId,
          messageSid,
          err: err?.message,
        });
      });

    return res.status(200).type('text/plain').send('');
  }

  /**
   * Receives Twilio message delivery status callbacks.
   */
  handleMessageStatusCallback(req, res) {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, From, To } = req.body || {};
    logger.info('[TwilioController] Message status update', {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage,
      From,
      To,
    });
    return res.status(204).end();
  }

  /**
   * Sends a plain SMS/WhatsApp message from a Project's Twilio account.
   */
  async sendMessage(req, res, next) {
    try {
      const projectId = req.params.projectId;
      const { to, channel, body, mediaUrl, contentSid, contentVariables } = req.body || {};

      const result = await twilioService.sendMessage({
        projectId,
        to,
        channel,
        body,
        mediaUrl,
        contentSid,
        contentVariables,
      });

      return res.json(successFormatter.formatSuccess(result, 'Message sent'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Machine-credential sibling of {@link sendMessage} — the Project comes
   * from the verified credential (`req.projectContext.domain`), not the URL.
   */
  async sendDeveloperMessage(req, res, next) {
    try {
      const projectId = req.projectContext.domain;
      const { to, channel, body, mediaUrl, contentSid, contentVariables } = req.body || {};

      const result = await twilioService.sendMessage({
        projectId,
        to,
        channel,
        body,
        mediaUrl,
        contentSid,
        contentVariables,
      });

      return res.json(successFormatter.formatSuccess(result, 'Message sent'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Runs an Agent on the shared conversation thread for a phone number and
   * delivers its reply over SMS/WhatsApp.
   */
  async sendAgentMessage(req, res, next) {
    try {
      const projectId = req.params.projectId;
      const { agentId, to, channel, prompt, displayName } = req.body || {};

      const result = await twilioMessagingService.sendAgentMessage({
        projectId,
        agentId,
        to,
        channel,
        prompt,
        displayName,
      });

      return res.json(successFormatter.formatSuccess(result, 'Agent message sent'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Machine-credential sibling of {@link sendAgentMessage}. The recipient
   * phone number is the conversation subject, so this works with a bare
   * Project credential — no `x-persona-external-user-id` needed.
   */
  async sendDeveloperAgentMessage(req, res, next) {
    try {
      const projectId = req.projectContext.domain;
      const { agentId, to, channel, prompt, displayName } = req.body || {};

      const result = await twilioMessagingService.sendAgentMessage({
        projectId,
        agentId,
        to,
        channel,
        prompt,
        displayName,
      });

      return res.json(successFormatter.formatSuccess(result, 'Agent message sent'));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reply-only sibling of {@link sendDeveloperAgentMessage} — runs the Agent
   * for the asserted external user and returns its text WITHOUT sending
   * anything. For a developer who keeps their own Twilio number: their
   * webhook receives the WhatsApp/SMS message, calls this, and delivers the
   * reply itself (inline TwiML for messages, spoken for calls).
   */
  async generateDeveloperAgentReply(req, res, next) {
    try {
      const context = req.projectContext;

      if (context?.principalType !== 'ProjectRuntime') {
        throw new BaseError(
          'Generating a reply requires an asserted external user (x-persona-external-user-id)',
          400,
          'EXTERNAL_USER_REQUIRED'
        );
      }

      const { agentId, text, prompt, threadId, displayName, channel } = req.body || {};

      const result = await twilioMessagingService.generateReply({
        projectId: context.domain,
        agentId,
        externalUserId: context.externalUserId,
        text: text ?? prompt,
        displayName,
        threadId: threadId || req.headers['x-thread-id'] || null,
        ...(channel || req.headers['x-channel'] ? { channel: channel || req.headers['x-channel'] } : {}),
      });

      if (result.runError) {
        throw new BaseError(
          result.runError.message || 'Agent run failed',
          502,
          result.runError.code || 'AGENT_RUN_FAILED'
        );
      }
      if (!result.reply) {
        throw new BaseError('The agent produced an empty reply', 502, 'AGENT_EMPTY_REPLY');
      }

      return res.json(
        successFormatter.formatSuccess(
          { agentId, reply: result.reply, threadId: result.threadId },
          'Agent reply generated'
        )
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Triggers an outbound call to the user's phone number.
   */
  async triggerOutboundCall(req, res, next) {
    try {
      const { to, projectId: bodyProjectId, agentId } = req.body || {};
      const projectId = req.projectContext?.domain || bodyProjectId;

      if (!to) {
        throw new BaseError(
          'Phone number "to" is required (E.164 format, e.g. +91...)',
          400,
          'PHONE_NUMBER_REQUIRED'
        );
      }
      if (!projectId) {
        throw new BaseError('Project ID is required', 400, 'PROJECT_ID_REQUIRED');
      }
      if (!agentId) {
        throw new BaseError('Agent ID is required', 400, 'AGENT_ID_REQUIRED');
      }

      const result = await twilioService.createOutboundCall({
        to,
        projectId,
        agentId,
      });

      return res.json(successFormatter.formatSuccess(result, 'Outbound call initiated'));
    } catch (err) {
      next(err);
    }
  }
}

export default new TwilioController();
