import mongoose from 'mongoose';
import agentService from '../agents/agent.service.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import BaseError from '../../utils/errors/BaseError.js';
import { loggerService } from '../../utils/index.js';
import { successFormatter } from '../../utils/formatters/index.js';
import { mintVoiceTicket } from './voiceTicket.service.js';
import { resolveVoiceProvider, buildVoiceLiveConfig } from './voice.service.js';
import { validateTurnContext } from '../agui/turnContext.js';
import Conversation from '../threads/thread.model.js';
import threadRepository from '../threads/thread.repository.js';
import {
  INPUT_SAMPLE_RATE,
  OUTPUT_SAMPLE_RATE,
  DEFAULT_MAX_DURATION_MS,
} from './voice.constants.js';

const logger = loggerService.getLogger();

// Mirrors developerVoice.controller.js's identical constant exactly.
const CONTEXT_OVERRIDE_MAX_LENGTH = 4000;

/**
 * Developer Studio "Test" playground's voice counterpart (voice-agent-plan.md
 * §7 route (b), §13.1) — mints a single-use voice ticket for a Project Admin
 * to try their OWN Agent's voice mode in the browser. Same Clerk +
 * projectAdminAuthMiddleware chain projectAgentTest.controller.js already
 * uses for the text playground; deliberately never accepts or forwards a
 * Project credential — the browser only ever sees the ticket.
 *
 * Thread resolution mirrors developerVoice.controller.js's (validate at
 * mint time, on an authenticated server-to-server call, then freeze the
 * resolved id into the signed ticket — a WS handshake can't carry auth
 * headers) — but queries `Conversation` directly by `{domain, agentId,
 * userId: personaUserId}`, the same shape project.controller.js's own
 * Playground thread handlers use, since ProjectAdminContext has no Subject
 * identity for `thread.service.js`'s Subject-scoped lookup (that's built
 * for ProjectRuntimeContext external users, which an Admin browsing their
 * own Project's Agents is not).
 */
class ProjectAgentVoiceTestController {
  async createSession(req, res, next) {
    const context = req.projectAdminContext;
    const { agentId } = req.params;

    try {
      const { contextOverride, context: turnContext } = req.body || {};
      if (contextOverride !== undefined) {
        if (typeof contextOverride !== 'string') {
          throw new BaseError('contextOverride must be a string', 400, 'INVALID_CONTEXT_OVERRIDE');
        }
        if (contextOverride.length > CONTEXT_OVERRIDE_MAX_LENGTH) {
          throw new BaseError(
            `contextOverride must be ${CONTEXT_OVERRIDE_MAX_LENGTH} characters or fewer`,
            400,
            'CONTEXT_OVERRIDE_TOO_LARGE'
          );
        }
      }
      const validatedTurnContext = validateTurnContext(turnContext);

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

      // Was previously always `threadId: null` (a fresh scratch conversation
      // every time) — same gap developerVoice.controller.js's `x-thread-id`
      // resolution already closed for the SDK route. An explicit thread id
      // that doesn't resolve to one of this Admin's own Threads for this
      // Agent is rejected rather than silently starting a different one.
      const threadDbId = req.headers['x-thread-id'] || req.query.threadId;
      let langGraphThreadId = null;
      if (threadDbId) {
        const query = mongoose.isValidObjectId(threadDbId)
          ? { _id: threadDbId, domain: context.domain, agentId, userId: context.personaUserId }
          : {
              threadId: threadDbId,
              domain: context.domain,
              agentId,
              userId: context.personaUserId,
            };
        const thread = await Conversation.findOne(query);
        if (!thread) {
          throw new NotFoundError('Thread not found');
        }
        langGraphThreadId = thread.threadId;
        await threadRepository.touchLastMessageAt(thread._id);
      }

      const { ticket, expiresAt } = mintVoiceTicket({
        principalType: 'ProjectAdmin',
        domain: context.domain,
        agentId: String(agent._id),
        subjectId: String(context.personaUserId),
        membershipRole: context.membershipRole,
        threadId: langGraphThreadId,
        contextOverride,
        context: validatedTurnContext,
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
