import twilio from 'twilio';
import config from '../../config/index.js';
import projectSecretService from '../projects/projectSecret.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

class TwilioService {
  /**
   * Resolves the 4 Twilio credentials from the Project's secrets
   * (never from .env, supporting multi-tenant project separation).
   *
   * Secrets looked up by label for the given projectId:
   * - TWILIO_ACCOUNT_SID
   * - TWILIO_AUTH_TOKEN
   * - TWILIO_PHONE_NUMBER
   * - TWILIO_PUBLIC_URL (optional: falls back to request host / BACKEND_URL)
   *
   * @param {string} projectId
   * @returns {Promise<{accountSid: string|null, authToken: string|null, phoneNumber: string|null, publicUrl: string|null}>}
   */
  async resolveProjectTwilioConfig(projectId) {
    if (!projectId) return null;

    const [accountSid, authToken, phoneNumber, publicUrl] = await Promise.all([
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_ACCOUNT_SID'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_AUTH_TOKEN'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_PHONE_NUMBER'),
      projectSecretService.resolveSecretByLabel(projectId, 'TWILIO_PUBLIC_URL'),
    ]);

    return {
      accountSid: accountSid || null,
      authToken: authToken || null,
      phoneNumber: phoneNumber || null,
      publicUrl: publicUrl || null,
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

    const statusCallbackUrl = `${baseUrl}/api/v1/webhooks/twilio/status?projectId=${encodeURIComponent(
      projectId
    )}`;

    logger.info('[TwilioService] Creating outbound call from project secrets', {
      to,
      from: callerId,
      agentId,
      projectId,
      webhookUrl,
    });

    const call = await client.calls.create({
      to,
      from: callerId,
      url: webhookUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

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
