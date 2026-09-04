import type { HttpClient } from '../http.js';
import type { VoiceSessionTicket } from '../types/voice.js';

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
   * ```
   */
  async createSession(agentId: string): Promise<VoiceSessionTicket> {
    return this.http.request<VoiceSessionTicket>('POST', '/api/v1/developer/voice/sessions', {
      headers: { 'x-agent-id': agentId },
    });
  }
}
