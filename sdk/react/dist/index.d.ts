import * as react from 'react';
import react__default, { ReactNode } from 'react';
import { LogLevel, Logger } from '@personaai/logger';
export { CreateLoggerOptions, LogLevel, LogTransport, Logger, createLogger, createNoopLogger, getLogLevel, isLevelEnabled, setLogLevel } from '@personaai/logger';

type PersonaRole = "user" | "assistant" | "system" | "reasoning";
/**
 * A reasoning (chain-of-thought) message, streamed ahead of the assistant's
 * answer. Each provider reasoning phase is its OWN message — the SDK never
 * merges phases together, matching how the web timeline renders them as
 * separate "Thoughts" bubbles. `content` holds the accumulated reasoning text.
 */
/** One live update on a running `task` (subagent) tool call's timeline. */
interface PersonaSubagentActivityEntry {
    kind: "text" | "tool_start" | "tool_result";
    toolName?: string;
    args?: string;
    result?: string;
    delta?: string;
}
interface PersonaToolCall {
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
    mcpApp?: {
        resourceUri: string;
        mcpId: string;
    };
}
interface PersonaMessage {
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
interface PersonaHitlActionRequest {
    name: string;
    args?: unknown;
}
interface PersonaClarificationQuestion {
    id: string;
    text: string;
    options: string[];
    required: boolean;
    allowCustom: boolean;
}
/** A paused human-in-the-loop tool approval, or a paused clarification question. */
type PersonaInterrupt = {
    kind: "hitl";
    actionRequests: PersonaHitlActionRequest[];
    reviewConfigs: unknown[];
} | {
    kind: "clarification";
    questions: PersonaClarificationQuestion[];
};
/** What to send back in `sendMessage(content, { resume })` to unpause a paused run. */
type PersonaResumeValue = {
    decisions: Array<{
        type: "approve" | "reject";
        message?: string;
    }>;
} | {
    answers: unknown[];
    text?: string;
};
/**
 * A file in the agent's own virtual workspace (deepagents' state-backed
 * filesystem — `write_file`/`read_file` tool calls, distinct from
 * `PersonaFileItem` uploads). Populated from `STATE_SNAPSHOT` events, or
 * from a reloaded thread's persisted state.
 */
interface PersonaWorkspaceFile {
    content: string;
    size: number;
    createdAt: string | null;
    modifiedAt: string | null;
}
interface PersonaTodo {
    content: string;
    status: string;
}
/** Set when the agent calls `present_file` to highlight a workspace file. */
interface PersonaPresentedFile {
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
interface PersonaSandboxCommand {
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
interface PersonaProviderProps {
    /** Base URL where the Persona runtime / adapter is mounted, e.g. "http://localhost:4000/api/persona" */
    baseUrl: string;
    /** Async or sync getter for the user's Bearer JWT authentication token */
    getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
    /** Default Agent ID to direct chat conversations to */
    defaultAgentId?: string;
    /** Log level for the React SDK — off by default. */
    logLevel?: LogLevel;
    /** Custom logger instance — when provided, `logLevel` is ignored. */
    logger?: Logger;
    children: ReactNode;
}
interface PersonaThread {
    _id: string;
    /** A bare id string on create()/get(); populated as an object on list(). */
    agentId: string | {
        _id: string;
        name: string;
        avatar?: string;
        slug: string;
    };
    title?: string;
    isArchived?: boolean;
    createdAt: string;
    updatedAt: string;
}
/** Mirrors the wire shape of `GET/POST /files` — `id`, not `_id`. */
interface PersonaFileItem {
    id: string;
    originalName: string;
    mimeType: string;
    /** Bytes. */
    size: number;
    agentId: string | null;
    threadId: string | null;
    createdAt: string;
}
interface PersonaMemoryFile {
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
interface PersonaMemoryAgentGroup {
    agentId: string;
    /** `null` if the agent no longer exists. */
    agentName: string | null;
    files: PersonaMemoryFile[];
}
interface PersonaMemoryList {
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
type PersonaStreamingEvent = {
    type: "RUN_STARTED";
    threadId?: string;
    runId?: string;
} | {
    type: "RUN_FINISHED";
} | {
    type: "TEXT_MESSAGE_CHUNK";
    delta: string;
    messageId?: string;
    role?: "assistant";
} | {
    type: "TOOL_CALL_CHUNK";
    toolCallId?: string;
    toolCallName?: string;
    delta?: string;
    parentMessageId?: string;
} | {
    type: "TOOL_CALL_RESULT";
    toolCallId: string;
    content: string;
    messageId?: string;
    role?: "tool";
    structuredContent?: unknown;
} | {
    type: "REASONING_MESSAGE_START";
    messageId: string;
} | {
    type: "REASONING_MESSAGE_CONTENT";
    messageId: string;
    delta: string;
} | {
    type: "REASONING_END";
} | {
    type: "STATE_SNAPSHOT";
    /** Raw wire shape (snake_case timestamps) — useChat normalizes this into `files`/`todos`. */
    snapshot: {
        files: Record<string, {
            content: string;
            size: number;
            created_at: string | null;
            modified_at: string | null;
        }>;
        todos: PersonaTodo[];
    };
} | {
    type: "RUN_ERROR";
    code: string;
    message: string;
    retryable?: boolean;
    providerName?: string;
} | {
    type: "title";
    title: string;
} | {
    type: "CUSTOM";
    name: "hitl_request";
    value: {
        actionRequests: PersonaHitlActionRequest[];
        reviewConfigs: unknown[];
    };
} | {
    type: "CUSTOM";
    name: "clarification_request";
    value: {
        questions: PersonaClarificationQuestion[];
        currentIndex: number;
    };
} | {
    type: "CUSTOM";
    name: "subagent_activity";
    value: {
        toolCallId: string;
    } & PersonaSubagentActivityEntry;
} | {
    type: "CUSTOM";
    name: "mcp_app";
    value: {
        toolCallId: string;
        resourceUri: string;
        mcpId: string;
    };
} | {
    type: "CUSTOM";
    name: "workflow_node_started";
    value: {
        nodeId: string;
        nodeType: string;
        nodeLabel: string;
        input?: unknown;
    };
} | {
    type: "CUSTOM";
    name: "workflow_node_completed";
    value: {
        nodeId: string;
        output: unknown;
    };
} | {
    type: "CUSTOM";
    name: "workflow_node_failed";
    value: {
        nodeId: string;
        error: string;
    };
} | {
    type: "CUSTOM";
    name: string & {};
    value: unknown;
};
interface UseChatOptions {
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
interface UseArchitectChatOptions {
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
interface SendArchitectMessageOverride {
    /**
     * A plain id, or a promise/thunk for one still in flight (e.g. a thread
     * being lazily created for the first message of a new conversation).
     * Mirrors {@link SendMessageOverride.threadId}.
     */
    threadId?: string | Promise<string | undefined>;
    /** Answers/approves a paused interrupt from a previous turn instead of starting a fresh one. */
    resume?: PersonaResumeValue;
}
interface SendMessageOverride {
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
/**
 * `useVoice`'s call state, driven by `voice_activity` events from the
 * server (never guessed client-side). `'idle'` before `start()` and again
 * after a clean `stop()`; `'ended'` after the server itself closed the
 * session (see {@link PersonaVoiceEndReason}).
 */
type PersonaVoiceState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error" | "ended";
/** A committed transcript line. See `partial` on {@link UseVoiceResult} for the in-progress one. */
interface PersonaVoiceTranscriptLine {
    id: string;
    speaker: "user" | "agent";
    text: string;
}
interface PersonaVoiceToolCall {
    id: string;
    name?: string;
    status: "running" | "done" | "error";
    /** Tool output (success) or error message — whichever applies. */
    summary?: string;
}
/** Why a voice session ended — the terminal `voice_session_ended` event's `reason`. */
type PersonaVoiceEndReason = "client_closed" | "agent_ended" | "max_duration" | "idle" | "upstream_error" | "upstream_goaway";
interface UseVoiceOptions {
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
interface UseVoiceResult {
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
type PersonaWorkflowNodeType = "trigger" | "agentStep" | "knowledgeStep" | "toolStep" | "condition" | "approval" | "parallel" | "join" | "output";
type PersonaWorkflowTriggerType = "manual" | "api" | "webhook" | "schedule" | "chat";
type PersonaWorkflowVisibility = "private" | "unlisted" | "public";
type PersonaWorkflowOwnerType = "Project" | "ExternalUser";
type PersonaNodeOnErrorAction = "fail" | "continue" | "routeError";
interface PersonaNodeRetryPolicy {
    maxRetries?: number;
    backoffMs?: number;
    exponential?: boolean;
}
interface PersonaWorkflowNodeData {
    label: string;
    description?: string;
    config?: Record<string, unknown>;
    retryPolicy?: PersonaNodeRetryPolicy;
    onError?: PersonaNodeOnErrorAction;
}
interface PersonaWorkflowNode {
    id: string;
    type: PersonaWorkflowNodeType;
    position?: {
        x: number;
        y: number;
    };
    data: PersonaWorkflowNodeData;
}
interface PersonaWorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    condition?: unknown;
    conditionValue?: string;
}
interface PersonaWorkflowTrigger {
    type: PersonaWorkflowTriggerType;
    config?: Record<string, unknown>;
}
interface PersonaWorkflowDraft {
    nodes: PersonaWorkflowNode[];
    edges: PersonaWorkflowEdge[];
    /** Singular — a draft has at most one trigger, not an array of them. */
    trigger?: PersonaWorkflowTrigger;
}
interface PersonaWorkflow {
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
interface PersonaAgentSnapshot {
    modelName: string;
    systemPrompt: string;
    tools?: string[];
}
/** A published, immutable snapshot of a workflow's draft — what `stream()` actually executes. */
interface PersonaWorkflowVersion {
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
type PersonaWorkflowRunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
type PersonaNodeRunStatus = "running" | "completed" | "failed" | "skipped" | "paused";
/** One node's persisted run record, as returned by the REST API after the fact — distinct from `PersonaNodeRunState` below, which is the *live*, client-derived state `useWorkflowStream` builds up from AG-UI events while a run is still in progress. */
interface PersonaNodeRun {
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
interface PersonaWorkflowUsage {
    totalTokens: number;
    agentTurns: number;
    toolCalls: number;
    creditsDeducted: number;
}
interface PersonaWorkflowRun {
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
interface PersonaNodeRunState {
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
interface CreatePersonaWorkflowInput {
    name: string;
    description?: string;
    visibility?: PersonaWorkflowVisibility;
    isEnabled?: boolean;
    draft?: PersonaWorkflowDraft;
}
/** All fields optional — only what you pass is changed. */
interface UpdatePersonaWorkflowInput {
    name?: string;
    description?: string;
    visibility?: PersonaWorkflowVisibility;
    isEnabled?: boolean;
    draft?: PersonaWorkflowDraft;
}
interface UseWorkflowsOptions {
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
interface UseWorkflowOptions {
    autoFetch?: boolean;
}
interface UseWorkflowStreamOptions {
    workflowId?: string;
    onNodeStarted?: (node: {
        nodeId: string;
        nodeType: string;
        nodeLabel: string;
        input?: unknown;
    }) => void;
    onNodeCompleted?: (node: {
        nodeId: string;
        output: unknown;
    }) => void;
    onNodeFailed?: (node: {
        nodeId: string;
        error: string;
    }) => void;
    onFinish?: (result: {
        runId: string;
        output: unknown;
        text: string;
    }) => void;
    onError?: (error: Error) => void;
    onEvent?: (event: PersonaStreamingEvent) => void;
}
interface UseWorkflowStreamResult {
    runId: string | null;
    status: "idle" | "running" | "completed" | "failed" | "cancelled";
    isRunning: boolean;
    activeNodeId: string | null;
    nodeRuns: Record<string, PersonaNodeRunState>;
    text: string;
    output: unknown;
    error: Error | null;
    events: PersonaStreamingEvent[];
    start: (input?: unknown, options?: {
        dryRun?: boolean;
        workflowId?: string;
    }) => Promise<unknown>;
    cancel: () => Promise<void>;
    resume: (runId: string, sinceSeq?: number) => Promise<void>;
    reset: () => void;
}
interface UseWorkflowRunsOptions {
    autoFetch?: boolean;
    page?: number;
    limit?: number;
}
/** Shared list envelope every Developer Platform discovery endpoint uses (Agents/Skills/Knowledge/MCP/Threads/Files). */
interface PersonaPagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}
/** `{ deleted, failed }` from a `POST .../bulk-delete` — a best-effort batch, not all-or-nothing; check `failed` for per-id reasons. */
interface PersonaBulkDeleteResult {
    deleted: string[];
    failed: Array<{
        id: string;
        reason: string;
    }>;
}
/** A file bundled with a Skill (e.g. a reference doc or script an Agent can read). */
interface PersonaSkillFile {
    path: string;
    content: string;
    mimeType?: string;
    createdAt?: string;
    updatedAt?: string;
}
interface PersonaSkill {
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
interface CreatePersonaSkillInput {
    name: string;
    description: string;
    /** The actual prompt text given to an Agent that has this Skill attached. */
    instructions: string;
    /** @default false */
    isPublic?: boolean;
    files?: Array<{
        path: string;
        content: string;
        mimeType?: string;
    }>;
}
/** All fields optional — only what you pass is changed. */
interface UpdatePersonaSkillInput {
    name?: string;
    description?: string;
    instructions?: string;
    isPublic?: boolean;
    /** Replaces the entire `files` array — not a merge/append. */
    files?: Array<{
        path: string;
        content: string;
        mimeType?: string;
    }>;
}
/** Agents referencing a Skill — check before deleting it to avoid a blocked-delete error. */
interface PersonaSkillUsage {
    /** The real total — `agents` below is a preview capped at 20. */
    agentCount: number;
    agents: Array<{
        _id: string;
        name: string;
    }>;
}
interface UseSkillsOptions {
    /** @default true */
    autoFetch?: boolean;
    page?: number;
    limit?: number;
    /** Free-text match against name/description. */
    search?: string;
    /** Restricts to the asserted external user's own Skills. Requires a `ProjectRuntimeContext` (i.e. `PersonaProvider` talking through an adapter with `resolveUserFrom`/`resolveUser`) — a no-op otherwise. */
    scope?: "mine";
}
interface PersonaAgentSocialLinks {
    website?: string;
    twitter?: string;
    github?: string;
    linkedin?: string;
}
/** `unlisted` is reachable by direct link/id but excluded from public discovery listings. */
type PersonaAgentVisibility = "private" | "unlisted" | "public";
type PersonaAgentCategory = "productivity" | "coding" | "creative" | "research" | "roleplay" | "other";
/**
 * Mirrors the real wire shape (`_id`, raw domain/ownerType fields) —
 * `getAgent()` returns `skills`/`mcps`/`knowledgeBases` populated as
 * objects, while `createAgent()`/`updateAgent()`/`agents` (from the list)
 * return them as bare id strings; typed loosely (`unknown[]`) to reflect
 * that real difference rather than picking one shape and being wrong for
 * the other calls.
 */
interface PersonaAgent {
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
interface CreatePersonaAgentInput {
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
interface UpdatePersonaAgentInput {
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
interface UseAgentsOptions {
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
interface PersonaRcpSourceToolParamSummary {
    name: string;
    type: string;
    description: string;
    required: boolean;
}
/** A display cache only, written by `testRcpSourceConnection` — Agent execution discovers tools live via `rcp-sdk`, never reads this. */
interface PersonaRcpSourceToolSummary {
    name: string;
    description: string;
    method: string;
    url: string;
    /** Every param this tool exposes (never resolver-filtered) — needed client-side to build `paramContextMap`. */
    params: PersonaRcpSourceToolParamSummary[];
}
/** Maps one of this source's tool param names to a key sent in a message's per-turn `context` — see `SendMessageOverride.context`. Shared across every Agent this source is attached to, not per-attachment. */
interface PersonaRcpParamContextMapEntry {
    param: string;
    contextKey: string;
}
/** A hosted RCP (REST Connector Protocol, npm `rcp-sdk`) manifest URL Persona discovers tools from live on every Agent run. */
interface PersonaRcpSource {
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
interface CreatePersonaRcpSourceInput {
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
interface UpdatePersonaRcpSourceInput {
    name?: string;
    description?: string;
    url?: string;
    authType?: "none" | "header";
    secretRef?: string | null;
    isEnabled?: boolean;
    paramContextMap?: PersonaRcpParamContextMapEntry[];
}
/** From `testConnection()` — discovers the source's manifest live and persists it as the new display cache. */
interface PersonaRcpSourceTestResult {
    tools: PersonaRcpSourceToolSummary[];
}
interface UseRcpSourcesOptions {
    /** @default true */
    autoFetch?: boolean;
    page?: number;
    limit?: number;
    /** Free-text match against name. */
    search?: string;
}
/** One uploaded source document's chunking summary (not the chunks themselves). */
interface PersonaKnowledgeDocument {
    fileName: string;
    fileSize: number;
    mimeType: string;
    chunkCount: number;
    uploadedAt: string;
}
interface PersonaKnowledgeBase {
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
interface CreatePersonaKnowledgeBaseInput {
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
interface UpdatePersonaKnowledgeBaseInput {
    name?: string;
    description?: string;
    isPublic?: boolean;
    embeddingModel?: string;
    providerId?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    topK?: number;
}
interface PersonaUploadDocumentsResult {
    /** Total document count for the Knowledge Base after this upload (not just this call's files). */
    documentCount: number;
    /** Total chunk count for the Knowledge Base after this upload. */
    chunkCount: number;
    files: Array<{
        fileName: string;
        fileSize: number;
        mimeType: string;
        chunkCount: number;
    }>;
}
interface PersonaDeleteDocumentResult {
    removedChunks: number;
    remainingDocuments: number;
    remainingChunks: number;
}
interface PersonaKnowledgeSearchResult {
    text: string;
    /** The `fileName` of the source document this chunk came from. */
    source: string;
    /** Similarity score (higher is more relevant); `null` if the underlying store didn't return one. */
    score: number | null;
}
/** Agents referencing a Knowledge Base — check before deleting it to avoid a blocked-delete error. */
interface PersonaKnowledgeBaseUsage {
    agentCount: number;
    agents: Array<{
        _id: string;
        name: string;
    }>;
}
interface UseKnowledgeBasesOptions {
    /** @default true */
    autoFetch?: boolean;
    page?: number;
    limit?: number;
    /** Free-text match against name/description. */
    search?: string;
    /** Restricts to the asserted external user's own Knowledge Bases. Requires a `ProjectRuntimeContext` — a no-op otherwise. */
    scope?: "mine";
}
type PersonaMcpTransport = "http" | "sse";
type PersonaMcpAuthType = "none" | "oauth" | "apiKey";
/** `owner`: one shared connection for the whole MCP. `user`: each external user connects their own. */
type PersonaMcpAuthMode = "owner" | "user";
interface PersonaMcpTool {
    name: string;
    description: string;
}
interface PersonaMcpResourceSummary {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}
/** A resource whose `uri` has placeholder params to fill before calling `readResource()`. */
interface PersonaMcpResourceTemplate {
    uriTemplate: string;
    name: string;
    description: string;
    mimeType: string;
    toolName: string;
}
interface PersonaMcpOAuthConfig {
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
interface PersonaMcp {
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
interface PersonaMcpOAuthInput {
    clientId: string;
    clientSecret: string;
    scopes?: string[];
}
interface CreatePersonaMcpInput {
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
interface UpdatePersonaMcpInput {
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
interface PersonaMcpTestConnectionResult {
    tools: PersonaMcpTool[];
    resources: PersonaMcpResourceSummary[];
    resourceTemplates: PersonaMcpResourceTemplate[];
}
interface UseMcpAdminOptions {
    /** @default true */
    autoFetch?: boolean;
    page?: number;
    limit?: number;
    /** Free-text match against name/description. */
    search?: string;
}

interface PersonaContextValue {
    baseUrl: string;
    getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
    defaultAgentId?: string;
    fetchWithAuth: (path: string, init?: RequestInit) => Promise<Response>;
    logger: Logger;
}
declare function PersonaProvider({ baseUrl, getAuthToken, defaultAgentId, logLevel, logger: loggerProp, children, }: PersonaProviderProps): react__default.JSX.Element;
declare function usePersonaContext(): PersonaContextValue;

declare function useChat(options?: UseChatOptions): {
    messages: PersonaMessage[];
    input: string;
    setInput: react.Dispatch<react.SetStateAction<string>>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleSubmit: (e?: React.FormEvent) => void;
    sendMessage: (contentToSend?: string, overrideOptions?: SendMessageOverride) => Promise<boolean>;
    isStreaming: boolean;
    isLoading: boolean;
    isLoadingHistory: boolean;
    error: Error | null;
    interrupt: PersonaInterrupt | null;
    resumeInterrupt: (resume: PersonaResumeValue, displayContent: string) => Promise<boolean>;
    files: Record<string, PersonaWorkspaceFile>;
    todos: PersonaTodo[];
    presentedFile: PersonaPresentedFile | null;
    dismissPresentedFile: () => void;
    openWorkspaceFile: (path: string) => void;
    sandboxCommands: PersonaSandboxCommand[];
    stop: () => void;
    reload: () => Promise<boolean>;
    clear: () => void;
    startNewChat: () => void;
    currentThreadId: string | undefined;
    isEphemeral: boolean;
    setMessages: react.Dispatch<react.SetStateAction<PersonaMessage[]>>;
    loadThreadMessages: (id: string) => Promise<PersonaMessage[]>;
};

/**
 * The Developer Platform Architect's own reserved Agent id
 * (`DEVELOPER_ARCHITECT_AGENT_ID` in agent-backend/src/modules/agents/
 * architectConstants.js) — it isn't a row in the Agent collection, but the
 * backend's `POST /api/v1/developer/threads` special-cases exactly this id
 * past its usual Agent-existence check (see developerThread.controller.js's
 * `assertAgentAccessible`), so a named Architect Thread can be created the
 * same way as for a real Agent. Kept in sync with that backend constant —
 * update both together if it ever changes.
 */
declare const ARCHITECT_AGENT_ID = "000000000000000000000002";
/**
 * Runs the Agent Architect co-pilot — a conversational tool-calling agent
 * that creates/edits the caller's own Agents (`manage_agent`, `manage_skill`,
 * etc.), reached over the runtime's `POST /architect` route (see
 * `@personaai/runtime`'s `routes/architect.ts`). Structurally a trimmed
 * `useChat`: same streaming/interrupt/reload/thread-resume mechanics, but
 * with no `agentId` to pass (the Architect is a single fixed target) and no
 * `voice`/`sandboxCommands` (the Architect has no voice mode and no
 * `execute` tool).
 *
 * `threadId` resume only has an effect when the underlying credential
 * asserts an external user — a bare Project credential has no Subject for a
 * Thread to belong to, so the backend silently keeps its single
 * deterministic per-Project conversation either way (see
 * `developerArchitect.controller.js`'s doc comment).
 */
declare function useArchitectChat(options?: UseArchitectChatOptions): {
    messages: PersonaMessage[];
    input: string;
    setInput: react.Dispatch<react.SetStateAction<string>>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleSubmit: (e?: React.FormEvent) => void;
    sendMessage: (contentToSend?: string, overrideOptions?: SendArchitectMessageOverride) => Promise<boolean>;
    isStreaming: boolean;
    isLoading: boolean;
    isLoadingHistory: boolean;
    error: Error | null;
    interrupt: PersonaInterrupt | null;
    resumeInterrupt: (resume: PersonaResumeValue, displayContent: string) => Promise<boolean>;
    files: Record<string, PersonaWorkspaceFile>;
    todos: PersonaTodo[];
    presentedFile: PersonaPresentedFile | null;
    dismissPresentedFile: () => void;
    openWorkspaceFile: (path: string) => void;
    stop: () => void;
    reload: () => Promise<boolean>;
    clear: () => void;
    startNewChat: () => void;
    currentThreadId: string | undefined;
    isEphemeral: boolean;
    setMessages: react.Dispatch<react.SetStateAction<PersonaMessage[]>>;
    loadThreadMessages: (id: string) => Promise<PersonaMessage[]>;
};

declare function useMemory(autoFetch?: boolean): {
    memory: PersonaMemoryList;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaMemoryList>;
    getFile: (params: {
        path: string;
        scope?: "user" | "agent" | "workspace";
        agentId?: string;
    }) => Promise<PersonaMemoryFile>;
    writeFile: (params: {
        path: string;
        content: string;
        scope?: "user" | "agent" | "workspace";
        agentId?: string;
    }) => Promise<PersonaMemoryFile>;
    deleteFile: (params: {
        path: string;
        scope?: "user" | "agent" | "workspace";
        agentId?: string;
    }) => Promise<void>;
};

declare function useThreads(autoFetch?: boolean): {
    threads: PersonaThread[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaThread[]>;
    createThread: (agentId?: string) => Promise<PersonaThread>;
    deleteThread: (threadId: string) => Promise<void>;
    bulkDeleteThreads: (threadIds: string[]) => Promise<{
        deleted: string[];
        failed: Array<{
            id: string;
            reason: string;
        }>;
    }>;
    deleteAllThreads: () => Promise<void>;
    updateThread: (threadId: string, input: {
        title?: string;
        isArchived?: boolean;
    }) => Promise<PersonaThread>;
    renameThread: (threadId: string, title: string) => Promise<PersonaThread>;
    resetThread: (threadId: string) => Promise<PersonaThread>;
    getThread: (threadId: string) => Promise<PersonaThread>;
};

/**
 * CRUD over one Agent's `/workspace/` files — the SAME persistent store a
 * `write_file`/`read_file` tool call under `/workspace/...` actually reads
 * and writes (deepagents routes that path prefix to a Mongo-backed memory
 * store, NOT the LangGraph checkpoint's `files` state channel — a Thread's
 * live/checkpointed state is a different, much narrower thing that rarely
 * has anything in it, since agents are instructed to write all real output
 * under `/workspace/outputs/`). Scoped by Agent + Subject: shared across
 * every Thread that Subject has with that Agent, not private to one
 * conversation — the same model the platform's own Files panel uses.
 *
 * Thin wrapper over `client.memory` (`scope: "workspace"`) — no parallel
 * type vocabulary, `PersonaWorkspaceFile` here is just `PersonaMemoryFile`
 * reshaped to the `{content, size, createdAt, modifiedAt}` display shape
 * `useChat()`'s own (read-only, live-run) `files` snapshot already uses.
 */
declare function useWorkspaceFiles(agentId: string | undefined, autoFetch?: boolean): {
    files: Record<string, PersonaWorkspaceFile>;
    isLoading: boolean;
    isSaving: boolean;
    error: Error | null;
    refetch: () => Promise<Record<string, PersonaWorkspaceFile>>;
    getFile: (path: string) => Promise<PersonaWorkspaceFile>;
    writeFile: (path: string, content: string) => Promise<PersonaWorkspaceFile>;
    deleteFile: (path: string) => Promise<void>;
};

/**
 * Drives a real-time voice call with an Agent (powered by Gemini Live).
 *
 * Ticket minting goes through YOUR OWN backend (`POST /voice/sessions` on
 * whichever `@personaai/runtime`-based adapter you've mounted) via
 * `fetchWithAuth` — same as every other hook in this package. The actual
 * call does NOT: once a ticket comes back, this hook opens a WebSocket
 * DIRECTLY to Persona (`ticket.wsUrl`), bypassing your backend entirely for
 * the live audio. This is deliberate — see the package README's Voice
 * section for why (short version: a multi-minute relay would not survive
 * on a serverless deployment the way `POST /chat`'s bounded SSE relay
 * does), and it means your backend never has to become a WebSocket relay.
 *
 * Requires a browser with `AudioWorklet` support (all current evergreen
 * browsers). The processor code itself needs no `/public` file of your
 * own — it's embedded and loaded via a Blob URL (see `voiceWorklets.ts`).
 */
declare function useVoice(options?: UseVoiceOptions): UseVoiceResult;

declare function useFiles(autoFetch?: boolean): {
    files: PersonaFileItem[];
    isLoading: boolean;
    isUploading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaFileItem[]>;
    uploadFile: (fileOrFormData: FormData | {
        name: string;
        uri: string;
        type?: string;
    }) => Promise<PersonaFileItem>;
    deleteFile: (fileId: string) => Promise<void>;
    bulkDeleteFiles: (fileIds: string[]) => Promise<{
        deleted: string[];
        failed: Array<{
            id: string;
            reason: string;
        }>;
    }>;
    getDownloadUrl: (fileId: string) => string;
};

/**
 * Read-only discovery (`agents`) is always on. Create/update/delete/
 * bulk-delete/getAgent require the host's `createPersonaHandler`/
 * `createRuntime` to opt in with `capabilities: { agentsWrite: true }` —
 * every write route this hook calls 404s/is unreachable otherwise
 * (provisioning Agents is Project-level work the host must deliberately
 * turn on, not something a chat session gets by default).
 *
 * Ownership follows the same self-serve model as `useSkills`/`useWorkflows`:
 * pass `scope: 'mine'` to restrict `agents` to the asserted external user's
 * own Agents (only meaningful when `PersonaProvider` is wired through an
 * adapter that resolves a real end-user identity) — omit it to see every
 * Agent visible to this Project.
 */
declare function useAgents(options?: UseAgentsOptions | boolean): {
    agents: PersonaAgent[];
    pagination: PersonaPagination;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaAgent[]>;
    getAgent: (agentId: string) => Promise<PersonaAgent>;
    createAgent: (input: CreatePersonaAgentInput) => Promise<PersonaAgent>;
    updateAgent: (agentId: string, input: UpdatePersonaAgentInput) => Promise<PersonaAgent>;
    deleteAgent: (agentId: string) => Promise<void>;
    bulkDeleteAgents: (ids: string[]) => Promise<PersonaBulkDeleteResult>;
};

interface PersonaHealthInfo {
    status: string;
    version?: string;
    capabilities?: Record<string, boolean>;
}
declare function useConnection(autoCheck?: boolean): {
    isConnected: boolean;
    health: PersonaHealthInfo | null;
    isLoading: boolean;
    checkHealth: () => Promise<PersonaHealthInfo | null>;
};

/**
 * One `authType: 'oauth', authMode: 'user'` MCP an Agent has attached, and
 * whether the current end user has connected it yet. `authorizeUrl` is only
 * present when `connected` is `false` — navigate the browser there (a
 * same-tab redirect is fine; it's a real OAuth authorization URL) to start
 * the consent flow.
 */
interface PersonaMcpConnection {
    mcpId: string;
    name: string;
    description: string;
    connected: boolean;
    authorizeUrl: string | null;
}
interface UseMcpConnectionsOptions {
    /** @default the PersonaProvider's defaultAgentId */
    agentId?: string;
    /** Where the browser lands after OAuth consent completes. @default window.location.href */
    returnTo?: string;
    /** @default true */
    autoFetch?: boolean;
}
/**
 * Surfaces the gap that used to be invisible entirely: a user-mode MCP tool
 * call for a user who hasn't connected yet is silently dropped from the
 * Agent's toolset server-side, with no signal in the chat stream at all.
 * Check this before (or alongside) a chat session to show a real "Connect
 * your account" affordance instead of a capability that just quietly isn't
 * there.
 */
declare function useMcpConnections(options?: UseMcpConnectionsOptions): {
    connections: PersonaMcpConnection[];
    /** Convenience filter for the common "show a banner for what's missing" case. */
    unconnected: PersonaMcpConnection[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaMcpConnection[]>;
    disconnect: (mcpId: string) => Promise<void>;
    isDisconnecting: boolean;
};

interface UseMcpOptions {
    /** Default MCP server ID for resource reads and tool calls */
    mcpId?: string;
}
/**
 * Hook for interacting with MCP servers connected via the Persona runtime.
 * Provides helper functions for reading UI/data resources and calling server tools.
 */
declare function useMcp(options?: UseMcpOptions): {
    readResource: (uri: string, mcpId?: string) => Promise<any>;
    callTool: (name: string, args?: Record<string, unknown>, mcpId?: string) => Promise<any>;
};

/**
 * CRUD for Skills — a reusable instruction + optional file bundle an Agent
 * can be given. Requires the host's `createPersonaHandler`/`createRuntime`
 * to opt in with `capabilities: { skills: true }`; every route this hook
 * calls 404s/is unreachable otherwise (skill authoring is Project-level
 * content management the host must deliberately turn on, not something a
 * chat session gets by default).
 *
 * Ownership follows the same self-serve model as `useAgents`/`useWorkflows`:
 * pass `scope: 'mine'` to restrict `skills` to the asserted external user's
 * own Skills (only meaningful when `PersonaProvider` is wired through an
 * adapter that resolves a real end-user identity) — omit it to see every
 * Skill visible to this Project (its own, plus public ones).
 */
declare function useSkills(options?: UseSkillsOptions): {
    skills: PersonaSkill[];
    pagination: PersonaPagination;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaSkill[]>;
    getSkill: (skillId: string) => Promise<PersonaSkill>;
    createSkill: (input: CreatePersonaSkillInput) => Promise<PersonaSkill>;
    updateSkill: (skillId: string, input: UpdatePersonaSkillInput) => Promise<PersonaSkill>;
    deleteSkill: (skillId: string) => Promise<void>;
    bulkDeleteSkills: (ids: string[]) => Promise<PersonaBulkDeleteResult>;
    getSkillUsage: (skillId: string) => Promise<PersonaSkillUsage>;
};

interface PersonaResourceUsage {
    /** The real total — `agents` below is a preview capped at 20. */
    agentCount: number;
    agents: Array<{
        _id: string;
        name: string;
    }>;
}
/**
 * CRUD for RCP (REST Connector Protocol, npm `rcp-sdk`) sources — a hosted
 * manifest URL Persona discovers tools from live on every Agent run.
 * Requires the host's `createPersonaHandler`/`createRuntime` to opt in with
 * `capabilities: { rcpSources: true }`; every route this hook calls
 * 404s/is unreachable otherwise.
 *
 * Ownership follows the same self-serve model as `useSkills`/`useAgents`:
 * an RCP source can be owned by the Project or by the asserted external
 * user — but unlike Skills there's no `isPublic` concept here, so
 * `getRcpSource`/list only ever return sources the calling identity
 * actually owns (no server-side `scope: 'mine'` filter needed or
 * supported — every visible source already is "mine").
 */
declare function useRcpSources(options?: UseRcpSourcesOptions): {
    rcpSources: PersonaRcpSource[];
    pagination: PersonaPagination;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaRcpSource[]>;
    getRcpSource: (sourceId: string) => Promise<PersonaRcpSource>;
    createRcpSource: (input: CreatePersonaRcpSourceInput) => Promise<PersonaRcpSource>;
    updateRcpSource: (sourceId: string, input: UpdatePersonaRcpSourceInput) => Promise<PersonaRcpSource>;
    deleteRcpSource: (sourceId: string) => Promise<void>;
    bulkDeleteRcpSources: (ids: string[]) => Promise<PersonaBulkDeleteResult>;
    getRcpSourceUsage: (sourceId: string) => Promise<PersonaResourceUsage>;
    testRcpSourceConnection: (sourceId: string) => Promise<PersonaRcpSourceTestResult>;
};

interface UploadKnowledgeDocumentInput {
    filename: string;
    /** Browser `File`/`Blob`, or a React Native `{ uri, name, type }`-style asset. */
    content: Blob | {
        uri: string;
        name?: string;
        type?: string;
    };
    contentType?: string;
}
/**
 * CRUD for Knowledge Bases — vector-search-backed document collections an
 * Agent can be given. Requires the host's `createPersonaHandler`/
 * `createRuntime` to opt in with `capabilities: { knowledge: true }`;
 * every route this hook calls 404s/is unreachable otherwise.
 *
 * Ownership follows the same self-serve model as `useSkills`/`useAgents`:
 * pass `scope: 'mine'` to restrict `knowledgeBases` to the asserted
 * external user's own Knowledge Bases — omit it to see every one visible
 * to this Project (its own, plus public ones).
 */
declare function useKnowledgeBases(options?: UseKnowledgeBasesOptions): {
    knowledgeBases: PersonaKnowledgeBase[];
    pagination: PersonaPagination;
    isLoading: boolean;
    isUploading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaKnowledgeBase[]>;
    getKnowledgeBase: (kbId: string) => Promise<PersonaKnowledgeBase>;
    createKnowledgeBase: (input: CreatePersonaKnowledgeBaseInput) => Promise<PersonaKnowledgeBase>;
    updateKnowledgeBase: (kbId: string, input: UpdatePersonaKnowledgeBaseInput) => Promise<PersonaKnowledgeBase>;
    deleteKnowledgeBase: (kbId: string) => Promise<void>;
    bulkDeleteKnowledgeBases: (ids: string[]) => Promise<PersonaBulkDeleteResult>;
    getKnowledgeBaseUsage: (kbId: string) => Promise<PersonaKnowledgeBaseUsage>;
    uploadDocuments: (kbId: string, files: UploadKnowledgeDocumentInput[]) => Promise<PersonaUploadDocumentsResult>;
    listDocuments: (kbId: string) => Promise<PersonaKnowledgeDocument[]>;
    deleteDocument: (kbId: string, sourceName: string) => Promise<PersonaDeleteDocumentResult>;
    search: (kbId: string, query: string, opts?: {
        topK?: number;
    }) => Promise<PersonaKnowledgeSearchResult[]>;
};

/**
 * Self-serve CRUD for the calling end user's OWN MCP server connections —
 * "connect your own tool server to your agent", not the Project's shared
 * ones (see `useMcp` for calling tools/reading resources on an already-
 * attached MCP, and `useMcpConnections` for the per-user OAuth connect/
 * disconnect flow on a Project-configured `authMode: 'user'` MCP).
 *
 * Requires the host's `createPersonaHandler`/`createRuntime` to opt in
 * with `capabilities: { mcps: true }`; every route this hook calls
 * 404s/is unreachable otherwise.
 *
 * Deliberately narrower than `useSkills`/`useAgents`/`useKnowledgeBases`:
 * always operates in "mine" mode — `list()` only ever returns MCPs the
 * calling external user themselves registered (there's no `scope` option
 * to browse the Project's shared MCPs; an end user managing their own tool
 * connections has no reason to browse someone else's). `createMcp` always
 * creates as their own — ownership is resolved server-side from the
 * asserted external user, never something you pass in. No `getUsage` —
 * unlike a Skill/Agent, other people's Agents can't reference a personal
 * MCP only its owner can see.
 */
declare function useMcpAdmin(options?: UseMcpAdminOptions): {
    mcps: PersonaMcp[];
    pagination: PersonaPagination;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaMcp[]>;
    getMcp: (mcpId: string) => Promise<PersonaMcp>;
    createMcp: (input: CreatePersonaMcpInput) => Promise<PersonaMcp>;
    updateMcp: (mcpId: string, input: UpdatePersonaMcpInput) => Promise<PersonaMcp>;
    deleteMcp: (mcpId: string) => Promise<void>;
    bulkDeleteMcps: (ids: string[]) => Promise<PersonaBulkDeleteResult>;
    testConnection: (mcpId: string) => Promise<PersonaMcpTestConnectionResult>;
};

interface WorkflowsPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
/**
 * Read-only discovery (`workflows`) is always on. `createWorkflow` requires
 * the host's `createPersonaHandler`/`createRuntime` to opt in with
 * `capabilities: { workflowsWrite: true }` — otherwise that one route
 * 404s/is unreachable (authoring workflows is Project-admin/builder work,
 * not something an ordinary end-user session does by default).
 */
declare function useWorkflows(options?: UseWorkflowsOptions | boolean): {
    workflows: PersonaWorkflow[];
    pagination: WorkflowsPagination;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaWorkflow[]>;
    createWorkflow: (input: CreatePersonaWorkflowInput) => Promise<PersonaWorkflow>;
};

/**
 * Single-workflow read + the full `capabilities.workflowsWrite`-gated
 * authoring surface: metadata update, draft autosave, publish, version
 * history, and Mermaid export.
 */
declare function useWorkflow(workflowId: string, options?: UseWorkflowOptions | boolean): {
    workflow: PersonaWorkflow | null;
    versions: PersonaWorkflowVersion[];
    mermaid: string | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaWorkflow | null>;
    fetchVersions: () => Promise<PersonaWorkflowVersion[]>;
    getVersion: (version: number) => Promise<PersonaWorkflowVersion>;
    fetchMermaid: () => Promise<any>;
    updateWorkflow: (input: UpdatePersonaWorkflowInput) => Promise<PersonaWorkflow>;
    saveDraft: (draft: PersonaWorkflowDraft) => Promise<PersonaWorkflow>;
    publish: () => Promise<PersonaWorkflowVersion>;
    deleteWorkflow: () => Promise<void>;
};

declare function useWorkflowStream(workflowId?: string, options?: UseWorkflowStreamOptions): UseWorkflowStreamResult;

declare function useWorkflowRuns(workflowId?: string, options?: UseWorkflowRunsOptions | boolean): {
    runs: PersonaWorkflowRun[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaWorkflowRun[]>;
    getRun: (runId: string) => Promise<PersonaWorkflowRun>;
    cancelRun: (runId: string) => Promise<void>;
};

/**
 * SSE transport for chat streams, with a React Native fallback.
 *
 * On the web, `fetch` gives a streaming `response.body` and we read it with a
 * ReadableStream reader. React Native's `fetch` is the whatwg-fetch polyfill
 * over XMLHttpRequest: `response.body` is `undefined`, and the promise only
 * settles once the entire response has arrived. That means the check cannot be
 * "call fetch, then see whether body exists" - by that point the whole stream
 * has already been buffered and the chance to stream is gone. The transport has
 * to be chosen *before* the request is made.
 *
 * XMLHttpRequest itself does stream everywhere React Native runs: it appends to
 * `responseText` and fires `readyState === 3` (LOADING) on every chunk, which is
 * all an SSE consumer needs. So the RN path issues the request over raw XHR and
 * hands back the same reader interface the fetch path does, leaving callers
 * unaware of which one they got.
 */
/** Minimal reader interface, mirroring the shape of a ReadableStream reader. */
interface SSEReader {
    /** Resolves with the next decoded chunk, or `{ done: true }` at end of stream. */
    read(): Promise<{
        done: boolean;
        value?: string;
    }>;
    /** Aborts the underlying request. */
    cancel(): void;
}
interface SSEStream {
    status: number;
    ok: boolean;
    getHeader(name: string): string | null;
    /** Present only when `ok` is false, so callers can surface the server's message. */
    errorText?: string;
    reader: SSEReader;
}
interface OpenSSEOptions {
    url: string;
    headers: Record<string, string>;
    body?: string;
    method?: "GET" | "POST";
    signal?: AbortSignal;
}
/**
 * Whether `fetch` on this platform yields a streaming body.
 *
 * `navigator.product === 'ReactNative'` is the long-standing marker React
 * Native sets, and is checked rather than feature-detecting `ReadableStream`:
 * newer RN versions do expose a global `ReadableStream` while still leaving
 * `response.body` undefined, so the presence of the type says nothing about
 * whether fetch will populate it.
 */
declare function supportsStreamingFetch(): boolean;
/**
 * Opens an SSE stream, using whichever transport this platform can stream over.
 */
declare function openSSEStream(opts: OpenSSEOptions): Promise<SSEStream>;

declare const VERSION = "0.10.0";

export { ARCHITECT_AGENT_ID, type CreatePersonaAgentInput, type CreatePersonaKnowledgeBaseInput, type CreatePersonaMcpInput, type CreatePersonaRcpSourceInput, type CreatePersonaSkillInput, type CreatePersonaWorkflowInput, type OpenSSEOptions, type PersonaAgent, type PersonaAgentCategory, type PersonaAgentSnapshot, type PersonaAgentSocialLinks, type PersonaAgentVisibility, type PersonaBulkDeleteResult, type PersonaClarificationQuestion, type PersonaDeleteDocumentResult, type PersonaFileItem, type PersonaHealthInfo, type PersonaHitlActionRequest, type PersonaInterrupt, type PersonaKnowledgeBase, type PersonaKnowledgeBaseUsage, type PersonaKnowledgeDocument, type PersonaKnowledgeSearchResult, type PersonaMcp, type PersonaMcpAuthMode, type PersonaMcpAuthType, type PersonaMcpConnection, type PersonaMcpOAuthConfig, type PersonaMcpOAuthInput, type PersonaMcpResourceSummary, type PersonaMcpResourceTemplate, type PersonaMcpTestConnectionResult, type PersonaMcpTool, type PersonaMcpTransport, type PersonaMemoryAgentGroup, type PersonaMemoryFile, type PersonaMemoryList, type PersonaMessage, type PersonaNodeOnErrorAction, type PersonaNodeRetryPolicy, type PersonaNodeRun, type PersonaNodeRunState, type PersonaNodeRunStatus, type PersonaPagination, type PersonaPresentedFile, PersonaProvider, type PersonaProviderProps, type PersonaRcpParamContextMapEntry, type PersonaRcpSource, type PersonaRcpSourceTestResult, type PersonaRcpSourceToolParamSummary, type PersonaRcpSourceToolSummary, type PersonaResourceUsage, type PersonaResumeValue, type PersonaRole, type PersonaSandboxCommand, type PersonaSkill, type PersonaSkillFile, type PersonaSkillUsage, type PersonaStreamingEvent, type PersonaSubagentActivityEntry, type PersonaThread, type PersonaTodo, type PersonaToolCall, type PersonaUploadDocumentsResult, type PersonaVoiceEndReason, type PersonaVoiceState, type PersonaVoiceToolCall, type PersonaVoiceTranscriptLine, type PersonaWorkflow, type PersonaWorkflowDraft, type PersonaWorkflowEdge, type PersonaWorkflowNode, type PersonaWorkflowNodeData, type PersonaWorkflowNodeType, type PersonaWorkflowOwnerType, type PersonaWorkflowRun, type PersonaWorkflowRunStatus, type PersonaWorkflowTrigger, type PersonaWorkflowTriggerType, type PersonaWorkflowUsage, type PersonaWorkflowVersion, type PersonaWorkflowVisibility, type PersonaWorkspaceFile, type SSEReader, type SSEStream, type SendArchitectMessageOverride, type SendMessageOverride, type UpdatePersonaAgentInput, type UpdatePersonaKnowledgeBaseInput, type UpdatePersonaMcpInput, type UpdatePersonaRcpSourceInput, type UpdatePersonaSkillInput, type UpdatePersonaWorkflowInput, type UploadKnowledgeDocumentInput, type UseAgentsOptions, type UseArchitectChatOptions, type UseChatOptions, type UseKnowledgeBasesOptions, type UseMcpAdminOptions, type UseMcpConnectionsOptions, type UseMcpOptions, type UseRcpSourcesOptions, type UseSkillsOptions, type UseVoiceOptions, type UseVoiceResult, type UseWorkflowOptions, type UseWorkflowRunsOptions, type UseWorkflowStreamOptions, type UseWorkflowStreamResult, type UseWorkflowsOptions, VERSION, type WorkflowsPagination, openSSEStream, supportsStreamingFetch, useAgents, useArchitectChat, useChat, useConnection, useFiles, useKnowledgeBases, useMcp, useMcpAdmin, useMcpConnections, useMemory, usePersonaContext, useRcpSources, useSkills, useThreads, useVoice, useWorkflow, useWorkflowRuns, useWorkflowStream, useWorkflows, useWorkspaceFiles };
