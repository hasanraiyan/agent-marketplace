import type { HttpClient } from '../http.js';
import {
  EventType,
  type AguiEvent,
  type ChatInterrupt,
  type ChatResult,
  type SendMessageOptions,
} from '../types/chat.js';
import type { PersonaRunErrorEvent } from '../types/aguiEvents.js';
import { parseAguiEventStream } from './sse.js';
import { createLogger, type Logger } from '../logger.js';

/**
 * AG-UI chat client (`/api/v1/developer/agui`) — runs an Agent as the
 * asserted external user, streaming the response. Requires this client to
 * have been constructed with `externalUserId` set (a bare Project
 * credential has no Subject to chat as; the server rejects it with 400).
 */
export class ChatClient {
  private readonly logger: Logger;
  constructor(
    private readonly http: HttpClient,
    logger?: Logger
  ) {
    this.logger = logger ?? createLogger('sdk:chat');
  }

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
   * @param options.contextOverride - Caller-supplied context appended to
   *   this turn's system prompt only — never persisted, never visible to
   *   later turns.
   * @param options.signal - Aborts the underlying request/stream.
   * @yields Each raw {@link AguiEvent} as it arrives.
   */
  async *stream(agentId: string, options: SendMessageOptions): AsyncGenerator<AguiEvent> {
    const headers: Record<string, string> = { 'x-agent-id': agentId };
    if (options.threadId) headers['x-thread-id'] = options.threadId;

    this.logger.debug('chat stream start', {
      agentId,
      hasThreadId: !!options.threadId,
      hasResume: !!options.resume,
      hasContextOverride: !!options.contextOverride,
      messageCount: options.messages?.length ?? 0,
    });
    this.logger.trace('chat stream request', {
      agentId,
      threadId: options.threadId,
      messagesPreview: options.messages?.map((m) => ({
        role: (m as { role?: string }).role,
        contentPreview:
          typeof (m as { content?: unknown }).content === 'string'
            ? String((m as { content?: unknown }).content).slice(0, 200)
            : undefined,
      })),
      hasResume: !!options.resume,
    });

    let response: Response;
    try {
      response = await this.http.request<Response>('POST', '/api/v1/developer/agui', {
        headers,
        body: {
          messages: options.messages,
          resume: options.resume,
          contextOverride: options.contextOverride,
        },
        signal: options.signal,
      });
      this.logger.debug('chat stream connected', { agentId, status: response.status });
    } catch (err) {
      this.logger.error('chat stream failed to connect', {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    let eventCount = 0;
    try {
      for await (const event of parseAguiEventStream(response, this.logger)) {
        eventCount += 1;
        this.logger.trace('chat event', { agentId, type: event.type, event });
        if (event.type === EventType.TEXT_MESSAGE_CHUNK) {
          this.logger.debug('chat text chunk', {
            agentId,
            deltaLength: (event as { delta?: string }).delta?.length ?? 0,
          });
        } else if (event.type === EventType.CUSTOM) {
          this.logger.debug('chat custom event', {
            agentId,
            name: (event as { name?: string }).name,
          });
        } else if (event.type === EventType.RUN_ERROR) {
          this.logger.warn('chat run error event', { agentId, event });
        }
        yield event;
      }
      this.logger.info('chat stream ended', { agentId, eventCount });
    } catch (err) {
      this.logger.error('chat stream error', {
        agentId,
        eventCount,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
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
    this.logger.debug('chat sendMessage start', {
      agentId,
      messageCount: options.messages?.length ?? 0,
    });
    let text = '';
    let interrupt: ChatInterrupt | undefined;
    let error: PersonaRunErrorEvent | undefined;
    const events: AguiEvent[] = [];

    for await (const event of this.stream(agentId, options)) {
      events.push(event);

      if (event.type === EventType.TEXT_MESSAGE_CHUNK) {
        if (typeof event.delta === 'string') text += event.delta;
      } else if (event.type === EventType.CUSTOM) {
        if (event.name === 'hitl_request') {
          interrupt = { kind: 'hitl', value: event.value };
          this.logger.info('chat interrupt — hitl_request', { agentId });
        } else if (event.name === 'clarification_request') {
          interrupt = { kind: 'clarification', value: event.value };
          this.logger.info('chat interrupt — clarification_request', { agentId });
        }
      } else if (event.type === EventType.RUN_ERROR) {
        // The base @ag-ui/core RunErrorEvent type only guarantees
        // `message`/`code: string | undefined` — this backend always sends
        // the fuller shape (code as a literal enum, retryable, providerName)
        // as passthrough extras, so PersonaRunErrorEvent is the accurate type.
        error = event as unknown as PersonaRunErrorEvent;
        this.logger.warn('chat run error', { agentId, code: (error as { code?: string }).code });
      }
    }

    this.logger.debug('chat sendMessage completed', {
      agentId,
      textLength: text.length,
      hasInterrupt: !!interrupt,
      hasError: !!error,
      eventCount: events.length,
    });
    if (error) {
      this.logger.warn('chat sendMessage ended with error', { agentId, code: error.code });
    } else if (interrupt) {
      this.logger.info('chat sendMessage paused on interrupt', { agentId, kind: interrupt.kind });
    } else {
      this.logger.info('chat sendMessage succeeded', { agentId, textLength: text.length });
    }

    return { text, interrupt, error, events };
  }
}
