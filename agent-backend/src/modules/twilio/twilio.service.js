import twilio from 'twilio';
import config from '../../config/index.js';
import projectSecretService from '../projects/projectSecret.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

const WHATSAPP_PREFIX = 'whatsapp:';

// Twilio stops auto-concatenating SMS at 1600 chars (billed per 160-char
// segment); WhatsApp rejects bodies over 4096. Chunk under both limits.
const SMS_CHUNK_LIMIT = 1500;
const WHATSAPP_CHUNK_LIMIT = 4000;

class TwilioService {
  /**
   * Resolves the Twilio credentials from the Project's secrets
   * (never from .env, supporting multi-tenant project separation).
   *
   * Secrets looked up by label for the given projectId:
   * - TWILIO_ACCOUNT_SID
   * - TWILIO_AUTH_TOKEN
   * - TWILIO_PHONE_NUMBER (voice caller id, also default SMS sender)
   * - TWILIO_PUBLIC_URL (optional: falls back to request host / BACKEND_URL)
   * - TWILIO_SMS_NUMBER (optional: overrides TWILIO_PHONE_NUMBER for SMS)
   * - TWILIO_WHATSAPP_NUMBER (WhatsApp sender, e.g. +14155238886)
   * - TWILIO_MESSAGING_SERVICE_SID (optional: used for SMS when set)
   *
   * @param {string} projectId
   * @returns {Promise<object|null>}
   */
  async resolveProjectTwilioConfig(projectId) {
    if (!projectId) return null;

    const [
      accountSid,
      authToken,
      phoneNumber,
      publicUrl,
      smsNumber,
      whatsappNumber,
      messagingServiceSid,
    ] = await Promise.all([
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_ACCOUNT_SID'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_AUTH_TOKEN'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_PHONE_NUMBER'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_PUBLIC_URL'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_SMS_NUMBER'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_WHATSAPP_NUMBER'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_MESSAGING_SERVICE_SID'),
    ]);

    return {
      accountSid: accountSid || null,
      authToken: authToken || null,
      phoneNumber: phoneNumber || null,
      publicUrl: publicUrl || null,
      smsNumber: smsNumber || null,
      whatsappNumber: whatsappNumber || null,
      messagingServiceSid: messagingServiceSid || null,
    };
  }

  /**
   * Instantiates a Twilio REST client using the specified Project's own secrets.
   *
   * @param {string} projectId
   * @returns {Promise<{client: import('twilio').Twilio, phoneNumber: string|null, publicUrl: string|null}>}
   */
  async getClientForProject(projectId) {
    const projectConfig = await this.resolveProjectTwilioConfig(projectId);
    if (!projectConfig?.accountSid || !projectConfig?.authToken) {
      const err = new Error(
        `This Project has no Twilio credentials configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN under Project Secrets.`
      );
      err.statusCode = 422;
      err.code = 'TWILIO_PROJECT_SECRETS_REQUIRED';
      throw err;
    }

    return {
      client: twilio(projectConfig.accountSid, projectConfig.authToken),
      phoneNumber: projectConfig.phoneNumber,
      publicUrl: projectConfig.publicUrl,
      smsNumber: projectConfig.smsNumber,
      whatsappNumber: projectConfig.whatsappNumber,
      messagingServiceSid: projectConfig.messagingServiceSid,
    };
  }

  /**
   * Verifies the authenticity of an incoming Twilio HTTP request using
   * the specified Project's TWILIO_AUTH_TOKEN secret.
   *
   * @param {import('express').Request} req
   * @param {string} projectId
   * @returns {Promise<boolean>}
   */
  async validateRequest(req, projectId) {
    let authToken = null;
    if (projectId) {
      const projectConfig = await this.resolveProjectTwilioConfig(projectId);
      authToken = projectConfig?.authToken;
    }

    if (!authToken) {
      // In local dev/test without auth token configured, skip validation with a warning
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(
          '[TwilioService] TWILIO_AUTH_TOKEN not configured for project; skipping signature validation in non-prod',
          { projectId }
        );
        return true;
      }
      return false;
    }

    const signature = req.headers['x-twilio-signature'];
    if (!signature) {
      logger.warn('[TwilioService] Missing X-Twilio-Signature header');
      return false;
    }

