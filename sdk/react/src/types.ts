import type { ReactNode } from "react";
import type { Logger, LogLevel } from "@personaai/logger";

export type PersonaRole = "user" | "assistant" | "system" | "reasoning";

/**
 * A reasoning (chain-of-thought) message, streamed ahead of the assistant's
 * answer. Each provider reasoning phase is its OWN message — the SDK never
 * merges phases together, matching how the web timeline renders them as
 * separate "Thoughts" bubbles. `content` holds the accumulated reasoning text.
 */

/** One live update on a running `task` (subagent) tool call's timeline. */
export interface PersonaSubagentActivityEntry {
  kind: "text" | "tool_start" | "tool_result";
  toolName?: string;
  args?: string;
  result?: string;
  delta?: string;
}

export interface PersonaToolCall {
  toolCallId: string;
  toolName: string;
  args?: string;
  result?: string;
  isError?: boolean;
  /**
   * Monotonic stream-order index, assigned when the call's first chunk
   * arrives. Reasoning phases and tool calls share the same counter, so a
   * client can interleave them chronologically (thought → tool → thought →
   * tool → answer). Absent on calls loaded from history.
   */
  seq?: number;
  /** Nested activity timeline — only present on `task` (subagent) tool calls. */
  subagentActivity?: PersonaSubagentActivityEntry[];
}

export interface PersonaMessage {
  id: string;
  role: PersonaRole;
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  toolCalls?: PersonaToolCall[];
  /**
   * Monotonic stream-order index for `role: 'reasoning'` messages, from the
   * same counter as `PersonaToolCall.seq` — lets clients place each reasoning
   * phase in its chronological spot relative to the tool calls that bracket it.
   */
  seq?: number;
  /**
   * @deprecated Model reasoning now streams as its own `role: 'reasoning'`
   * messages (one per phase, never merged). These fields are retained for
   * type-compat but are no longer populated on assistant messages.
   */
  reasoning?: string;
  isReasoning?: boolean;
}

export interface PersonaHitlActionRequest {
  name: string;
  args?: unknown;
}

export interface PersonaClarificationQuestion {
  id: string;
  text: string;
  options: string[];
  required: boolean;
  allowCustom: boolean;
}

/** A paused human-in-the-loop tool approval, or a paused clarification question. */
export type PersonaInterrupt =
  | {
      kind: "hitl";
      actionRequests: PersonaHitlActionRequest[];
      reviewConfigs: unknown[];
    }
  | { kind: "clarification"; questions: PersonaClarificationQuestion[] };

/** What to send back in `sendMessage(content, { resume })` to unpause a paused run. */
export type PersonaResumeValue =
  | { decisions: Array<{ type: "approve" | "reject"; message?: string }> }
  | { answers: unknown[]; text?: string };

/**
 * A file in the agent's own virtual workspace (deepagents' state-backed
 * filesystem — `write_file`/`read_file` tool calls, distinct from
 * `PersonaFileItem` uploads). Populated from `STATE_SNAPSHOT` events, or
 * from a reloaded thread's persisted state.
 */
