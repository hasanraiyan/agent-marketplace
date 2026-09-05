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
    scope?: "user" | "agent";
    agentId?: string;
    path: string;
    content: string;
    mimeType?: string;
    createdAt?: string;
    updatedAt?: string;
}
/** One agent's group of agent-scoped memory files, as returned by `GET /memory`. */
interface PersonaMemoryAgentGroup {
    agentId: string;
    /** `null` if the agent no longer exists. */
    agentName: string | null;
    files: PersonaMemoryFile[];
}
interface PersonaMemoryList {
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
type PersonaStreamingEvent = {
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
    sendMessage: (contentToSend?: string, overrideOptions?: SendMessageOverride) => Promise<void>;
    isStreaming: boolean;
    isLoading: boolean;
    isLoadingHistory: boolean;
    error: Error | null;
    interrupt: PersonaInterrupt | null;
    resumeInterrupt: (resume: PersonaResumeValue, displayContent: string) => Promise<void>;
    files: Record<string, PersonaWorkspaceFile>;
    todos: PersonaTodo[];
    presentedFile: PersonaPresentedFile | null;
    dismissPresentedFile: () => void;
    openWorkspaceFile: (path: string) => void;
    stop: () => void;
    reload: () => void;
    clear: () => void;
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
        scope?: "user" | "agent";
        agentId?: string;
    }) => Promise<PersonaMemoryFile>;
    writeFile: (params: {
        path: string;
        content: string;
        scope?: "user" | "agent";
        agentId?: string;
    }) => Promise<PersonaMemoryFile>;
    deleteFile: (params: {
        path: string;
        scope?: "user" | "agent";
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

interface PersonaAgentSummary {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    tagline?: string;
    avatar?: string;
}
declare function useAgents(autoFetch?: boolean): {
    agents: PersonaAgentSummary[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<PersonaAgentSummary[]>;
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
    body: string;
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

declare const VERSION = "0.7.3";

export { type OpenSSEOptions, type PersonaAgentSummary, type PersonaClarificationQuestion, type PersonaFileItem, type PersonaHealthInfo, type PersonaHitlActionRequest, type PersonaInterrupt, type PersonaMcpConnection, type PersonaMemoryAgentGroup, type PersonaMemoryFile, type PersonaMemoryList, type PersonaMessage, type PersonaPresentedFile, PersonaProvider, type PersonaProviderProps, type PersonaResumeValue, type PersonaRole, type PersonaStreamingEvent, type PersonaSubagentActivityEntry, type PersonaThread, type PersonaTodo, type PersonaToolCall, type PersonaVoiceEndReason, type PersonaVoiceState, type PersonaVoiceToolCall, type PersonaVoiceTranscriptLine, type PersonaWorkspaceFile, type SSEReader, type SSEStream, type SendMessageOverride, type UseChatOptions, type UseMcpConnectionsOptions, type UseVoiceOptions, type UseVoiceResult, VERSION, openSSEStream, supportsStreamingFetch, useAgents, useChat, useConnection, useFiles, useMcpConnections, useMemory, usePersonaContext, useThreads, useVoice };
