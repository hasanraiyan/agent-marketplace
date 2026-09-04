import agentService from '../agents/agent.service.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import BaseError from '../../utils/errors/BaseError.js';
import { loggerService } from '../../utils/index.js';
import { successFormatter } from '../../utils/formatters/index.js';
import { mintVoiceTicket } from './voiceTicket.service.js';
import { resolveVoiceProvider, buildVoiceLiveConfig } from './voice.service.js';
import {
  INPUT_SAMPLE_RATE,
  OUTPUT_SAMPLE_RATE,
  DEFAULT_MAX_DURATION_MS,
} from './voice.constants.js';

const logger = loggerService.getLogger();

/**
 * Developer Studio "Test" playground's voice counterpart (voice-agent-plan.md
 * §7 route (b), §13.1) — mints a single-use voice ticket for a Project Admin
 * to try their OWN Agent's voice mode in the browser. Same Clerk +
 * projectAdminAuthMiddleware chain projectAgentTest.controller.js already
 * uses for the text playground; deliberately never accepts or forwards a
 * Project credential — the browser only ever sees the ticket.
 */
class ProjectAgentVoiceTestController {
  async createSession(req, res, next) {
    const context = req.projectAdminContext;
    const { agentId } = req.params;

    try {
      let agent;
      try {
        agent = await agentService.getDeveloperAgentById(agentId, context);
      } catch {
        throw new NotFoundError('Agent not found');
      }

      let provider;
      try {
        provider = await resolveVoiceProvider(agent, context.domain);
      } catch (err) {
        if (err.code === 'VOICE_PROVIDER_REQUIRED') {
          throw new BaseError(err.message, 422, 'VOICE_PROVIDER_REQUIRED');
        }
        throw err;
      }

      let model;
      let voiceName;
      try {
        ({ model, voiceName } = await buildVoiceLiveConfig(agent, context.domain, context));
      } catch (err) {
        if (err.code === 'VOICE_INTERRUPT_ON_UNSUPPORTED') {
          throw new BaseError(err.message, 422, err.code);
        }
        throw err;
      }

      const { ticket, expiresAt } = mintVoiceTicket({
        principalType: 'ProjectAdmin',
        domain: context.domain,
        agentId: String(agent._id),
        subjectId: String(context.personaUserId),
        membershipRole: context.membershipRole,
        threadId: null,
      });

      // req.protocol only reports 'https' when Express's `trust proxy` is
      // configured (it isn't, app-wide) — reading X-Forwarded-Proto
      // directly here avoids depending on that global setting (which also
      // controls req.ip, used elsewhere for anonymous rate-limit keys).
      // Behind any TLS-terminating reverse proxy/CDN, req.protocol alone
      // would always resolve to 'http' and hand the browser a ws:// URL,
      // which every browser refuses to open from an https: page.
      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps = forwardedProto
        ? forwardedProto.split(',')[0].trim() === 'https'
        : req.protocol === 'https';
      const protocol = isHttps ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${req.get('host')}/api/v1/developer/voice?ticket=${encodeURIComponent(ticket)}`;

      logger.info('[Voice] test session ticket minted', {
        domain: context.domain,
        agentId: String(agent._id),
        providerId: provider.id,
      });

      res.json(
        successFormatter.formatSuccess(
          {
            ticket,
            wsUrl,
            expiresAt,
            session: {
              model,
              voice: voiceName,
              inputSampleRate: INPUT_SAMPLE_RATE,
              outputSampleRate: OUTPUT_SAMPLE_RATE,
              maxDurationMs: DEFAULT_MAX_DURATION_MS,
            },
          },
          'Voice session ticket issued'
        )
      );
    } catch (err) {
      next(err);
    }
  }
}

export default new ProjectAgentVoiceTestController();
