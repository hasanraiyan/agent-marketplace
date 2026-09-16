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
  /** Present when this tool is backed by an interactive MCP Ext App. */
  mcpApp?: { resourceUri: string; mcpId: string };
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

/**
 * One `execute` tool call against an Agent's sandbox (real shell execution
 * in an isolated CodeSandbox VM — requires the Agent's `sandboxEnabled` and
 * a `CSB_API_KEY` Project Secret; see the Agent's `sandboxEnabled` field).
 * Derived from `PersonaToolCall`s named `execute` across every message in
 * the conversation, in stream order — not a separate live/history-tracked
 * state, so it's always consistent with `messages`.
 */
export interface PersonaSandboxCommand {
  toolCallId: string;
  /** The shell command, parsed from the tool call's `args`. Falls back to the raw args string while still streaming/incomplete. */
  command: string;
  /** stdout/stderr, once the call finishes. */
  output?: string;
  /** `null` when the result parsed but didn't carry an exit code; `undefined` while still running. */
  exitCode?: number | null;
  status: "running" | "done" | "error";
  seq?: number;
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
  scope?: "user" | "agent" | "workspace";
  /** Set when `scope` is `"agent"` or `"workspace"`. */
  agentId?: string;
  path: string;
  content: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * One agent's group of scoped memory files, as returned by `GET /memory` —
 * used for both `agentMemories` (`scope: "agent"`) and `agentWorkspaces`
 * (`scope: "workspace"`).
 */
export interface PersonaMemoryAgentGroup {
  agentId: string;
  /** `null` if the agent no longer exists. */
  agentName: string | null;
  files: PersonaMemoryFile[];
}

export interface PersonaMemoryList {
  userFiles: PersonaMemoryFile[];
  agentMemories: PersonaMemoryAgentGroup[];
  /**
   * Files under an Agent's own `/workspace/` filesystem route — the SAME
   * persistent store `write_file`/`read_file` tool calls under
   * `/workspace/...` actually read and write. Scoped by Agent + Subject,
   * shared across every Thread that Subject has with that Agent (not
   * private to one conversation).
   */
  agentWorkspaces: PersonaMemoryAgentGroup[];
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
      type: "RUN_STARTED";
      threadId?: string;
      runId?: string;
    }
  | {
      type: "RUN_FINISHED";
    }
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
  | { type: "title"; title: string }
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
  | {
      type: "CUSTOM";
      name: "workflow_node_started";
      value: {
        nodeId: string;
        nodeType: string;
        nodeLabel: string;
        input?: unknown;
      };
    }
  | {
      type: "CUSTOM";
      name: "workflow_node_completed";
      value: {
        nodeId: string;
        output: unknown;
      };
    }
  | {
      type: "CUSTOM";
      name: "workflow_node_failed";
      value: {
        nodeId: string;
        error: string;
      };
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
  /** Called when a fake/ephemeral chat mints a real thread on first send. Use to sync sidebar state (e.g. setThreadId(id)). */
  onThreadCreated?: (threadId: string) => void;
  /** Called when the backend auto-generates a thread title (3-4 word LLM summary of first user message). */
  onTitle?: (title: string) => void;
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
  /**
   * Caller-supplied context — never shown to the model in any form, unlike
   * `contextOverride` (see {@link SendMessageOverride.contextOverride}).
   * Only ever read live by an RCP tool's resolver at the moment it's
   * actually called. Accepts a plain object, or a getter (`() => object`)
   * so `sendMessage()` always reads your app's *current* state at send
   * time — no ref, no effect to keep it in sync as the value changes (e.g.
   * the user navigates to a different page mid-conversation). Shallow-merged
   * with any call-level `sendMessage(text, { context })` override, which
   * wins on key collisions. Must be a flat object of string/number/boolean
   * values only, capped at 2000 bytes serialized — a violation is rejected
   * with a 400, not silently truncated or coerced.
   */
  context?: Record<string, unknown> | (() => Record<string, unknown>);
}

export interface UseArchitectChatOptions {
  threadId?: string;
  initialMessages?: PersonaMessage[];
  onFinish?: (message: PersonaMessage) => void;
  onError?: (error: Error) => void;
  /** Hook for receiving every low-level AG-UI streaming event (tool calls, steps, subagents) */
  onEvent?: (event: PersonaStreamingEvent) => void;
  /** Called when a fake/ephemeral chat mints a real thread on first send. Use to sync sidebar state (e.g. setThreadId(id)). */
  onThreadCreated?: (threadId: string) => void;
  /** Called when the backend auto-generates a thread title (3-4 word LLM summary of first user message). */
  onTitle?: (title: string) => void;
}

export interface SendArchitectMessageOverride {
  /**
   * A plain id, or a promise/thunk for one still in flight (e.g. a thread
   * being lazily created for the first message of a new conversation).
   * Mirrors {@link SendMessageOverride.threadId}.
   */
  threadId?: string | Promise<string | undefined>;
  /** Answers/approves a paused interrupt from a previous turn instead of starting a fresh one. */
  resume?: PersonaResumeValue;
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
  /**
   * Caller-supplied context (e.g. a live end-user profile snapshot) appended to this turn's
   * system prompt only — never persisted, never visible to later turns. Capped at 4000
   * characters server-side (rejected with a 400, not truncated). Mirrors
   * `@personaai/sdk`'s `SendMessageOptions.contextOverride`.
   */
  contextOverride?: string;
  /**
   * One-off override for this send only — shallow-merged on top of
   * `useChat`'s hook-level `context` option (this wins on key collisions).
   * Same shape/cap/contract as the hook-level option; see
   * {@link UseChatOptions.context}.
   */
  context?: Record<string, unknown>;
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
  /**
   * Caller-supplied context appended to the Agent's system instruction for
   * this call — same field/cap/contract as `useChat`'s `sendMessage(text, {
   * contextOverride })`. Unlike text chat, this is a **one-time append at
   * connect**, not re-applied per turn: Gemini Live's system instruction is
   * fixed for the whole call, so changing it means ending this call and
   * starting a new `start()`. Capped at 4000 characters server-side
   * (rejected with a 400, not truncated).
   */
  contextOverride?: string;
  /**
   * Caller-supplied context — never shown to the model, only ever read live
   * by an RCP tool's resolver. This is the **at-connect seed only**, passed
   * to `start()`'s ticket-mint call. To refresh it for the rest of an
   * already-open call (a voice call can run up to 15 minutes — long enough
   * for the caller's own context to change), use the returned
   * `updateContext()` instead, which sends it live over the open WebSocket
   * with no reconnect and no interruption to the audio.
   */
  context?: Record<string, unknown>;
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
  /**
   * Live-refreshes context for the rest of this already-open call — merged
   * into, not replacing, whatever context is already set (from `start()`'s
   * `context` option or a previous `updateContext()` call). Sent directly
   * over the open WebSocket (`{ type: 'voice.context', context }`); a no-op
   * if the call isn't currently active. No reconnect, no dropped audio —
   * the next tool call in this session reads the new value.
   */
  updateContext: (context: Record<string, unknown>) => void;
}

// ---- Workflows -------------------------------------------------------------
// Mirrors `@personaai/sdk`'s real wire shapes exactly (`types/workflow.ts`) —
// a prior version of this section had drifted from them (a `triggers[]`
// array where the backend only ever accepts a singular `trigger`, a `status`
// enum field that doesn't exist on `Workflow` at all, `slug`/`tags` that
// don't exist, wrong node-type and run-status enum values, ...). Corrected
// here; every hook using these types was updated to match.

export type PersonaWorkflowNodeType =
  | "trigger"
  | "agentStep"
  | "knowledgeStep"
  | "toolStep"
  | "condition"
  | "approval"
  | "parallel"
  | "join"
  | "output";

export type PersonaWorkflowTriggerType = "manual" | "api" | "webhook" | "schedule" | "chat";
export type PersonaWorkflowVisibility = "private" | "unlisted" | "public";
export type PersonaWorkflowOwnerType = "Project" | "ExternalUser";
export type PersonaNodeOnErrorAction = "fail" | "continue" | "routeError";

export interface PersonaNodeRetryPolicy {
  maxRetries?: number;
  backoffMs?: number;
  exponential?: boolean;
}

export interface PersonaWorkflowNodeData {
  label: string;
  description?: string;
  config?: Record<string, unknown>;
  retryPolicy?: PersonaNodeRetryPolicy;
  onError?: PersonaNodeOnErrorAction;
}

export interface PersonaWorkflowNode {
  id: string;
  type: PersonaWorkflowNodeType;
  position?: { x: number; y: number };
  data: PersonaWorkflowNodeData;
}

export interface PersonaWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: unknown;
  conditionValue?: string;
}

