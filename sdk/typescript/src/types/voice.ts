/** Mirrors the CUSTOM `voice_session_ready` AG-UI event's payload shape. */
export interface VoiceSessionInfo {
  /** Gemini Live model this session is running (e.g. `gemini-3.1-flash-live-preview`). */
  model: string;
  /** Prebuilt voice name (e.g. `Zephyr`). */
  voice: string;
  /** PCM16 sample rate the client must send mic audio at. */
  inputSampleRate: number;
  /** PCM16 sample rate the server sends agent audio at. */
  outputSampleRate: number;
  /** Server-enforced hard cap for this session, independent of Gemini's own limits. */
  maxDurationMs: number;
}

/**
 * Returned by {@link VoiceResource.createSession}. Hand this whole object
 * (or at least `wsUrl`) to your frontend — the ticket embedded in `wsUrl`
 * is single-use and expires at `expiresAt` (60s from mint), so open the
 * WebSocket promptly and never reuse it for a second connection attempt.
 */
export interface VoiceSessionTicket {
  /** Opaque, single-use, HMAC-signed. Also embedded in `wsUrl`'s query string. */
  ticket: string;
  /** Full `wss://` URL, ticket included — pass directly to `new WebSocket(wsUrl)`. */
  wsUrl: string;
  /** ISO 8601 — the ticket is rejected after this instant. */
  expiresAt: string;
  session: VoiceSessionInfo;
}
