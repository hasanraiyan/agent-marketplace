import { WebSocketServer } from 'ws';
import { loggerService } from '../../../utils/index.js';
import { redeemVoiceTicket } from '../voiceTicket.service.js';
import { resolveVoiceProvider, buildVoiceLiveConfig } from '../voice.service.js';
import agentService from '../../agents/agent.service.js';
import agentRepository from '../../agents/agent.repository.js';
import { ARCHITECT_AGENT_ID } from '../../agents/architectConstants.js';
import NotFoundError from '../../../utils/errors/NotFoundError.js';
import {
  createProjectAdminContext,
  createProjectRuntimeContext,
} from '../../auth/projectPrincipalContext.js';
import { VoiceSession } from './VoiceSession.js';
import voiceThreadService from '../voiceThread.service.js';
import VoiceTranscriptSink from '../voiceTranscriptSink.js';

const logger = loggerService.getLogger();

/**
 * The one WebSocket path both voice ticket-minting routes share (a machine
 * ticket in Phase 2 and a Developer Studio test ticket today) - the ticket
 * itself carries `principalType`, so this single upgrade handler knows
 * which context shape to reconstruct rather than the path needing to
 * (voice-agent-plan.md Section 7).
 */
export const VOICE_WS_PATH = '/api/v1/developer/voice';

/**
 * Attaches the voice WebSocket gateway to an already-listening http.Server.
 * Express middleware (clerkMiddleware, projectAdminAuthMiddleware, etc.)
 * never runs on a WebSocket 'upgrade' request, so this handler does its own
 * authentication by redeeming a single-use ticket minted moments earlier
 * over ordinary HTTP - see voiceTicket.service.js and
 * projectAgentVoiceTest.controller.js.
 *
 * @param {import('http').Server} server
 * @returns {import('ws').WebSocketServer}
 */
export function attachVoiceGateway(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }

    if (url.pathname !== VOICE_WS_PATH) {
      // Only one WS feature exists today, so destroying an unrecognized
      // path is safe. A second WS feature added later must switch this to
      // a non-destructive pass-through (return without touching the
      // socket) so each feature's own 'upgrade' listener gets a turn.
      socket.destroy();
      return;
    }

    handleVoiceUpgrade(req, socket, head, url, wss).catch((err) => {
      logger.warn('[Voice] upgrade rejected', { err: err?.message });
      try {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      } catch {
        // socket already gone
      }
      socket.destroy();
    });
  });

  logger.info('[Voice] gateway attached', { path: VOICE_WS_PATH });
  return wss;
}