export interface PersonaWorkflowTrigger {
  type: PersonaWorkflowTriggerType;
  config?: Record<string, unknown>;
}

export interface PersonaWorkflowDraft {
  nodes: PersonaWorkflowNode[];
  edges: PersonaWorkflowEdge[];
  /** Singular — a draft has at most one trigger, not an array of them. */
  trigger?: PersonaWorkflowTrigger;
}

export interface PersonaWorkflow {
  _id: string;
  domain?: string;
  projectId?: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  visibility: PersonaWorkflowVisibility;
  ownerType: PersonaWorkflowOwnerType;
  externalOwnerId?: string | null;
  draft: PersonaWorkflowDraft;
  /** `0` until `publish()` has been called at least once. */
  publishedVersion: number;
  activeRuns: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaAgentSnapshot {
  modelName: string;
  systemPrompt: string;
  tools?: string[];
}

/** A published, immutable snapshot of a workflow's draft — what `stream()` actually executes. */
export interface PersonaWorkflowVersion {
  _id: string;
  workflowId: string;
  projectId: string;
  version: number;
  definition: PersonaWorkflowDraft;
  agentSnapshots?: Record<string, PersonaAgentSnapshot>;
  publishedBy?: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type PersonaWorkflowRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type PersonaNodeRunStatus = "running" | "completed" | "failed" | "skipped" | "paused";

/** One node's persisted run record, as returned by the REST API after the fact — distinct from `PersonaNodeRunState` below, which is the *live*, client-derived state `useWorkflowStream` builds up from AG-UI events while a run is still in progress. */
export interface PersonaNodeRun {
  nodeId: string;
  nodeType: string;
  status: PersonaNodeRunStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  retriesTaken: number;
  durationMs: number;
  tokens: number;
  startedAt: string;
  endedAt?: string;
}

export interface PersonaWorkflowUsage {
  totalTokens: number;
  agentTurns: number;
  toolCalls: number;
  creditsDeducted: number;
}

export interface PersonaWorkflowRun {
  _id: string;
  workflowId: string;
  workflowVersion: number;
  projectId: string;
  triggeredBy: {
    type: PersonaWorkflowTriggerType;
    userId?: string;
    details?: unknown;
  };
  status: PersonaWorkflowRunStatus;
  isDryRun: boolean;
  nodeRuns: PersonaNodeRun[];
  pendingApproval?: {
    nodeId?: string;
    prompt?: string;
    options?: string[];
    requestedAt?: string;
  };
  output?: unknown;
  usage?: PersonaWorkflowUsage;
  threadId: string;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Live, client-derived state for one node during an in-progress
 * `useWorkflowStream` run — built up from `workflow_node_started`/
 * `_completed`/`_failed` AG-UI events, not fetched from the REST API. See
 * `PersonaNodeRun` for the persisted record `useWorkflowRuns`/`getRun`
 * return once a run has actually finished.
 */
export interface PersonaNodeRunState {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: "idle" | "running" | "completed" | "failed";
  startedAt?: string;
  finishedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface CreatePersonaWorkflowInput {
  name: string;
  description?: string;
  visibility?: PersonaWorkflowVisibility;
  isEnabled?: boolean;
  draft?: PersonaWorkflowDraft;
}

/** All fields optional — only what you pass is changed. */
export interface UpdatePersonaWorkflowInput {
  name?: string;
  description?: string;
  visibility?: PersonaWorkflowVisibility;
  isEnabled?: boolean;
  draft?: PersonaWorkflowDraft;
}

export interface UseWorkflowsOptions {
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  /** Free-text match against name/description. */
  search?: string;
  /** @default 'all' for a ProjectMachine/Admin caller; 'public' for a ProjectRuntime caller without this set. */
  scope?: "mine" | "public" | "all";
  visibility?: PersonaWorkflowVisibility;
  isEnabled?: boolean;
}

export interface UseWorkflowOptions {
  autoFetch?: boolean;
}

export interface UseWorkflowStreamOptions {
  workflowId?: string;
  onNodeStarted?: (node: {
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    input?: unknown;
  }) => void;
  onNodeCompleted?: (node: { nodeId: string; output: unknown }) => void;
  onNodeFailed?: (node: { nodeId: string; error: string }) => void;
  onFinish?: (result: {
    runId: string;
    output: unknown;
    text: string;
  }) => void;
  onError?: (error: Error) => void;
  onEvent?: (event: PersonaStreamingEvent) => void;
}

export interface UseWorkflowStreamResult {
  runId: string | null;
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  isRunning: boolean;
  activeNodeId: string | null;
  nodeRuns: Record<string, PersonaNodeRunState>;
  text: string;
  output: unknown;
  error: Error | null;
  events: PersonaStreamingEvent[];
  start: (
    input?: unknown,
    options?: { dryRun?: boolean; workflowId?: string },
  ) => Promise<unknown>;
  cancel: () => Promise<void>;
  resume: (runId: string, sinceSeq?: number) => Promise<void>;
  reset: () => void;
}

export interface UseWorkflowRunsOptions {
  autoFetch?: boolean;
  page?: number;
  limit?: number;
}

// ---- Self-serve resource CRUD (Agent/Workflow/MCP/RCP Source/Knowledge
// Base/Skill can all be owned by the asserted external user, not just the
// Project — see each resource's own hook for which capability flag gates
// it server-side, e.g. `capabilities.skills` for Skills below) ----------

/** Shared list envelope every Developer Platform discovery endpoint uses (Agents/Skills/Knowledge/MCP/Threads/Files). */
export interface PersonaPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** `{ deleted, failed }` from a `POST .../bulk-delete` — a best-effort batch, not all-or-nothing; check `failed` for per-id reasons. */
export interface PersonaBulkDeleteResult {
  deleted: string[];
  failed: Array<{ id: string; reason: string }>;
}

/** A file bundled with a Skill (e.g. a reference doc or script an Agent can read). */
export interface PersonaSkillFile {
  path: string;
  content: string;
  mimeType?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonaSkill {
  _id: string;
  domain: string;
  ownerType: "PersonaUser" | "Project" | "ExternalUser";
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description: string;
  instructions: string;
  files: PersonaSkillFile[];
  /** Visible to every credential in the platform when `true`, not just this Domain. */
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present only on a single `getSkill()` read — whether the calling identity owns this Skill. */
  isOwner?: boolean;
}

export interface CreatePersonaSkillInput {
  name: string;
  description: string;
  /** The actual prompt text given to an Agent that has this Skill attached. */
  instructions: string;
  /** @default false */
  isPublic?: boolean;
  files?: Array<{ path: string; content: string; mimeType?: string }>;
}

/** All fields optional — only what you pass is changed. */
export interface UpdatePersonaSkillInput {
  name?: string;
  description?: string;
  instructions?: string;
  isPublic?: boolean;
  /** Replaces the entire `files` array — not a merge/append. */
  files?: Array<{ path: string; content: string; mimeType?: string }>;
}

/** Agents referencing a Skill — check before deleting it to avoid a blocked-delete error. */
export interface PersonaSkillUsage {
  /** The real total — `agents` below is a preview capped at 20. */
  agentCount: number;
  agents: Array<{ _id: string; name: string }>;
}

export interface UseSkillsOptions {
  /** @default true */
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  /** Free-text match against name/description. */
  search?: string;
  /** Restricts to the asserted external user's own Skills. Requires a `ProjectRuntimeContext` (i.e. `PersonaProvider` talking through an adapter with `resolveUserFrom`/`resolveUser`) — a no-op otherwise. */
  scope?: "mine";
}

export interface PersonaAgentSocialLinks {
  website?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
}

/** `unlisted` is reachable by direct link/id but excluded from public discovery listings. */
export type PersonaAgentVisibility = "private" | "unlisted" | "public";
export type PersonaAgentCategory =
  | "productivity"
  | "coding"
  | "creative"
  | "research"
  | "roleplay"
  | "other";

/**
 * Mirrors the real wire shape (`_id`, raw domain/ownerType fields) —
 * `getAgent()` returns `skills`/`mcps`/`knowledgeBases` populated as
 * objects, while `createAgent()`/`updateAgent()`/`agents` (from the list)
 * return them as bare id strings; typed loosely (`unknown[]`) to reflect
 * that real difference rather than picking one shape and being wrong for
 * the other calls.
 */
export interface PersonaAgent {
  _id: string;
  domain: string;
  ownerType: "PersonaUser" | "Project" | "ExternalUser";
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  /** URL-safe, unique within the Domain; used in some public-facing routes. */
  slug: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  /** Short one-liner shown in list/card views. */
  tagline?: string;
  /** Longer free-text bio shown on the Agent's own profile view. */
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: PersonaAgentSocialLinks;
  /** Stripped from the response when the calling identity doesn't own this Agent. */
  systemPrompt?: string;
  /** Stripped from the response when the calling identity doesn't own this Agent. */
  providerId?: string;
  /** Overrides the referenced Provider's `defaultModel` when set. */
  modelName?: string;
  webSearchEnabled: boolean;
  /** Real shell execution in an isolated CodeSandbox VM — requires a `CSB_API_KEY` Project Secret to already exist. */
  sandboxEnabled: boolean;
  visibility: PersonaAgentVisibility;
  category: PersonaAgentCategory;
  skills?: unknown[];
  mcps?: unknown[];
  knowledgeBases?: unknown[];
  storeMounts?: unknown[];
  /** Maps a tool name to whether calling it pauses the run for human approval. */
  interruptOn?: Record<string, boolean>;
  isActive: boolean;
  /** Whether this is the Project's designated default/primary Agent. */
  isMainAgent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaAgentInput {
  name: string;
  /** The instructions that define this Agent's behavior/persona. */
  systemPrompt: string;
  /** Must reference a Provider the host Project already created. */
  providerId: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  tagline?: string;
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: PersonaAgentSocialLinks;
  modelName?: string;
  /** @default false */
  webSearchEnabled?: boolean;
  /** @default false */
  sandboxEnabled?: boolean;
  /** @default 'private' */
  visibility?: PersonaAgentVisibility;
  /** @default 'other' */
  category?: PersonaAgentCategory;
  /** Skill ids to attach at creation time. */
  skills?: string[];
  /** MCP server ids to attach at creation time. */
  mcps?: string[];
  /** Knowledge base ids to attach at creation time. */
  knowledgeBases?: string[];
  /** Store ids to mount at creation time. */
  storeMounts?: string[];
  interruptOn?: Record<string, boolean>;
  /** @default true */
  isActive?: boolean;
}

/** All fields optional — only what you pass is changed; array/map fields replace the whole value, not a merge/append. */
export interface UpdatePersonaAgentInput {
  name?: string;
  description?: string;
  avatar?: string;
  tags?: string[];
  tagline?: string;
  bio?: string;
  personalityTraits?: string[];
  socialLinks?: PersonaAgentSocialLinks;
  systemPrompt?: string;
  providerId?: string;
  modelName?: string;
  webSearchEnabled?: boolean;
  sandboxEnabled?: boolean;
  skills?: string[];
  mcps?: string[];
  knowledgeBases?: string[];
  storeMounts?: string[];
  interruptOn?: Record<string, boolean>;
  visibility?: PersonaAgentVisibility;
  category?: PersonaAgentCategory;
  isActive?: boolean;
}

export interface UseAgentsOptions {
  /** @default true */
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  /** Free-text match against name/description/tagline. */
  search?: string;
  category?: PersonaAgentCategory;
  /** Restricts to the asserted external user's own Agents. Requires a `ProjectRuntimeContext` — a no-op otherwise. */
  scope?: "mine";
}

export interface PersonaRcpSourceToolParamSummary {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

/** A display cache only, written by `testRcpSourceConnection` — Agent execution discovers tools live via `rcp-sdk`, never reads this. */
export interface PersonaRcpSourceToolSummary {
  name: string;
  description: string;
  method: string;
  url: string;
  /** Every param this tool exposes (never resolver-filtered) — needed client-side to build `paramContextMap`. */
  params: PersonaRcpSourceToolParamSummary[];
}

/** Maps one of this source's tool param names to a key sent in a message's per-turn `context` — see `SendMessageOverride.context`. Shared across every Agent this source is attached to, not per-attachment. */
export interface PersonaRcpParamContextMapEntry {
  param: string;
  contextKey: string;
}

/** A hosted RCP (REST Connector Protocol, npm `rcp-sdk`) manifest URL Persona discovers tools from live on every Agent run. */
export interface PersonaRcpSource {
  _id: string;
  domain: string;
  ownerType: "PersonaUser" | "Project" | "ExternalUser";
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description: string;
  /** `GET url` must return a conformant `{ rcpVersion, auth, tools[] }` manifest. */
  url: string;
  authType: "none" | "header";
  /** A Project Secret id — present only when `authType` is `'header'`. Never returns the secret's plaintext value. */
  secretRef?: string | null;
  isEnabled: boolean;
  lastTestedAt?: string | null;
  tools: PersonaRcpSourceToolSummary[];
  paramContextMap: PersonaRcpParamContextMapEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaRcpSourceInput {
  name: string;
  description?: string;
  url: string;
  /** @default 'none' */
  authType?: "none" | "header";
  /** A Project Secret id. Required when `authType` is `'header'`. */
  secretRef?: string;
  /** @default true */
  isEnabled?: boolean;
  paramContextMap?: PersonaRcpParamContextMapEntry[];
}

/** All fields optional — only what you pass is changed. */
export interface UpdatePersonaRcpSourceInput {
  name?: string;
  description?: string;
  url?: string;
  authType?: "none" | "header";
  secretRef?: string | null;
  isEnabled?: boolean;
  paramContextMap?: PersonaRcpParamContextMapEntry[];
}

/** From `testConnection()` — discovers the source's manifest live and persists it as the new display cache. */
export interface PersonaRcpSourceTestResult {
  tools: PersonaRcpSourceToolSummary[];
}

export interface UseRcpSourcesOptions {
  /** @default true */
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  /** Free-text match against name. */
  search?: string;
}

/** One uploaded source document's chunking summary (not the chunks themselves). */
export interface PersonaKnowledgeDocument {
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkCount: number;
  uploadedAt: string;
}

export interface PersonaKnowledgeBase {
  _id: string;
  domain: string;
  ownerType: "PersonaUser" | "Project" | "ExternalUser";
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description?: string;
  isPublic: boolean;
  documentCount: number;
  chunkCount: number;
  /** Internal vector-store collection name backing this Knowledge Base — informational only. */
  qdrantCollectionName: string;
  documents: PersonaKnowledgeDocument[];
  embeddingModel: string;
  providerId?: string;
  /** Characters per chunk, used when splitting uploaded documents. */
  chunkSize: number;
  /** Character overlap between adjacent chunks. */
  chunkOverlap: number;
  /** Default number of chunks returned per `search()` call when the caller doesn't override `topK`. */
  topK: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonaKnowledgeBaseInput {
  name: string;
  description?: string;
  /** @default false */
  isPublic?: boolean;
  /** @default 'text-embedding-3-small' */
  embeddingModel?: string;
  /** Must reference a Provider the host Project already created. */
  providerId: string;
  /** @default 800 */
  chunkSize?: number;
  /** @default 100 */
  chunkOverlap?: number;
  /** @default 5 */
  topK?: number;
}

/** All fields optional — only what you pass is changed. Does not retroactively re-embed existing documents. */
export interface UpdatePersonaKnowledgeBaseInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  embeddingModel?: string;
  providerId?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
}

export interface PersonaUploadDocumentsResult {
  /** Total document count for the Knowledge Base after this upload (not just this call's files). */
  documentCount: number;
  /** Total chunk count for the Knowledge Base after this upload. */
  chunkCount: number;
  files: Array<{ fileName: string; fileSize: number; mimeType: string; chunkCount: number }>;
}

export interface PersonaDeleteDocumentResult {
  removedChunks: number;
  remainingDocuments: number;
  remainingChunks: number;
}

export interface PersonaKnowledgeSearchResult {
  text: string;
  /** The `fileName` of the source document this chunk came from. */
  source: string;
  /** Similarity score (higher is more relevant); `null` if the underlying store didn't return one. */
  score: number | null;
}

/** Agents referencing a Knowledge Base — check before deleting it to avoid a blocked-delete error. */
export interface PersonaKnowledgeBaseUsage {
  agentCount: number;
  agents: Array<{ _id: string; name: string }>;
}

export interface UseKnowledgeBasesOptions {
  /** @default true */
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  /** Free-text match against name/description. */
  search?: string;
  /** Restricts to the asserted external user's own Knowledge Bases. Requires a `ProjectRuntimeContext` — a no-op otherwise. */
  scope?: "mine";
}

export type PersonaMcpTransport = "http" | "sse";
export type PersonaMcpAuthType = "none" | "oauth" | "apiKey";
/** `owner`: one shared connection for the whole MCP. `user`: each external user connects their own. */
export type PersonaMcpAuthMode = "owner" | "user";

export interface PersonaMcpTool {
  name: string;
  description: string;
}

export interface PersonaMcpResourceSummary {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/** A resource whose `uri` has placeholder params to fill before calling `readResource()`. */
export interface PersonaMcpResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
  toolName: string;
}

export interface PersonaMcpOAuthConfig {
  clientId: string | null;
  hasClientSecret: boolean;
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  scopes: string[];
  dynamicallyRegistered: boolean;
  /** Whether this MCP's owner has completed the owner-mode OAuth flow. */
  ownerConnected: boolean;
}

/** Your own MCP server connection — a self-serve tool endpoint you registered, not one of the Project's shared ones (see `useMcp`/`useMcpConnections` for those). */
export interface PersonaMcp {
  _id: string;
  domain: string;
  ownerType: "PersonaUser" | "Project" | "ExternalUser";
  ownerId?: string;
  externalOwnerId?: string;
  name: string;
  description?: string;
  transport: PersonaMcpTransport;
  url: string;
  authType: PersonaMcpAuthType;
  authMode: PersonaMcpAuthMode;
  hasApiKey: boolean;
  oauth?: PersonaMcpOAuthConfig;
  isEnabled: boolean;
  /** Populated by `testConnection()`; empty until it's been called at least once. */
  tools: PersonaMcpTool[];
  resources: PersonaMcpResourceSummary[];
  resourceTemplates: PersonaMcpResourceTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonaMcpOAuthInput {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

export interface CreatePersonaMcpInput {
  name: string;
  transport: PersonaMcpTransport;
  url: string;
  description?: string;
  /** @default 'none' */
  authType?: PersonaMcpAuthType;
  /** @default 'owner' */
  authMode?: PersonaMcpAuthMode;
  /** Required when `authType: 'oauth'` and `useDynamicRegistration` isn't set. */
  oauth?: PersonaMcpOAuthInput;
  /** Required when `authType: 'apiKey'`. */
  apiKey?: string;
  /** Use RFC 7591 Dynamic Client Registration instead of a manually-configured `oauth` block. @default false */
  useDynamicRegistration?: boolean;
  /** @default true */
  isEnabled?: boolean;
}

/** All fields optional — only what you pass is changed. */
export interface UpdatePersonaMcpInput {
  name?: string;
  description?: string;
  transport?: PersonaMcpTransport;
  url?: string;
  authType?: PersonaMcpAuthType;
  authMode?: PersonaMcpAuthMode;
  isEnabled?: boolean;
  useDynamicRegistration?: boolean;
  oauth?: Partial<PersonaMcpOAuthInput>;
  /** Replaces the stored key entirely; omit to leave the existing key untouched. */
  apiKey?: string;
}

export interface PersonaMcpTestConnectionResult {
  tools: PersonaMcpTool[];
  resources: PersonaMcpResourceSummary[];
  resourceTemplates: PersonaMcpResourceTemplate[];
}

export interface UseMcpAdminOptions {
  /** @default true */
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  /** Free-text match against name/description. */
  search?: string;
}

