import { WebSocketServer } from 'ws';
import { loggerService } from '../../utils/index.js';
import agentRepository from '../agents/agent.repository.js';
import agentService from '../agents/agent.service.js';
import { ARCHITECT_AGENT_ID } from '../agents/architectConstants.js';
import externalUserService from '../externalUsers/externalUser.service.js';
import { createProjectRuntimeContext } from '../auth/projectPrincipalContext.js';
import { resolveVoiceProvider, buildVoiceLiveConfig } from '../voice/voice.service.js';
import voiceThreadService from '../voice/voiceThread.service.js';
import VoiceTranscriptSink from '../voice/voiceTranscriptSink.js';
import { VoiceSession } from '../voice/gateway/VoiceSession.js';
import TwilioVoiceTransport from './TwilioVoiceTransport.js';

const logger = loggerService.getLogger();

export const TWILIO_WS_PATH = '/api/v1/twilio/media-stream';

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
      logger.warn('[TwilioGateway] Upgrade error', { err: err?.message });
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
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
 * @param {import('http').IncomingMessage} req
 * @param {import('stream').Duplex} socket
 * @param {Buffer} head
 * @param {URL} url
 * @param {import('ws').WebSocketServer} wss
 */
export async function handleTwilioUpgrade(req, socket, head, url, wss) {
  // Query parameters or custom parameters carry agentId & projectId
  const queryAgentId = url.searchParams.get('agentId');
  const queryProjectId = url.searchParams.get('projectId');
  const queryCallerPhone = url.searchParams.get('callerPhone');

  wss.handleUpgrade(req, socket, head, (twilioWs) => {
    const transport = new TwilioVoiceTransport({ twilioWs });

    // Twilio sends its parameters in the 'start' event
    transport.once('stream_started', async ({ streamSid, callSid, customParameters }) => {
      const agentId = customParameters.agentId || queryAgentId;
      const projectId = customParameters.projectId || queryProjectId;
      const callerPhone = customParameters.callerPhone || queryCallerPhone || 'unknown-caller';

      logger.info('[TwilioGateway] Starting voice session for phone call', {
        streamSid,
        callSid,
        agentId,
        projectId,
        callerPhone,
      });

      if (!agentId || !projectId) {
        logger.error('[TwilioGateway] Missing agentId or projectId in stream start', {
          customParameters,
        });
        transport.close(1008, 'Missing agent or project configuration');
        return;
      }

      try {
        await startVoiceSessionForTwilio({
          transport,
          agentId,
          projectId,
          callerPhone,
          callSid,
        });
      } catch (err) {
        logger.error('[TwilioGateway] Failed to initialize VoiceSession for Twilio', {
          err: err?.message,
          stack: err?.stack,
        });
        transport.close(1011, 'Failed to start AI voice session');
      }
    });
  });
}

/**
 * Initializes and connects the existing VoiceSession to TwilioVoiceTransport.
 */
async function startVoiceSessionForTwilio({ transport, agentId, projectId, callerPhone, callSid }) {
  if (String(agentId) === ARCHITECT_AGENT_ID) {
    throw new Error('Architect agent cannot be invoked via telephony');
  }

  let candidate = null;
  try {
    candidate = await agentRepository.findById(agentId);
  } catch {
    candidate = null;
  }

  if (!candidate) {
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

  // Track or resolve external user anchor for this caller phone number
  await externalUserService.resolveOrCreate(projectId, callerPhone);

  const context = createProjectRuntimeContext({
    domain: projectId,
    externalUserId: callerPhone,
  });

  const provider = await resolveVoiceProvider(candidate, projectId);
  const { model, voiceName, liveConfig, toolsByName } = await buildVoiceLiveConfig(
    candidate,
    projectId,
    context
  );

  // Thread continuity & memory across calls: agui-${domain}-${agentId}-${callerPhone}
  const threadId = `agui-${projectId}-${agentId}-${callerPhone}`;
  let transcriptSink = null;

  const sinkArgs = {
    agentId: String(candidate._id),
    userId: callerPhone,
    context,
    threadId,
  };

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

  const claims = {
    principalType: 'ProjectRuntime',
    domain: projectId,
    agentId: String(candidate._id),
    subjectId: callerPhone,
    threadId,
    callSid,
  };

  const session = new VoiceSession({
    clientWs: transport,
    claims,
    apiKey: provider.apiKey,
    model,
    voiceName,
    liveConfig,
    toolsByName,
    onTranscriptCommit: transcriptSink ? (role, text) => transcriptSink.commit(role, text) : null,
  });

  if (transcriptSink) {
    transport.on('close', () => {
      transcriptSink.flush().catch(() => {});
    });
  }

  await session.start();

  logger.info('[TwilioGateway] Gemini voice session active for phone call', {
    agentId: claims.agentId,
    projectId: claims.domain,
    callSid,
  });
}

export default { handleTwilioUpgrade, TWILIO_WS_PATH };
