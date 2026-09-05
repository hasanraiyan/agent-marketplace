import type { HttpClient } from '../http.js';
import type { VoiceSessionTicket } from '../types/voice.js';

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
      { headers }
    );
  }
}
