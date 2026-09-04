import { z } from 'zod';
import { AGUI_VOICE_SCHEMA_VERSION, CLOSE_REASON } from './voice.constants.js';

/**
 * Documented, versioned catalog of the voice-gateway-only CUSTOM AG-UI
 * events (voice-agent-plan.md §5) — a SEPARATE registry from
 * agui/aguiEventSchemas.js's text-route events, exposed at its own
 * GET /api/v1/developer/voice/schema rather than folded into the existing
 * /developer/agui/schema document. Mixing the two would advertise
 * voice-only event types to text AG-UI consumers that will never receive
 * them. Same z.toJSONSchema-per-type pattern as the text registry
 * (aguiEventSchemas.js) — kept byte-for-byte consistent deliberately.
 */

export const voiceSessionReadySchema = z.object({
  model: z.string(),
  voice: z.string(),
  inputSampleRate: z.number().int(),
  outputSampleRate: z.number().int(),
  maxDurationMs: z.number().int(),
});

export const voiceActivitySchema = z.object({
  speaker: z.enum(['user', 'agent']),
  state: z.enum(['start', 'end']),
});

export const voiceTranscriptSchema = z.object({
  speaker: z.enum(['user', 'agent']),
  text: z.string(),
  isFinal: z.boolean(),
  turnSeq: z.number().int(),
});

export const voiceInterruptedSchema = z.object({
  turnSeq: z.number().int(),
});

export const voiceSessionResumedSchema = z.object({
  handle: z.string(),
});

export const voiceSessionEndedSchema = z.object({
  reason: z.enum(Object.values(CLOSE_REASON)),
  usage: z.object({
    durationMs: z.number().int(),
    inputTokens: z.number().int().optional(),
    outputTokens: z.number().int().optional(),
  }),
});

const VOICE_CUSTOM_EVENTS = [
  {
    type: 'voice_session_ready',
    description:
      'Sent once, immediately after the Gemini Live setupComplete handshake — tells the client which audio graph to build (sample rates, model, voice) before it starts streaming microphone input.',
    schema: voiceSessionReadySchema,
  },
  {
    type: 'voice_activity',
    description:
      "Voice activity detection boundary for either speaker — drives the client's orb animation and mic ducking.",
    schema: voiceActivitySchema,
  },
  {
    type: 'voice_transcript',
    description:
      'Live captions. isFinal:false mirrors serverContent.interimInputTranscription; isFinal:true mirrors inputTranscription/outputTranscription and is also mirrored as a TEXT_MESSAGE_CHUNK.',
    schema: voiceTranscriptSchema,
  },
  {
    type: 'voice_interrupted',
    description:
      'Barge-in: mirrors serverContent.interrupted. The client MUST flush any buffered playback audio whose turnSeq predates this event.',
    schema: voiceInterruptedSchema,
  },
  {
    type: 'voice_session_resumed',
    description:
      'The gateway transparently reconnected the upstream Gemini Live WebSocket using a stored sessionResumption handle — the client socket itself never closed.',
    schema: voiceSessionResumedSchema,
  },
  {
    type: 'voice_session_ended',
    description: 'Terminal event for the voice session, with a reason and best-effort usage totals.',
    schema: voiceSessionEndedSchema,
  },
];

function toPascalCase(snakeCase) {
  return snakeCase
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function buildVoiceAguiSchemaDocument() {
  const definitions = {};
  const events = VOICE_CUSTOM_EVENTS.map(({ type, description, schema }) => {
    const definitionName = `${toPascalCase(type)}Payload`;
    definitions[definitionName] = z.toJSONSchema(schema);
    return {
      type,
      description,
      payloadSchema: { $ref: `#/definitions/${definitionName}` },
    };
  });

  return {
    schemaVersion: AGUI_VOICE_SCHEMA_VERSION,
    baseProtocol: '@ag-ui/core@0.0.57',
    events,
    definitions,
  };
}
