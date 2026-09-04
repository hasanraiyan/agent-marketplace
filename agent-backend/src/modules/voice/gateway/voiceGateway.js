import { WebSocketServer } from 'ws';
import { loggerService } from '../../../utils/index.js';
import { redeemVoiceTicket } from '../voiceTicket.service.js';
import { resolveVoiceProvider, buildVoiceLiveConfig } from '../voice.service.js';
import agentService from '../../agents/agent.service.js';
import { createProjectAdminContext } from '../../auth/projectPrincipalContext.js';
import { VoiceSession } from './VoiceSession.js';

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
  if (claims.principalType === 'ProjectAdmin') {
    context = createProjectAdminContext({
      domain: claims.domain,
      personaUserId: claims.subjectId,
      membershipRole: claims.membershipRole,
    });
  } else {
    // ProjectMachine / ProjectRuntime tickets arrive in Phase 2 alongside
    // the machine route - not reachable yet since only the Developer
    // Studio test route mints tickets today.
    throw new Error(`Unsupported voice ticket principalType "${claims.principalType}"`);
  }

  const agent = await agentService.getDeveloperAgentById(claims.agentId, context);
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

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    const session = new VoiceSession({
      clientWs,
      claims,
      apiKey: provider.apiKey,
      model,
      voiceName,
      liveConfig,
      toolsByName,
    });

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
