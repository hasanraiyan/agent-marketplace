import { GoogleGenAI } from '@google/genai';

/**
 * Thin wrapper over @google/genai's Live API connect call — the ONLY file
 * beside VoiceSession.js that touches the Gemini SDK directly. Isolating
 * the raw `ai.live.connect` call here (rather than inlining it in
 * VoiceSession.js) keeps the "Gemini Live" and "one live voice session"
 * concerns separable, per voice-agent-plan.md §6.2's note that
 * voice.service.js/the rest of the module should stay provider-agnostic so
 * a second realtime provider could be added later without touching the
 * protocol layer.
 *
 * @param {{apiKey: string, model: string, config: object, callbacks: {onopen?: Function, onmessage: Function, onerror?: Function, onclose?: Function}}} params
 * @returns {Promise<import('@google/genai').Session>}
 */
export async function connectGeminiLive({ apiKey, model, config, callbacks }) {
  // The Live endpoint answers 404 on the SDK's default v1beta path for every
  // Live model (seen with @google/genai 3.0.0 and the newer `AQ.` keys);
  // v1alpha works. Overridable without a deploy via GEMINI_LIVE_API_VERSION.
  const apiVersion = process.env.GEMINI_LIVE_API_VERSION || 'v1alpha';
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion } });
  return ai.live.connect({ model, config, callbacks });
}

export default { connectGeminiLive };
