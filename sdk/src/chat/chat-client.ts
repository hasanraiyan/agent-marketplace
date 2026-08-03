import type { HttpClient } from '../http.js';
import {
  EventType,
  type AguiEvent,
  type ChatInterrupt,
  type ChatResult,
  type SendMessageOptions,
} from '../types/chat.js';
import { parseAguiEventStream } from './sse.js';

/**
 * AG-UI chat client (`/api/v1/developer/agui`) — runs an Agent as the
 * asserted external user, streaming the response. Requires this client to
 * have been constructed with `externalUserId` set (a bare Project
 * credential has no Subject to chat as; the server rejects it with 400).
 */
export class ChatClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Streams the raw AG-UI event sequence for a run — full control for
   * callers building their own UI (text deltas, tool calls, reasoning,
   * custom events) rather than just the final text.
   * @param agentId - The Agent to run.
   * @param options.messages - The conversation turn(s) to send.
   * @param options.threadId - Resumes a named Thread (from `threads.create()`)
   *   instead of the implicit deterministic one.
   * @param options.resume - Answers a pending interrupt from a previous run
   *   (see {@link ChatInterrupt}); omit for a fresh message.
   * @param options.signal - Aborts the underlying request/stream.
   * @yields Each raw {@link AguiEvent} as it arrives.
   */
  async *stream(agentId: string, options: SendMessageOptions): AsyncGenerator<AguiEvent> {
    const headers: Record<string, string> = { 'x-agent-id': agentId };
    if (options.threadId) headers['x-thread-id'] = options.threadId;

    const response = await this.http.request<Response>('POST', '/api/v1/developer/agui', {
      headers,
      body: { messages: options.messages, resume: options.resume },
      signal: options.signal,
    });

    yield* parseAguiEventStream(response);
  }

  /**
   * Convenience wrapper over `stream()`: drains the full run and returns
   * the assembled assistant text, plus a `ChatInterrupt` if the run paused
   * on a human-in-the-loop decision instead of finishing normally.
   * @param agentId - The Agent to run.
   * @param options - Same shape as {@link ChatClient.stream}'s `options`.
   * @returns `{ text, interrupt?, events }` — `interrupt` is set instead of
   *   the run finishing normally when a human-in-the-loop decision is
   *   pending; resume it by calling this again with `options.resume` set.
   * @example
   * ```ts
   * const result = await client.chat.sendMessage(agentId, {
   *   messages: [{ role: 'user', content: 'Hello!' }],
   * });
   * console.log(result.text);
   * ```
   */
  async sendMessage(agentId: string, options: SendMessageOptions): Promise<ChatResult> {
    let text = '';
    let interrupt: ChatInterrupt | undefined;
    const events: AguiEvent[] = [];

    for await (const event of this.stream(agentId, options)) {
      events.push(event);

      if (event.type === EventType.TEXT_MESSAGE_CHUNK) {
        if (typeof event.delta === 'string') text += event.delta;
      } else if (event.type === EventType.CUSTOM) {
        if (event.name === 'hitl_request') {
          interrupt = { kind: 'hitl', value: event.value };
        } else if (event.name === 'clarification_request') {
          interrupt = { kind: 'clarification', value: event.value };
        }
      }
    }

    return { text, interrupt, events };
  }
}
