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
  constructor(private readonly http: HttpClient) {}

  /**
   * Streams the raw AG-UI event sequence for a run against the Architect.
   * @yields Each raw {@link AguiEvent} as it arrives.
   */
  async *stream(options: ArchitectMessageOptions): AsyncGenerator<AguiEvent> {
    const response = await this.http.request<Response>(
      'POST',
      '/api/v1/developer/architect/agui',
      {
        body: {
          messages: options.messages,
          resume: options.resume,
        },
        signal: options.signal,
      },
    );

    yield* parseAguiEventStream(response);
  }

  /**
   * Convenience wrapper over `stream()`: drains the full run and returns
   * the assembled assistant text, plus a `ChatInterrupt` if the run paused
   * on a human-in-the-loop decision (e.g. confirming `upsert_agent`)
   * instead of finishing normally.
   */
  async sendMessage(options: ArchitectMessageOptions): Promise<ChatResult> {
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
        } else if (event.name === 'clarification_request') {
          interrupt = { kind: 'clarification', value: event.value };
        }
      } else if (event.type === EventType.RUN_ERROR) {
        error = event as unknown as PersonaRunErrorEvent;
      }
    }

    return { text, interrupt, error, events };
  }
}
