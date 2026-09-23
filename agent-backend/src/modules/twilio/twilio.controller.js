import twilioService from './twilio.service.js';
import { loggerService } from '../../utils/index.js';
import { successFormatter } from '../../utils/formatters/index.js';
import BaseError from '../../utils/errors/BaseError.js';
import { TWILIO_WS_PATH } from './twilioGateway.js';

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
      const callerPhone = req.body?.From || req.query?.callerPhone;

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
      const wsUrl = `${wsProtocol}://${host}${TWILIO_WS_PATH}`;

      logger.info('[TwilioController] Generating TwiML for media stream', {
        projectId,
        agentId,
        callerPhone,
        wsUrl,
      });

      const twiml = twilioService.buildConnectStreamTwiML({
        wsUrl,
        agentId,
        projectId,
        callerPhone,
      });

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
   * Triggers an outbound call to the user's phone number.
   */
  async triggerOutboundCall(req, res, next) {
    try {
      const { to, projectId, agentId } = req.body || {};

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
