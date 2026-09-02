import type { HttpClient } from '../http.js';
import {
  EventType,
  type AguiEvent,
  type ChatInterrupt,
  type ChatMessageInput,
  type ChatResult,
  type ChatResume,
} from '../types/chat.js';
import type { PersonaRunErrorEvent } from '../types/aguiEvents.js';
import { parseAguiEventStream } from './sse.js';
import { createLogger, type Logger } from '../logger.js';

export interface ArchitectMessageOptions {
  messages: ChatMessageInput[];
  /** Answers a pending interrupt from a previous run; omit for a fresh message. */
  resume?: ChatResume;
  /** Aborts the underlying request/stream. */
  signal?: AbortSignal;
}

/**
 * Agent Architect client (`/api/v1/developer/architect/agui`) — a
 * conversational co-pilot that creates/edits Agents via tool calls, on your
 * behalf. Unlike {@link ChatClient}, there's no `agentId` to pass (it's
 * always this one dedicated Architect) and no thread selection (one
 * implicit conversation per caller — see below).
 *
 * **Ownership depends on whether this client was constructed with
 * `externalUserId`:** omit it and the Architect builds/edits Agents owned
 * by your whole Project (the SDK-reachable equivalent of a Project Admin
 * managing the shared roster by hand). Set it and the Architect builds/edits
 * Agents owned by that one external user instead — the same dual-mode
 * ownership convention every other Developer Platform resource already
 * follows (see {@link AgentsResource}).
 */
export class ArchitectClient {
  private readonly logger: Logger;
  constructor(
    private readonly http: HttpClient,
    logger?: Logger
  ) {
    this.logger = logger ?? createLogger('sdk:architect');
  }

  /**
   * Streams the raw AG-UI event sequence for a run against the Architect.
   * @yields Each raw {@link AguiEvent} as it arrives.
   */
  async *stream(options: ArchitectMessageOptions): AsyncGenerator<AguiEvent> {
    this.logger.debug('architect stream start', {
      hasResume: !!options.resume,
      messageCount: options.messages?.length ?? 0,
    });
    this.logger.trace('architect stream request', {
      messagesPreview: options.messages?.map((m) => ({
        role: (m as { role?: string }).role,
        contentPreview:
          typeof (m as { content?: unknown }).content === 'string'
            ? String((m as { content?: unknown }).content).slice(0, 200)
            : undefined,
      })),
    });

    let response: Response;
    try {
      response = await this.http.request<Response>('POST', '/api/v1/developer/architect/agui', {
        body: {
          messages: options.messages,
          resume: options.resume,
        },
        signal: options.signal,
      });
      this.logger.debug('architect stream connected', { status: response.status });
    } catch (err) {
      this.logger.error('architect stream failed to connect', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    let eventCount = 0;
    try {
      for await (const event of parseAguiEventStream(response, this.logger)) {
        eventCount += 1;
        this.logger.trace('architect event', { type: event.type, event });
        if (event.type === EventType.CUSTOM) {
          this.logger.debug('architect custom event', { name: (event as { name?: string }).name });
        } else if (event.type === EventType.RUN_ERROR) {
          this.logger.warn('architect run error event', { event });
        }
        yield event;
      }
      this.logger.info('architect stream ended', { eventCount });
    } catch (err) {
      this.logger.error('architect stream error', {
        eventCount,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Convenience wrapper over `stream()`: drains the full run and returns
   * the assembled assistant text, plus a `ChatInterrupt` if the run paused
   * on a human-in-the-loop decision (e.g. confirming `upsert_agent`)
   * instead of finishing normally.
   */
  async sendMessage(options: ArchitectMessageOptions): Promise<ChatResult> {
    this.logger.debug('architect sendMessage start', {
      messageCount: options.messages?.length ?? 0,
    });
    let text = '';
    let interrupt: ChatInterrupt | undefined;
    let error: PersonaRunErrorEvent | undefined;
    const events: AguiEvent[] = [];

    for await (const event of this.stream(options)) {
      events.push(event);

      if (event.type === EventType.TEXT_MESSAGE_CHUNK) {
        if (typeof event.delta === 'string') text += event.delta;
      } else if (event.type === EventType.CUSTOM) {
        if (event.name === 'hitl_request') {
          interrupt = { kind: 'hitl', value: event.value };
          this.logger.info('architect interrupt — hitl_request');
        } else if (event.name === 'clarification_request') {
          interrupt = { kind: 'clarification', value: event.value };
          this.logger.info('architect interrupt — clarification_request');
        }
      } else if (event.type === EventType.RUN_ERROR) {
        error = event as unknown as PersonaRunErrorEvent;
        this.logger.warn('architect run error', { code: (error as { code?: string }).code });
      }
    }

    this.logger.debug('architect sendMessage completed', {
      textLength: text.length,
      hasInterrupt: !!interrupt,
      hasError: !!error,
      eventCount: events.length,
    });
    if (error) this.logger.warn('architect sendMessage ended with error', { code: error.code });
    else if (interrupt)
      this.logger.info('architect sendMessage paused on interrupt', { kind: interrupt.kind });
    else this.logger.info('architect sendMessage succeeded', { textLength: text.length });

    return { text, interrupt, error, events };
  }
}
