import { EventType, type AGUIEvent } from '@ag-ui/core';
import type { PersonaRunErrorEvent } from './aguiEvents.js';

/** The full discriminated union of every AG-UI protocol event this backend can emit. */
export type AguiEvent = AGUIEvent;
/** Re-exported so consumers don't need a separate `@ag-ui/core` dependency just for this. */
export { EventType };

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  /**
   * Plain text, or (user messages) text plus images — see {@link ChatContentPart}.
   * Usually simpler: keep this a string and pass {@link SendMessageOptions.attachments}.
   */
  content: string | ChatContentPart[];
}

/**
 * Image input limits enforced by the server (the Agent needs
 * `imageInputEnabled`). The type is checked from the file's bytes, not its
 * name or declared MIME type. Exported so clients can validate before upload.
 */
export const IMAGE_ATTACHMENT_LIMITS = Object.freeze({
  maxImagesPerMessage: 4,
  maxImageBytes: 5 * 1024 * 1024,
  mimeTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const),
});

export type ImageAttachmentMimeType = (typeof IMAGE_ATTACHMENT_LIMITS.mimeTypes)[number];

/** A text part of a user message. */
export interface ChatTextPart {
  type: 'text';
  text: string;
}

/**
 * An image part of a user message: a file uploaded with `files.upload()`
 * (`fileId`), or AG-UI inline data. `source.type: 'url'` is only accepted
 * for hosts the server allowlists (`IMAGE_INPUT_URL_HOSTS`).
 */
export type ChatImagePart =
  | { type: 'image'; fileId: string }
  | {
      type: 'image';
      source:
        | { type: 'data'; value: string; mimeType: string }
        | { type: 'url'; value: string; mimeType?: string };
    };

export type ChatContentPart = ChatTextPart | ChatImagePart;

/** An image to attach to the turn's user message — the id of a file from `files.upload()`. */
export interface ChatAttachmentInput {
  fileId: string;
}

/** An image attached to a user message, as returned in Thread history (`threads.messages()`). */
export interface ChatAttachment {
  fileId: string;
  mimeType: string;
  name?: string;
}

/**
 * Adds `attachments` as image parts to the last user message of `messages`
 * (returns a new array; the inputs are not changed). With no attachments
 * the array is returned as-is.
 */
export function withAttachments(
  messages: ChatMessageInput[],
  attachments: ChatAttachmentInput[] | undefined
): ChatMessageInput[] {
  if (!attachments?.length) return messages;
  const index = messages.map((m) => m.role).lastIndexOf('user');
  if (index === -1) throw new Error('attachments need a user message to attach to');
  const target = messages[index]!;
  const parts: ChatContentPart[] =
    typeof target.content === 'string'
      ? target.content
        ? [{ type: 'text', text: target.content }]
        : []
      : [...target.content];
  for (const attachment of attachments) parts.push({ type: 'image', fileId: attachment.fileId });
  const next = [...messages];
  next[index] = { ...target, content: parts };
  return next;
}

/**
 * Approves/denies a pending human-in-the-loop interrupt from a previous
 * run, or answers a pending clarification. Shape depends on the
 * interrupt kind — see `ChatInterrupt`.
 */
export type ChatResume =
  | { decisions: unknown[] }
  | { answers: unknown[]; text?: string }
  | { toolResults: FrontendToolResult[] }
  | Record<string, unknown>;

/**
 * A tool your client app runs itself (e.g. in the end user's browser) that
 * the Agent may call — the AG-UI `RunAgentInput.tools` shape. Only used when
 * the Agent has `frontendToolsEnabled`; otherwise ignored. Names must match
 * `^[a-zA-Z0-9_-]{1,64}$` and must not clash with the Agent's own tools (a
 * clashing tool is dropped). At most 20 per run; `parameters` ≤ 8 KB.
 */
export interface FrontendToolDefinition {
  name: string;
  /** What the tool does and when to use it — the model reads this. */
  description?: string;
  /** JSON Schema of the arguments (`type: "object"`). Defaults to no arguments. */
  parameters?: Record<string, unknown>;
}

/**
 * Your answer for one paused frontend tool call — resume the Thread with
 * `resume: { toolResults: [...] }`. Set `error` to report a failure (or the
 * user declining); otherwise `result` (any JSON value) is returned to the model.
 */
export interface FrontendToolResult {
  /** The `toolCallId` from the `frontend_tool_request` event. */
  toolCallId: string;
  result?: unknown;
  error?: string;
}

/** One call in a `frontend_tool_request` CUSTOM event / `frontend_tool` interrupt. */
export interface FrontendToolCall {
  toolCallId: string | null;
  name: string;
  args: Record<string, unknown>;
}

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
   *
   * Distinct from {@link SendMessageOptions.context} below: this is
   * model-visible prose; `context` is never shown to the model at all.
   */
  contextOverride?: string;
  /**
   * Caller-supplied context — **never shown to the model in any form**,
   * unlike {@link SendMessageOptions.contextOverride} above. Only ever read
   * live by an RCP tool's resolver (see your Project's RCP Sources
   * `paramContextMap` configuration) at the moment that tool is actually
   * called — a param mapped there is permanently absent from the model's
   * tool schema, and its value is filled from this object's matching key.
   * Must be a flat object of string/number/boolean values only (no nested
   * objects/arrays); capped at 2000 bytes serialized — a violation is
   * rejected with a 400, not silently truncated or coerced. Resent on every
   * turn you want it to apply to; omitting it on a later `chat.stream()`
   * call does not carry forward a value from an earlier one.
   */
  context?: Record<string, unknown>;
  /**
   * Tools your app runs itself that the Agent may call this turn (see
   * {@link FrontendToolDefinition}). When the model calls one, the run
   * pauses with a `frontend_tool` interrupt; run the tool, then resume with
   * `resume: { toolResults: [...] }` — send `tools` again on that resume.
   * Ignored unless the Agent has `frontendToolsEnabled`.
   */
  tools?: FrontendToolDefinition[];
  /**
   * Images for this turn, added to the last user message — upload each one
   * with `files.upload()` first and pass its id. Needs the Agent's
   * `imageInputEnabled` (otherwise the images are dropped and the model is
   * told one was attached). Limits: {@link IMAGE_ATTACHMENT_LIMITS}. An
   * invalid image fails the run with a `RUN_ERROR` of code
   * `INVALID_ATTACHMENT`; a model that can't read images, `MODEL_NO_VISION`.
   */
  attachments?: ChatAttachmentInput[];
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
  /**
   * `hitl` → resume with `{ decisions: [...] }`. `clarification` → resume with `{ answers: [...], text? }`.
   * `frontend_tool` → `value` is `{ calls: FrontendToolCall[] }`; resume with `{ toolResults: [...] }`.
   */
  kind: 'hitl' | 'clarification' | 'frontend_tool';
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
