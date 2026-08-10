import { EventType, type AGUIEvent } from '@ag-ui/core';
import type { PersonaRunErrorEvent } from './aguiEvents.js';

/** The full discriminated union of every AG-UI protocol event this backend can emit. */
export type AguiEvent = AGUIEvent;
/** Re-exported so consumers don't need a separate `@ag-ui/core` dependency just for this. */
export { EventType };

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  /** Plain text — this SDK doesn't yet support multi-part/multimodal content on the way in. */
  content: string;
}

/**
 * Approves/denies a pending human-in-the-loop interrupt from a previous
 * run, or answers a pending clarification. Shape depends on the
 * interrupt kind — see `ChatInterrupt`.
 */
export type ChatResume =
  { decisions: unknown[] } | { answers: unknown[]; text?: string } | Record<string, unknown>;

export interface SendMessageOptions {
  messages: ChatMessageInput[];
  /** Resumes a named Thread (from `threads.create()`) instead of the implicit deterministic one. */
  threadId?: string;
  resume?: ChatResume;
  /**
   * Caller-supplied context (e.g. a live end-user profile snapshot) appended
   * to this turn's system prompt only. Never persisted to any memory file
   * and never visible to later turns. Capped at 4000 characters server-side
   * — a longer value is rejected with a 400, not silently truncated.
   */
  contextOverride?: string;
  signal?: AbortSignal;
}

/**
 * A pending interrupt surfaced via a `CUSTOM` event — this backend's own
 * human-in-the-loop protocol (tool-approval or clarification-question),
 * not the newer standard AG-UI `RunFinishedInterruptOutcome` field (this
 * backend's translator doesn't emit that; confirmed by reading
 * `aguiTranslator.js` directly rather than assuming the spec's newer
 * shape applies).
 */
export interface ChatInterrupt {
  /** `hitl` → resume with `{ decisions: [...] }`. `clarification` → resume with `{ answers: [...], text? }`. */
  kind: 'hitl' | 'clarification';
  value: unknown;
}

export interface ChatResult {
  /** The final assembled assistant text (concatenated TEXT_MESSAGE_CHUNK deltas). */
  text: string;
  /** Set when the run paused on a human-in-the-loop interrupt instead of finishing normally. */
  interrupt?: ChatInterrupt;
  /** Set when the run ended in a genuine failure (RUN_ERROR) instead of finishing normally. */
  error?: PersonaRunErrorEvent;
  /** Every raw event received, in order — for callers who want full detail beyond `text`. */
  events: AguiEvent[];
}
