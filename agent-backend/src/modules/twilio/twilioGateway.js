import { WebSocketServer } from 'ws';
import { loggerService } from '../../utils/index.js';
import agentRepository from '../agents/agent.repository.js';
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import externalUserService from '../externalUsers/externalUser.service.js';
import { createProjectRuntimeContext } from '../auth/projectPrincipalContext.js';
import { resolveVoiceProvider, buildVoiceLiveConfig } from '../voice/voice.service.js';
import voiceThreadService from '../voice/voiceThread.service.js';
import VoiceTranscriptSink from '../voice/voiceTranscriptSink.js';
import { redeemVoiceTicket } from '../voice/voiceTicket.service.js';
import { VoiceSession } from '../voice/gateway/VoiceSession.js';
import TwilioVoiceTransport from './TwilioVoiceTransport.js';

const logger = loggerService.getLogger();

export const TWILIO_WS_PATH = '/api/v1/twilio/media-stream';

/** Ticket audience minted for this path only (developerVoice.controller.js). */
export const TELEPHONY_TICKET_AUDIENCE = 'telephony';

/**
 * Attaches the Twilio Media Stream WebSocket gateway to http.Server.
 *
 * @param {import('http').Server} server
 * @returns {import('ws').WebSocketServer}
 */
export function attachTwilioGateway(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return;
    }

    if (url.pathname !== TWILIO_WS_PATH) {
      return;
    }

    handleTwilioUpgrade(req, socket, head, url, wss).catch((err) => {
      logger.warn('[TwilioGateway] Upgrade rejected', { err: err?.message });
      try {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      } catch {
        // socket already gone
      }
      socket.destroy();
    });
  });

  logger.info('[TwilioGateway] gateway attached', { path: TWILIO_WS_PATH });
  return wss;
}

/**
 * Handles incoming WebSocket upgrade requests from Twilio Media Streams.
 *
 * Authentication is the same single-use, HMAC-signed ticket the browser
 * voice gateway uses (voiceTicket.service.js) — Express middleware never
 * runs on a WS upgrade, and query parameters / custom stream parameters are
 * attacker-controlled, so neither can carry identity. The ticket is minted
 * by an authenticated HTTP call first (`POST
 * /api/v1/developer/voice/telephony/sessions`, or Persona's own Twilio
 * webhook for a Persona-hosted number) and is redeemable exactly once.
 *
 * A browser ticket is rejected here: the ticket's `audience` claim binds it
 * to the path it was minted for.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('stream').Duplex} socket
 * @param {Buffer} head
 * @param {URL} url
 * @param {import('ws').WebSocketServer} wss
 */
export async function handleTwilioUpgrade(req, socket, head, url, wss) {
  const ticket = url.searchParams.get('ticket');
  if (!ticket) {
    throw new Error('Missing ticket query parameter');
  }

  // Throws on bad signature, expiry, or replay — identical rejection either
  // way, so a forged ticket and a replayed real one look the same.
  const claims = redeemVoiceTicket(ticket);

  if (claims.audience !== TELEPHONY_TICKET_AUDIENCE || claims.principalType !== 'ProjectRuntime') {
    throw new Error('Ticket is not valid for telephony');
  }

  const projectId = claims.domain;
  const agentId = claims.agentId;

  wss.handleUpgrade(req, socket, head, (twilioWs) => {
    const transport = new TwilioVoiceTransport({ twilioWs });

    // Twilio sends the stream's own identifiers in the 'start' event; the
    // identity/agent configuration comes from the ticket alone, never from
    // these parameters.
    transport.once('stream_started', async ({ callSid }) => {
      const resolvedCallSid = claims.telephony?.callSid || callSid || null;

      logger.info('[TwilioGateway] Starting voice session for phone call', {
        callSid: resolvedCallSid,
        agentId,
        projectId,
        channel: claims.telephony?.channel || 'voice',
      });

      try {
        await startVoiceSessionForTwilio({
          transport,
          claims,
          projectId,
          agentId,
          callSid: resolvedCallSid,
        });
      } catch (err) {
        logger.error('[TwilioGateway] Failed to initialize VoiceSession for Twilio', {
          err: err?.message,
          stack: err?.stack,
          callSid: resolvedCallSid,
        });
        transport.close(1011, 'Failed to start AI voice session');
      }
    });
  });
}

