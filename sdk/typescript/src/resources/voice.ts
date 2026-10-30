import type { HttpClient } from '../http.js';
import type {
  CreateTelephonySessionOptions,
  TelephonySessionTicket,
  VoiceSessionTicket,
} from '../types/voice.js';

/**
 * Options for {@link VoiceResource.createSession}.
 */
export interface CreateVoiceSessionOptions {
  /**
   * Resume an existing conversation over voice instead of starting fresh.
   *
   * Accepts either the Thread's Mongo id or its stable LangGraph thread id
   * (the same value `threads.list` returns as `id` / that `chat.resume`
   * forwards as `x-thread-id`) — the server resolves either, and rejects
   * with a generic 404 if the thread isn't one this Subject owns for this
   * Agent. The voice turns are persisted back into the thread's history, so
   * a later text `resume` on the same thread sees them.
   *
   * Omit to start a fresh conversation (the server uses the deterministic
   * per-Subject scratch thread, exactly like a text run with no threadId).
   */
  threadId?: string;
  /**
   * Caller-supplied context appended to the Agent's system instruction for
   * this call — same field/cap/contract as {@link SendMessageOptions.contextOverride}
   * on `chat.stream()`. Unlike text chat, this is a **one-time append at
   * connect**, not re-applied per turn: Gemini Live's system instruction is
   * fixed for the whole call, so changing it mid-call requires ending this
   * session and starting a new one. Capped at 4000 characters server-side
   * (rejected with a 400, not truncated).
   */
  contextOverride?: string;
  /**
   * Caller-supplied context — same field/cap/contract as
   * {@link SendMessageOptions.contextOverride}'s sibling `context` field:
   * never shown to the model, only ever read live by an RCP tool's resolver
   * via `configurable.turnContext`. This is the **at-connect seed only** —
   * unlike text chat (which resends `context` on every message), a voice
   * call is one continuous session, so refreshing it mid-call means sending
   * `{ type: 'voice.context', context: {...} }` over the already-open
   * WebSocket yourself (merged into, not replacing, the current value) —
   * this SDK never touches that socket, see {@link VoiceResource}'s class
   * doc comment for why.
   */
  context?: Record<string, unknown>;
}

/**
 * Voice (`/api/v1/developer/voice/sessions`) — mints a single-use ticket
 * for connecting to the voice WebSocket gateway (real-time audio, powered
 * by Gemini Live). Requires this client to have been constructed with
 * `externalUserId` set, same as {@link ChatClient}/`threads` (voice always
 * runs as a Subject; a bare Project credential has no Subject to scope a
 * call to).
 *
 * This SDK never opens the WebSocket or touches audio itself — that stays
 * server-side by design (your Project credential must never reach a
 * browser). This method only gets YOUR OWN server a ticket to hand to YOUR
 * OWN frontend, which opens the actual `wss://` connection.
 */
export class VoiceResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Mints a voice session ticket for the given Agent.
   * @param agentId - The Agent to run in voice mode.
   * @param options - Optionally resume an existing conversation (see
   *   {@link CreateVoiceSessionOptions.threadId}).
   * @returns `{ ticket, wsUrl, expiresAt, session }`. Hand `wsUrl` (the
   *   ticket is already embedded in its query string) to your frontend;
   *   it should open a WebSocket to it before `expiresAt` (60s from mint)
   *   and never reuse the same ticket for a second connection attempt.
   * @throws {@link PersonaApiError} with code `VOICE_PROVIDER_REQUIRED` if
   *   this Project's Domain has no usable Gemini Provider configured, or
   *   `VOICE_INTERRUPT_ON_UNSUPPORTED` if the Agent has a guarded
   *   (`interruptOn`) tool enabled — voice sessions have no spoken
   *   confirmation flow yet.
   * @example
   * ```ts
   * const ticket = await client.voice.createSession(agentId);
   * // Hand ticket.wsUrl to your frontend; it does `new WebSocket(ticket.wsUrl)`.
   *
   * // Or resume the caller's existing text thread over voice:
   * const resumed = await client.voice.createSession(agentId, {
   *   threadId: userThreadId,
   * });
   * ```
   */
  async createSession(
    agentId: string,
    options: CreateVoiceSessionOptions = {}
  ): Promise<VoiceSessionTicket> {
    const headers: Record<string, string> = { 'x-agent-id': agentId };
    if (options.threadId) headers['x-thread-id'] = options.threadId;
    return this.http.request<VoiceSessionTicket>(
      'POST',
      '/api/v1/developer/voice/sessions',
      {
        headers,
        body:
          options.contextOverride !== undefined || options.context !== undefined
            ? {
                ...(options.contextOverride !== undefined
                  ? { contextOverride: options.contextOverride }
                  : {}),
                ...(options.context !== undefined ? { context: options.context } : {}),
              }
            : undefined,
      }
    );
  }

  /**
   * Mints a ticket for a call that arrived on YOUR OWN Twilio number.
   *
   * Call this from your Twilio voice webhook after you have resolved the
   * caller to one of your users, then answer Twilio with
   * `<Response><Connect><Stream url="${result.streamUrl}"/></Connect></Response>`.
   * Twilio then streams the audio to Persona directly; your server only
   * handles the one fast HTTP request, so this works on serverless hosts.
   *
   * `externalUserId` is what makes the cross-channel conversation work: the
   * call joins the same thread as that user's web chat and WhatsApp messages,
   * because both are keyed by your user id. The phone number is kept only as
   * channel metadata (`callerPhone` in the Agent's turn context).
   *
   * Your Twilio signature must be verified on your own server with your own
   * auth token — Persona never sees it, and doesn't need to: the ticket
   * proves the request came from your Project credential.
   *
   * @param options - The Agent, the resolved `externalUserId`, and optional
   *   call metadata (`from`, `to`, `callSid`, `threadId`, `context`).
   * @returns `{ ticket, streamUrl, wsUrl, expiresAt }` — use `streamUrl` in TwiML.
   * @throws {@link PersonaApiError} with code `EXTERNAL_USER_REQUIRED` when
   *   the client has no asserted user, 404 when the Agent isn't yours, and
   *   422 at call time if no Gemini provider is configured (the media-stream
   *   gateway refuses the upgrade rather than mid-call).
   * @example
   * ```ts
   * // In your Twilio voice webhook, after verifyTwilioSignature(...) and
   * // const user = await db.user.findByPhone(req.body.From):
   * const session = await client.voice.createTelephonySession({
   *   agentId,
   *   externalUserId: user.id,
   *   from: req.body.From,
   *   to: req.body.To,
   *   callSid: req.body.CallSid,
   * });
   * res.type('text/xml').send(
   *   `<Response><Connect><Stream url="${session.streamUrl}"/></Connect></Response>`
   * );
   * ```
   */
  async createTelephonySession(
    options: CreateTelephonySessionOptions
  ): Promise<TelephonySessionTicket> {
    const headers: Record<string, string> = { 'x-agent-id': options.agentId };
    if (options.threadId) headers['x-thread-id'] = options.threadId;

    const body: Record<string, unknown> = {};
    if (options.from !== undefined) body.from = options.from;
    if (options.to !== undefined) body.to = options.to;
    if (options.callSid !== undefined) body.callSid = options.callSid;
    if (options.context !== undefined) body.context = options.context;

    return this.http.request<TelephonySessionTicket>(
      'POST',
      '/api/v1/developer/voice/telephony/sessions',
      {
        headers,
        externalUserId: options.externalUserId,
        ...(Object.keys(body).length > 0 ? { body } : {}),
      }
    );
  }
}
