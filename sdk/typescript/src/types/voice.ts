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

/**
 * Options for {@link VoiceResource.createTelephonySession} — a call that
 * arrived on YOUR OWN Twilio number, not Persona's.
 */
export interface CreateTelephonySessionOptions {
  /** The Agent that answers the call. Must belong to this Project. */
  agentId: string;
  /**
   * Your own user id for the caller. This — not the phone number — becomes
   * the conversation identity, so the call continues the same thread as
   * that user's web chat and WhatsApp messages.
   */
  externalUserId: string;
  /** Caller phone number (E.164). Recorded as channel metadata only. */
  from?: string;
  /** The Twilio number that received the call (E.164). Metadata only. */
  to?: string;
  /** Twilio `CallSid`, logged only. */
  callSid?: string;
  /** Continue an existing Thread of this user (404 if it isn't theirs). */
  threadId?: string;
  /** At-connect context seed — same contract as {@link CreateVoiceSessionOptions.context}. */
  context?: Record<string, unknown>;
}

/**
 * Returned by {@link VoiceResource.createTelephonySession}. Put `streamUrl`
 * straight into TwiML as `<Connect><Stream url="…">` from your Twilio voice
 * webhook — Twilio then opens the audio stream to Persona directly, so your
 * own server never relays audio. The ticket is single-use and expires at
 * `expiresAt` (60s).
 */
export interface TelephonySessionTicket {
  /** Opaque, single-use, HMAC-signed, and only redeemable on the telephony media stream. */
  ticket: string;
  /** `wss://` media-stream URL, ticket included — use as the `<Stream url>`. */
  streamUrl: string;
  /** Alias of `streamUrl` (both are returned so either SDK shape works). */
  wsUrl: string;
  /** ISO 8601 — the ticket is rejected after this instant. */
  expiresAt: string;
}
