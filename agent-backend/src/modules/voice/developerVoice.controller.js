import BaseError from '../../utils/errors/BaseError.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import { successFormatter } from '../../utils/formatters/index.js';
import { loggerService } from '../../utils/index.js';
import agentRepository from '../agents/agent.repository.js';
import agentService from '../agents/agent.service.js';
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import { mintVoiceTicket } from './voiceTicket.service.js';
import { resolveVoiceProvider, buildVoiceLiveConfig } from './voice.service.js';
import {
  INPUT_SAMPLE_RATE,
  OUTPUT_SAMPLE_RATE,
  DEFAULT_MAX_DURATION_MS,
} from './voice.constants.js';

const logger = loggerService.getLogger();

/**
 * Developer Platform machine voice route (voice-agent-plan.md §7 route (a),
 * §18 Phase 2) — mints a voice session ticket for an external app running
 * a Project Agent, authenticated by Project credential
 * (developerMachineAuthMiddleware), not Clerk. The Developer Studio test
 * route (projectAgentVoiceTest.controller.js) is the other minting path;
 * both produce the same ticket shape and redeem against the same
 * WS gateway (voiceGateway.js) — see voice-agent-plan.md §7.
 *
 * Agent lookup/authorization deliberately mirrors developerAgui.controller.js's
 * `runAgent` (the text execution route) — `agentRepository.findById` +
 * `canUserExecuteAgent` + an explicit ARCHITECT_AGENT_ID block — rather than
 * `getDeveloperAgentById` (the Studio-admin browsing path
 * projectAgentVoiceTest.controller.js uses), since this is the same kind of
 * execution-time call, not an admin browsing one, and Persona's own
 * Architect meta-agent must never be reachable through a Project's machine
 * credential.
 */
class DeveloperVoiceController {
  async createSession(req, res, next) {
    const context = req.projectContext;

    if (context?.principalType !== 'ProjectRuntime') {
      return next(
        new BaseError(
          'Starting a voice session requires an asserted external user (x-persona-external-user-id)',
          400,
          'EXTERNAL_USER_REQUIRED'
        )
      );
    }

    const { domain, externalUserId } = context;
    const agentId = req.headers['x-agent-id'] || req.query.agentId;

    try {
      if (!agentId) {
        throw new NotFoundError('Agent ID is required');
      }
      if (String(agentId) === ARCHITECT_AGENT_ID) {
        // Existence-hiding (AD-07 §29): same not-found shape as any other
        // rejected agentId — never reveals that this id is special.
        throw new NotFoundError('Agent not found');
      }

      let agent;
      try {
        agent = await agentRepository.findById(agentId);
      } catch {
        agent = null;
      }

      if (!agent || !agentService.canUserExecuteAgent(agent, context)) {
        throw new NotFoundError('Agent not found');
      }

      let provider;
      try {
        provider = await resolveVoiceProvider(agent, domain);
      } catch (err) {
        if (err.code === 'VOICE_PROVIDER_REQUIRED') {
          throw new BaseError(err.message, 422, 'VOICE_PROVIDER_REQUIRED');
        }
        throw err;
      }

      let model;
      let voiceName;
      try {
        ({ model, voiceName } = await buildVoiceLiveConfig(agent, domain, context));
      } catch (err) {
        if (err.code === 'VOICE_INTERRUPT_ON_UNSUPPORTED') {
          throw new BaseError(err.message, 422, err.code);
        }
        throw err;
      }

      // No x-thread-id support yet — voice has no thread/checkpoint
      // persistence until voice-agent-plan.md Phase 4. Once that lands,
      // this should adopt the exact same 404-on-mismatch contract
      // developerAgui.controller.js's x-thread-id handling already has.
      const { ticket, expiresAt } = mintVoiceTicket({
        principalType: 'ProjectRuntime',
        domain,
        agentId: String(agent._id),
        subjectId: externalUserId,
        credentialId: context.credentialId,
        threadId: null,
      });

      // req.protocol only reports 'https' when Express's `trust proxy` is
      // configured — reading X-Forwarded-Proto directly avoids depending on
      // that (see projectAgentVoiceTest.controller.js's identical fix).
      const forwardedProto = req.headers['x-forwarded-proto'];
      const isHttps = forwardedProto
        ? forwardedProto.split(',')[0].trim() === 'https'
        : req.protocol === 'https';
      const protocol = isHttps ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${req.get('host')}/api/v1/developer/voice?ticket=${encodeURIComponent(ticket)}`;

      logger.info('[Voice] machine session ticket minted', {
        domain,
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

export default new DeveloperVoiceController();