async function handleVoiceUpgrade(req, socket, head, url, wss) {
  const ticket = url.searchParams.get('ticket');
  if (!ticket) {
    throw new Error('Missing ticket query parameter');
  }

  // Throws on bad signature, expiry, or replay - identical rejection either
  // way, so a forged ticket and a replayed real one are indistinguishable
  // from the outside (voice-agent-plan.md Section 7).
  const claims = redeemVoiceTicket(ticket);

  let context;
  let agent;

  if (claims.principalType === 'ProjectAdmin') {
    // Developer Studio test route (projectAgentVoiceTest.controller.js) -
    // the admin-browsing lookup, which also verifies Project ownership.
    context = createProjectAdminContext({
      domain: claims.domain,
      personaUserId: claims.subjectId,
      membershipRole: claims.membershipRole,
    });
    agent = await agentService.getDeveloperAgentById(claims.agentId, context);
  } else if (claims.principalType === 'ProjectRuntime') {
    // Machine route (developerVoice.controller.js) - mirrors
    // developerAgui.controller.js's own runtime lookup exactly
    // (agentRepository.findById + canUserExecuteAgent + an explicit
    // ARCHITECT_AGENT_ID block), rather than trusting the ticket's
    // mint-time validation alone.
    context = createProjectRuntimeContext({
      domain: claims.domain,
      credentialId: claims.credentialId,
      externalUserId: claims.subjectId,
    });

    if (String(claims.agentId) === ARCHITECT_AGENT_ID) {
      throw new NotFoundError('Agent not found');
    }

    let candidate = null;
    try {
      candidate = await agentRepository.findById(claims.agentId);
    } catch {
      candidate = null;
    }
    if (!candidate || !agentService.canUserExecuteAgent(candidate, context)) {
      throw new NotFoundError('Agent not found');
    }
    agent = candidate;
  } else {
    throw new Error(`Unsupported voice ticket principalType "${claims.principalType}"`);
  }

  const provider = await resolveVoiceProvider(agent, claims.domain);
  // Re-resolved here (not carried over from the ticket-mint call) rather
  // than trusting a snapshot from up to 60s ago - also the only place the
  // decrypted apiKey exists, and it must never ride inside the ticket
  // itself (the ticket transits the browser as a URL query param).
  const { model, voiceName, liveConfig, toolsByName } = await buildVoiceLiveConfig(
    agent,
    claims.domain,
    context
  );

  // Phase 4 (voice-agent-plan.md §4.1, §4.3): ProjectRuntime voice sessions
  // resume + persist to the Subject's Thread/checkpoint. The gateway
  // reconstructs context from ticket claims only, so:
  //  1. Re-check thread ownership before this session can touch a checkpoint
  //     (defense-in-depth on top of the mint-time check - throwing here
  //     rejects the upgrade exactly like the agent re-check above).
  //  2. Seed the call with the thread's recent history so the agent can
  //     answer "where were we?" - the excerpt rides inside
  //     systemInstruction and is bounded (buildSeedSuffix caps it).
  //  3. A VoiceTranscriptSink serializes committed turns back into the
  //     checkpoint as the call runs; flush() auto-titles on close.
  // Studio ProjectAdmin test sessions stay ephemeral (claims.threadId is
  // null) - and ANY seeding/persistence failure degrades to ephemeral
  // rather than breaking the audio call.
  let transcriptSink = null;
  if (claims.principalType === 'ProjectRuntime' && claims.threadId) {
    const sinkArgs = {
      agentId: String(agent._id),
      userId: claims.subjectId,
      context,
      threadId: claims.threadId,
    };
    await voiceThreadService.assertThreadOwnedByContext(claims.threadId, context);
    try {
      const { excerpt } = await voiceThreadService.buildSeedSuffix(sinkArgs);
      if (excerpt) {
        liveConfig.systemInstruction = `${liveConfig.systemInstruction || ''}${excerpt}`;
      }
      transcriptSink = new VoiceTranscriptSink(sinkArgs);
    } catch (err) {
      // Seed read or sink construction failed - keep the call alive without
      // persistence (fresh-context voice) rather than dropping the session.
      logger.warn('[Voice] thread persistence disabled for session (non-fatal)', {
        agentId: claims.agentId,
        err: err?.message,
      });
      transcriptSink = null;
    }
  }

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    const session = new VoiceSession({
      clientWs,
      claims,
      apiKey: provider.apiKey,
      model,
      voiceName,
      liveConfig,
      toolsByName,
      onTranscriptCommit: transcriptSink
        ? (role, text) => transcriptSink.commit(role, text)
        : null,
    });

    if (transcriptSink) {
      clientWs.on('close', () => {
        // Fire-and-forget end-of-call flush: drain the commit queue, then
        // auto-title the thread from its first user turn. Errors are logged
        // inside the sink, never thrown into the 'close' handler.
        transcriptSink.flush().catch(() => {});
      });
    }

    session.start().catch((err) => {
      logger.error('[Voice] session failed to start', { err: err?.message });
      try {
        clientWs.close(1011, 'voice session failed to start');
      } catch {
        // socket already gone
      }
    });
  });
}

export default { attachVoiceGateway, VOICE_WS_PATH };