export interface PersonaWorkspaceFile {
  content: string;
  size: number;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface PersonaTodo {
  content: string;
  status: string;
}

/** Set when the agent calls `present_file` to highlight a workspace file. */
export interface PersonaPresentedFile {
  path: string;
  title: string;
  description: string;
}

export interface PersonaProviderProps {
  /** Base URL where the Persona runtime / adapter is mounted, e.g. "http://localhost:4000/api/persona" */
  baseUrl: string;
  /** Async or sync getter for the user's Bearer JWT authentication token */
  getAuthToken?: () =>
    Promise<string | null | undefined> | string | null | undefined;
  /** Default Agent ID to direct chat conversations to */
  defaultAgentId?: string;
  /** Log level for the React SDK — off by default. */
  logLevel?: LogLevel;
  /** Custom logger instance — when provided, `logLevel` is ignored. */
  logger?: Logger;
  children: ReactNode;
}

export interface PersonaThread {
  _id: string;
  /** A bare id string on create()/get(); populated as an object on list(). */
  agentId:
    string | { _id: string; name: string; avatar?: string; slug: string };
  title?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the wire shape of `GET/POST /files` — `id`, not `_id`. */
export interface PersonaFileItem {
  id: string;
  originalName: string;
  mimeType: string;
  /** Bytes. */
  size: number;
  agentId: string | null;
  threadId: string | null;
  createdAt: string;
}

export interface PersonaMemoryFile {
  scope?: "user" | "agent";
  agentId?: string;
  path: string;
  content: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** One agent's group of agent-scoped memory files, as returned by `GET /memory`. */
export interface PersonaMemoryAgentGroup {
  agentId: string;
  /** `null` if the agent no longer exists. */
  agentName: string | null;
  files: PersonaMemoryFile[];
}

export interface PersonaMemoryList {
  userFiles: PersonaMemoryFile[];
  agentMemories: PersonaMemoryAgentGroup[];
}

/**
 * AG-UI protocol events emitted during streaming — mirrors exactly what
 * `aguiTranslator.js` produces server-side (verified against that file, not
 * guessed from the AG-UI spec: this backend only emits a subset, and uses
 * `TOOL_CALL_CHUNK` rather than separate START/ARGS events for tool calls,
 * and `REASONING_END` rather than `REASONING_MESSAGE_END`).
 */
export type PersonaStreamingEvent =
  | {
      type: "TEXT_MESSAGE_CHUNK";
      delta: string;
      messageId?: string;
      role?: "assistant";
    }
  | {
      type: "TOOL_CALL_CHUNK";
      toolCallId?: string;
      toolCallName?: string;
      delta?: string;
      parentMessageId?: string;
    }
  | {
      type: "TOOL_CALL_RESULT";
      toolCallId: string;
      content: string;
      messageId?: string;
      role?: "tool";
      structuredContent?: unknown;
    }
  | { type: "REASONING_MESSAGE_START"; messageId: string }
  | { type: "REASONING_MESSAGE_CONTENT"; messageId: string; delta: string }
  | { type: "REASONING_END" }
  | {
      type: "STATE_SNAPSHOT";
      /** Raw wire shape (snake_case timestamps) — useChat normalizes this into `files`/`todos`. */
      snapshot: {
        files: Record<
          string,
          {
            content: string;
            size: number;
            created_at: string | null;
            modified_at: string | null;
          }
        >;
        todos: PersonaTodo[];
      };
    }
  | {
      type: "RUN_ERROR";
      code: string;
      message: string;
      retryable?: boolean;
      providerName?: string;
    }
  | {
      type: "CUSTOM";
      name: "hitl_request";
      value: {
        actionRequests: PersonaHitlActionRequest[];
        reviewConfigs: unknown[];
      };
    }
  | {
      type: "CUSTOM";
      name: "clarification_request";
      value: {
        questions: PersonaClarificationQuestion[];
        currentIndex: number;
      };
    }
  | {
      type: "CUSTOM";
      name: "subagent_activity";
      value: { toolCallId: string } & PersonaSubagentActivityEntry;
    }
  | {
      type: "CUSTOM";
      name: "mcp_app";
      value: { toolCallId: string; resourceUri: string; mcpId: string };
    }
  | { type: "CUSTOM"; name: string & {}; value: unknown };

export interface UseChatOptions {
  agentId?: string;
  threadId?: string;
  initialMessages?: PersonaMessage[];
  onFinish?: (message: PersonaMessage) => void;
  onError?: (error: Error) => void;
  /** Hook for receiving every low-level AG-UI streaming event (tool calls, steps, subagents) */
  onEvent?: (event: PersonaStreamingEvent) => void;
  /**
   * Pass the object returned by `useVoice()` (sharing the same `threadId`) to have `useChat`
   * merge live voice turns into `messages` automatically — one bubble per utterance, deduped
   * against thread history and against a voice turn that already persisted back into this
   * thread, with the in-progress agent line updated in place while it's still being spoken.
   * No manual sync effects needed in the host app; injected messages get a `voice-` prefixed id.
   * Only applied while the passed hook's `state` is active (not `idle`/`ended`/`error`); the
   * host app still owns starting/stopping the call itself (e.g. `voice.start()`/`voice.stop()`).
   */
  voice?: UseVoiceResult;
}

export interface SendMessageOverride {
  agentId?: string;
  /**
   * A plain id, or a promise/thunk for one still in flight (e.g. a thread
   * being lazily created for the first message of a new conversation).
   * `sendMessage` only awaits this right before building the request body —
   * its own optimistic UI update (adding the user's message + a streaming
   * placeholder) already ran synchronously before that point, so callers
   * don't have to choose between "wait for the thread to exist" and
   * "show the message instantly": passing an in-flight promise here gets
   * both.
   */
  threadId?: string | Promise<string | undefined>;
  /** Answers/approves a paused interrupt from a previous turn instead of starting a fresh one. */
  resume?: PersonaResumeValue;
}

// ---- Voice (useVoice) ----------------------------------------------------

/**
 * `useVoice`'s call state, driven by `voice_activity` events from the
 * server (never guessed client-side). `'idle'` before `start()` and again
 * after a clean `stop()`; `'ended'` after the server itself closed the
 * session (see {@link PersonaVoiceEndReason}).
 */
export type PersonaVoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "ended";

/** A committed transcript line. See `partial` on {@link UseVoiceResult} for the in-progress one. */
export interface PersonaVoiceTranscriptLine {
  id: string;
  speaker: "user" | "agent";
  text: string;
}

export interface PersonaVoiceToolCall {
  id: string;
  name?: string;
  status: "running" | "done" | "error";
  /** Tool output (success) or error message — whichever applies. */
  summary?: string;
}

/** Why a voice session ended — the terminal `voice_session_ended` event's `reason`. */
export type PersonaVoiceEndReason =
  | "client_closed"
  | "agent_ended"
  | "max_duration"
  | "idle"
  | "upstream_error"
  | "upstream_goaway";

export interface UseVoiceOptions {
  /** Falls back to `PersonaProvider`'s `defaultAgentId` if omitted. */
  agentId?: string;
  /**
   * Resume an existing conversation over voice instead of starting fresh.
   * `start()` mints the session with this thread id (same value `useChat`'s
   * `threadId` uses), so voice turns are persisted back into that thread's
   * history — a later text message on the same thread sees them. Omit (or
   * leave undefined) to start a fresh conversation.
   */
  threadId?: string;
}

export interface UseVoiceResult {
  state: PersonaVoiceState;
  isMuted: boolean;
  /** Committed lines, oldest first. */
  transcript: PersonaVoiceTranscriptLine[];
  /** The current speaker's in-progress (not yet final) line, or `null`. */
  partial: PersonaVoiceTranscriptLine | null;
  toolCalls: PersonaVoiceToolCall[];
  error: Error | null;
  /** Set once the session ends — see {@link PersonaVoiceEndReason}. */
  endReason: PersonaVoiceEndReason | null;
  /** Mints a ticket via the host backend, then opens the call. Resets all state above. */
  start: () => Promise<void>;
  /** Ends the call and tears down the mic/speaker audio graph. Safe to call at any time. */
  stop: () => void;
  mute: (muted: boolean) => void;
  /** Sends a typed message mid-call instead of speaking — the agent may reply in either voice or text. */
  sendText: (text: string) => void;
}