/**
 * Initializes and connects the existing VoiceSession to TwilioVoiceTransport.
 *
 * Identity comes from the ticket's `subjectId` — which is the developer's
 * asserted external user id for a bring-your-own number, or the normalized
 * phone number for a Persona-hosted one. Thread continuity therefore follows
 * the same `agui-<domain>-<agent>-<externalUserId>` rule as web chat and
 * WhatsApp, collapsing all three channels into one conversation per user.
 */
async function startVoiceSessionForTwilio({ transport, claims, projectId, agentId, callSid }) {
  if (String(agentId) === ARCHITECT_AGENT_ID) {
    throw new Error('Architect agent cannot be invoked via telephony');
  }

  let candidate = null;
  try {
    candidate = await agentRepository.findById(agentId);
  } catch {
    candidate = null;
  }

  if (!candidate || candidate.deletedAt || candidate.isActive === false) {
    throw new Error(`Agent "${agentId}" not found`);
  }
  // The Project deliberately exposed this number, so private Agents are
  // runnable here — same rationale as the inbound messaging pipeline.
  if (candidate.domain && String(candidate.domain) !== String(projectId)) {
    throw new Error(`Agent "${agentId}" not found`);
  }

  // Populate attached tools & resources before building Live config
  if (typeof candidate.populate === 'function') {
    await candidate.populate([
      'skills',
      'mcps',
      'knowledgeBases',
      'storeMounts',
      'restApiTools',
      'restApiToolSources',
      'rcpSources',
    ]);
  }

  const externalUserId = claims.subjectId;
  if (!externalUserId) {
    throw new Error('Telephony ticket has no conversation subject');
  }

  // Anchors/tracks the external user for this Project (a no-op once known).
  await externalUserService.resolveOrCreate(projectId, externalUserId);

  const context = createProjectRuntimeContext({
    domain: projectId,
    credentialId: claims.credentialId || 'twilio',
    externalUserId,
  });

  const provider = await resolveVoiceProvider(candidate, projectId);
  const { model, voiceName, liveConfig, toolsByName } = await buildVoiceLiveConfig(
    candidate,
    projectId,
    context
  );

  if (claims.contextOverride) {
    liveConfig.systemInstruction =
      `${liveConfig.systemInstruction || ''}\n\n### CURRENT CONTEXT (this call only — do not save to memory)\n${claims.contextOverride}`.trim();
  }

  // Thread continuity & memory across channels: the same
  // agui-<domain>-<agent>-<externalUserId> a web chat run uses.
  const threadId = claims.threadId || `agui-${projectId}-${agentId}-${externalUserId}`;
  const channelContext = {
    ...(claims.context || {}),
    callerPhone: claims.telephony?.from || null,
    channel: claims.telephony?.channel || 'voice',
    callSid,
  };

  const sinkArgs = {
    agentId: String(candidate._id),
    userId: externalUserId,
    context,
    threadId,
  };

  let transcriptSink = null;
  try {
    const { excerpt } = await voiceThreadService.buildSeedSuffix(sinkArgs);
    if (excerpt) {
      liveConfig.systemInstruction = `${liveConfig.systemInstruction || ''}${excerpt}`;
    }
    transcriptSink = new VoiceTranscriptSink(sinkArgs);
  } catch (err) {
    logger.warn('[TwilioGateway] Thread seeding / sink setup failed (continuing ephemeral)', {
      err: err?.message,
    });
    transcriptSink = null;
  }

  const sessionClaims = {
    principalType: 'ProjectRuntime',
    domain: projectId,
    agentId: String(candidate._id),
    subjectId: externalUserId,
    threadId,
    callSid,
    context: channelContext,
  };

  const session = new VoiceSession({
    clientWs: transport,
    claims: sessionClaims,
    apiKey: provider.apiKey,
    model,
    voiceName,
    liveConfig,
    toolsByName,
    initialContext: channelContext,
    onTranscriptCommit: transcriptSink ? (role, text) => transcriptSink.commit(role, text) : null,
  });

  if (transcriptSink) {
    transport.on('close', () => {
      transcriptSink.flush().catch(() => {});
    });
  }

  await session.start();

  logger.info('[TwilioGateway] Gemini voice session active for phone call', {
    agentId: sessionClaims.agentId,
    projectId: sessionClaims.domain,
    callSid,
  });
}

export default { handleTwilioUpgrade, TWILIO_WS_PATH, TELEPHONY_TICKET_AUDIENCE };