    // Determine the full URL Twilio requested
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    const params = req.body || {};
    const isValid = twilio.validateRequest(authToken, signature, fullUrl, params);

    if (!isValid) {
      logger.warn('[TwilioService] Invalid Twilio request signature', { fullUrl, projectId });
    }
    return isValid;
  }

  /**
   * Builds TwiML that connects the call to our Media Stream WebSocket.
   *
   * @param {object} params
   * @param {string} params.wsUrl - WebSocket URL (e.g. wss://host/api/v1/twilio/media-stream)
   * @param {string} params.agentId - Persona Agent ID
   * @param {string} params.projectId - Persona Project ID
   * @param {string} [params.callerPhone] - Caller phone number
   * @returns {string} - XML string
   */
  buildConnectStreamTwiML({ wsUrl, agentId, projectId, callerPhone }) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const connect = response.connect();
    const stream = connect.stream({ url: wsUrl });

    stream.parameter({ name: 'agentId', value: agentId });
    stream.parameter({ name: 'projectId', value: projectId });
    if (callerPhone) {
      stream.parameter({ name: 'callerPhone', value: callerPhone });
    }

    return response.toString();
  }

  /**
   * Builds a polite error / unavailable TwiML response.
   *
   * @param {string} message
   * @returns {string} - XML string
   */
  buildUnavailableTwiML(
    message = 'We are sorry, the AI agent is currently unavailable. Please try again later.'
  ) {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say(message);
    response.hangup();
    return response.toString();
  }

  /**
   * Initiates an outbound phone call via Twilio REST API using the Project's own secrets.
   *
   * @param {object} params
   * @param {string} params.to - Recipient phone number (E.164 format, e.g. +91...)
   * @param {string} params.projectId - Project ID (resolves secrets from this project)
   * @param {string} params.agentId - Agent ID
   * @param {string} [params.from] - Optional override caller phone number
   * @param {string} [params.publicUrl] - Optional override public URL base
   * @returns {Promise<object>} - Twilio Call resource
   */
  async createOutboundCall({ to, projectId, agentId, from = null, publicUrl = null }) {
    const {
      client,
      phoneNumber: defaultCallerId,
      publicUrl: projectPublicUrl,
    } = await this.getClientForProject(projectId);

    const callerId = from || defaultCallerId;
    if (!callerId) {
      const err = new Error(
        'This Project has no Twilio phone number configured. Add TWILIO_PHONE_NUMBER under Project Secrets.'
      );
      err.statusCode = 422;
      err.code = 'TWILIO_PHONE_NUMBER_REQUIRED';
      throw err;
    }

    const baseUrl = (publicUrl || projectPublicUrl || config.backendUrl || '').replace(/\/$/, '');
    const webhookUrl = `${baseUrl}/api/v1/webhooks/twilio/voice?projectId=${encodeURIComponent(
      projectId
    )}&agentId=${encodeURIComponent(agentId)}&callerPhone=${encodeURIComponent(to)}`;

    const statusCallbackUrl = this.isPublicBaseUrl(baseUrl)
      ? `${baseUrl}/api/v1/webhooks/twilio/status?projectId=${encodeURIComponent(projectId)}`
      : null;

    logger.info('[TwilioService] Creating outbound call from project secrets', {
      to,
      from: callerId,
      agentId,
      projectId,
      webhookUrl,
    });

    const callPayload = {
      to,
      from: callerId,
      url: webhookUrl,
    };
    if (statusCallbackUrl) {
      callPayload.statusCallback = statusCallbackUrl;
      callPayload.statusCallbackEvent = ['initiated', 'ringing', 'answered', 'completed'];
      callPayload.statusCallbackMethod = 'POST';
    }
    const call = await client.calls.create(callPayload);

    logger.info('[TwilioService] Outbound call created', {
      callSid: call.sid,
      status: call.status,
      to: call.to,
      projectId,
    });

    return {
      callSid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from,
      direction: call.direction,
      projectId,
    };
  }

  /**
   * Detects the messaging channel from a Twilio address.
   * WhatsApp addresses arrive as `whatsapp:+1415...`; SMS as `+1415...`.
   *
   * @param {string} address
   * @returns {'whatsapp'|'sms'}
   */
  detectChannel(address) {
    return String(address || '')
      .trim()
      .toLowerCase()
      .startsWith(WHATSAPP_PREFIX)
      ? 'whatsapp'
      : 'sms';
  }

  /** Strips Twilio channel prefixes so the same person maps to one identity. */
  normalizePhoneNumber(address) {
    if (!address) return '';
    return String(address)
      .trim()
      .replace(/^whatsapp:/i, '')
      .replace(/^sms:/i, '')
      .trim();
  }

  /** Adds the channel prefix Twilio expects on outbound addresses. */
  formatAddress(address, channel) {
    const normalized = this.normalizePhoneNumber(address);
    if (!normalized) return '';
    return channel === 'whatsapp' ? `${WHATSAPP_PREFIX}${normalized}` : normalized;
  }

  /**
   * Resolves the `from` sender for a channel from the Project's secrets.
   * Returns null for SMS when a Messaging Service SID is configured instead
   * (Twilio rejects a request carrying both `from` and `messagingServiceSid`).
   */
  resolveSender(projectConfig, channel) {
    if (channel === 'whatsapp') {
      if (!projectConfig.whatsappNumber) {
        const err = new Error(
          'This Project has no WhatsApp sender configured. Add TWILIO_WHATSAPP_NUMBER under Project Secrets.'
        );
        err.statusCode = 422;
        err.code = 'TWILIO_WHATSAPP_NUMBER_REQUIRED';
        throw err;
      }
      return this.formatAddress(projectConfig.whatsappNumber, 'whatsapp');
    }

    const sender = projectConfig.smsNumber || projectConfig.phoneNumber;
    if (!sender && !projectConfig.messagingServiceSid) {
      const err = new Error(
        'This Project has no SMS sender configured. Add TWILIO_SMS_NUMBER (or TWILIO_PHONE_NUMBER) under Project Secrets.'
      );
      err.statusCode = 422;
      err.code = 'TWILIO_SMS_NUMBER_REQUIRED';
      throw err;
    }
    return sender ? this.formatAddress(sender, 'sms') : null;
  }

  isPublicBaseUrl(baseUrl) {
    if (!baseUrl) return false;
    let parsed;
    try {
      parsed = new URL(baseUrl);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = (parsed.hostname || '').toLowerCase();
    if (!host) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
      return false;
    }
    return true;
  }

  buildMessageStatusCallbackUrl(projectId, publicUrl) {
    const baseUrl = (publicUrl || config.backendUrl || '').replace(/\/$/, '');
    if (!baseUrl || !projectId) return null;
    if (!this.isPublicBaseUrl(baseUrl)) return null;
    return `${baseUrl}/api/v1/webhooks/twilio/message-status?projectId=${encodeURIComponent(
      projectId
    )}`;
  }

  /** Removes Markdown syntax the model may emit; SMS/WhatsApp render plain text. */
  stripMarkdown(text) {
    return String(text || '')
      .replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, '$1')
      .replace(/`([^`\n]+)`/g, '$1')
      .replace(/!\[[^\]]*]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/(^|[^\w])_([^_\n]+)_([^\w]|$)/g, '$1$2$3')
      .replace(/~~([^~\n]+)~~/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Splits a body into channel-safe chunks, preferring paragraph boundaries. */
  chunkMessage(text, channel) {
    const limit = channel === 'whatsapp' ? WHATSAPP_CHUNK_LIMIT : SMS_CHUNK_LIMIT;
    const normalized = String(text || '').trim();
    if (!normalized) return [];
    if (normalized.length <= limit) return [normalized];

    const chunks = [];
    let rest = normalized;
    while (rest.length > limit) {
      let cut = rest.lastIndexOf('\n\n', limit);
      if (cut < limit * 0.5) cut = rest.lastIndexOf('\n', limit);
      if (cut < limit * 0.5) cut = rest.lastIndexOf('. ', limit);

      if (cut < limit * 0.5) {
        chunks.push(rest.slice(0, limit).trim());
        rest = rest.slice(limit).trim();
      } else {
        chunks.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
    }
    if (rest) chunks.push(rest);
    return chunks.filter(Boolean);
  }

  /**
   * Sends an SMS or WhatsApp message through the Project's Twilio account.
   * Long bodies are split into multiple messages; Markdown is stripped for
   * plain-text channels. A `contentSid` (approved WhatsApp template) takes
   * precedence over `body` for business-initiated conversations.
   *
   * @param {object} params
   * @param {string} params.projectId
   * @param {string} params.to - E.164 number, with or without `whatsapp:`
   * @param {'sms'|'whatsapp'} [params.channel] - inferred from `to` when omitted
   * @param {string} [params.body]
   * @param {string|string[]} [params.mediaUrl]
   * @param {string} [params.contentSid] - WhatsApp template SID
   * @param {object|string} [params.contentVariables]
   * @returns {Promise<object>}
   */
  async sendMessage({
    projectId,
    to,
    channel = null,
    body = '',
    mediaUrl = null,
    contentSid = null,
    contentVariables = null,
  }) {
    const normalizedTo = this.normalizePhoneNumber(to);
    if (!normalizedTo) {
      const err = new Error('Recipient "to" is required (E.164 format, e.g. +91...)');
      err.statusCode = 400;
      err.code = 'PHONE_NUMBER_REQUIRED';
      throw err;
    }

    const resolvedChannel =
      channel === 'whatsapp' || channel === 'sms' ? channel : this.detectChannel(to);
    const projectConfig = await this.getClientForProject(projectId);
    const { client, publicUrl } = projectConfig;
    const from = this.resolveSender(projectConfig, resolvedChannel);

    // Guard against replying to the Project's own sender number, which an
    // agent loop (or a misconfigured recipient) could otherwise turn into
    // an unbounded message ping-pong.
    if (from && this.normalizePhoneNumber(from) === normalizedTo) {
      const err = new Error('Refusing to send a message to the sender number itself');
      err.statusCode = 400;
      err.code = 'MESSAGE_LOOP_DETECTED';
      throw err;
    }

    const statusCallback = this.buildMessageStatusCallbackUrl(projectId, publicUrl);
    const payloadBase = { to: this.formatAddress(normalizedTo, resolvedChannel) };
    if (statusCallback) payloadBase.statusCallback = statusCallback;
    if (resolvedChannel === 'sms' && projectConfig.messagingServiceSid) {
      payloadBase.messagingServiceSid = projectConfig.messagingServiceSid;
    } else {
      payloadBase.from = from;
    }

    const mediaUrls = Array.isArray(mediaUrl)
      ? mediaUrl.filter(Boolean)
      : mediaUrl
        ? [mediaUrl]
        : [];
    const messages = [];

    logger.info('[TwilioService] Sending message from project secrets', {
      projectId,
      channel: resolvedChannel,
      to: normalizedTo,
      from: payloadBase.from,
      hasTemplate: Boolean(contentSid),
    });

    if (contentSid) {
      messages.push(
        await client.messages.create({
          ...payloadBase,
          contentSid,
          ...(contentVariables
            ? {
                contentVariables:
                  typeof contentVariables === 'string'
                    ? contentVariables
                    : JSON.stringify(contentVariables),
              }
            : {}),
        })
      );
    } else {
      const chunks = this.chunkMessage(this.stripMarkdown(body), resolvedChannel);
      if (chunks.length === 0) {
        const err = new Error('Message "body" is required unless contentSid is provided');
        err.statusCode = 400;
        err.code = 'MESSAGE_BODY_REQUIRED';
        throw err;
      }

      for (let i = 0; i < chunks.length; i += 1) {
        messages.push(
          await client.messages.create({
            ...payloadBase,
            body: chunks[i],
            ...(i === 0 && mediaUrls.length > 0 ? { mediaUrl: mediaUrls } : {}),
          })
        );
      }
    }

    return {
      channel: resolvedChannel,
      to: normalizedTo,
      from: payloadBase.from || null,
      messageSids: messages.map((m) => m.sid),
      status: messages[0]?.status || null,
      parts: messages.length,
    };
  }

  /**
   * Terminates a running Twilio call by CallSid using the Project's secrets.
   *
   * @param {string} projectId
   * @param {string} callSid
   */
  async hangupCall(projectId, callSid) {
    if (!projectId || !callSid) return null;

    try {
      const { client } = await this.getClientForProject(projectId);
      return await client.calls(callSid).update({ status: 'completed' });
    } catch (err) {
      logger.warn('[TwilioService] Failed to hangup call', {
        projectId,
        callSid,
        err: err?.message,
      });
      return null;
    }
  }
}

export default new TwilioService();
