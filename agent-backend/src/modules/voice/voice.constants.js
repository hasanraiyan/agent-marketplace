/**
 * Voice Agents (Developer Platform, voice-agent-plan.md Phase 1).
 *
 * Curated, hand-maintained constants — deliberately NOT derived from
 * provider.service.js's fetchGeminiModels(). The Live API model family
 * (`*-live-*`, `*-native-audio-*`) is a different product surface from the
 * chat-completions models that endpoint lists, and voiceName is an
 * untyped free string in @google/genai's own PrebuiltVoiceConfig (no SDK
 * enum to draw from) — see voice-agent-plan.md §8.
 */

/** Documented Live API models (ai.google.dev/gemini-api/docs/live-guide). */
export const VOICE_MODELS = Object.freeze([
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
]);

export const DEFAULT_VOICE_MODEL = VOICE_MODELS[0];

/** Curated prebuilt voice names (aistudio.google.com/app/live). */
export const VOICE_NAMES = Object.freeze(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede']);

export const DEFAULT_VOICE_NAME = 'Zephyr';

/** Live API confirmed formats — see voice-agent-plan.md §12. */
export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;
export const INPUT_MIME_TYPE = `audio/pcm;rate=${INPUT_SAMPLE_RATE}`;

/** Ticket lifetime — long enough for a client to complete the WS upgrade
 * after minting, short enough that a captured ticket is useless quickly. */
export const TICKET_TTL_MS = 60 * 1000;

/**
 * Gemini's own audio-only session cap is 15 min; the underlying WebSocket
 * itself drops around 10 min regardless (voice-agent-plan.md §11) — so this
 * is Persona's own hard stop, independent of and shorter than either.
 */
export const DEFAULT_MAX_DURATION_MS = 15 * 60 * 1000;

/** No audio in ~60s of silence → close rather than hold the upstream open. */
export const IDLE_TIMEOUT_MS = 60 * 1000;

/** contextWindowCompression — extends the 15-min cap toward "unlimited". */
export const CONTEXT_WINDOW_TRIGGER_TOKENS = '25600';
export const CONTEXT_WINDOW_SLIDING_TARGET_TOKENS = '12800';

/**
 * Voice-mode system prompt preamble (voice-agent-plan.md §8). A prompt
 * tuned for markdown-rendered chat reads terribly aloud — this is prepended
 * to the Agent's own systemPrompt for every voice session, unconditionally
 * in Phase 1 (the systemPromptOverride escape hatch is a Phase 6 Agent-model
 * addition, not yet wired here).
 */
export const VOICE_MODE_PREAMBLE = `You are speaking with the user out loud, not chatting in text.
- Use short, natural sentences — the way a person talks, not the way a document reads.
- Never use markdown: no bullet lists, no headings, no code fences, no bold/italic markers.
- Spell out numbers, dates, and abbreviations the way you'd say them aloud.
- Never read a URL or file path aloud; describe what it is instead.
- Ask one question at a time and wait for the answer before moving on.`;

/** VoiceSession close reasons — sent in the voice_session_ended CUSTOM event. */
export const CLOSE_REASON = Object.freeze({
  CLIENT_CLOSED: 'client_closed',
  MAX_DURATION: 'max_duration',
  IDLE: 'idle',
  UPSTREAM_ERROR: 'upstream_error',
  UPSTREAM_GOAWAY: 'upstream_goaway',
});

export const AGUI_VOICE_SCHEMA_VERSION = '1.1.0';

/**
 * `ask_clarification` calls LangChain's `interrupt()` (clarification.tool.js),
 * which only works inside a running LangGraph graph — the voice runtime has
 * no graph at all (Gemini Live drives the loop directly), so calling it
 * would throw. It also doesn't fit a spoken conversation: the model can
 * just ask its question out loud instead of rendering a structured choice
 * card. Excluded from every voice toolset regardless of Agent config.
 */
export const EXCLUDED_VOICE_TOOL_NAMES = Object.freeze(['ask_clarification']);

/** A tool call that hangs longer than this is force-timed-out with a spoken
 * failure rather than leaving the model waiting forever for a response. */
export const TOOL_CALL_TIMEOUT_MS = 20000;
