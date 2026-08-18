import * as react from 'react';
import react__default, { ReactNode } from 'react';

type PersonaRole = 'user' | 'assistant' | 'system';
/** One live update on a running `task` (subagent) tool call's timeline. */
interface PersonaSubagentActivityEntry {
    kind: 'text' | 'tool_start' | 'tool_result';
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
    /** Model reasoning/thinking text streamed ahead of the final answer, when the provider exposes it. */
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
    kind: 'hitl';
    actionRequests: PersonaHitlActionRequest[];
    reviewConfigs: unknown[];
} | {
    kind: 'clarification';
    questions: PersonaClarificationQuestion[];
};
/** What to send back in `sendMessage(content, { resume })` to unpause a paused run. */
type PersonaResumeValue = {
    decisions: Array<{
        type: 'approve' | 'reject';
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
    scope?: 'user' | 'agent';
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
    type: 'TEXT_MESSAGE_CHUNK';
    delta: string;
    messageId?: string;
    role?: 'assistant';
} | {
    type: 'TOOL_CALL_CHUNK';
    toolCallId?: string;
    toolCallName?: string;
    delta?: string;
    parentMessageId?: string;
} | {
    type: 'TOOL_CALL_RESULT';
    toolCallId: string;
    content: string;
    messageId?: string;
    role?: 'tool';
    structuredContent?: unknown;
} | {
    type: 'REASONING_MESSAGE_START';
    messageId: string;
} | {
    type: 'REASONING_MESSAGE_CONTENT';
    messageId: string;
    delta: string;
} | {
    type: 'REASONING_END';
} | {
    type: 'STATE_SNAPSHOT';
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
    type: 'RUN_ERROR';
    code: string;
    message: string;
    retryable?: boolean;
    providerName?: string;
} | {
    type: 'CUSTOM';
    name: 'hitl_request';
    value: {
        actionRequests: PersonaHitlActionRequest[];
        reviewConfigs: unknown[];
    };
} | {
    type: 'CUSTOM';
    name: 'clarification_request';
    value: {
        questions: PersonaClarificationQuestion[];
        currentIndex: number;
    };
} | {
    type: 'CUSTOM';
    name: 'subagent_activity';
    value: {
        toolCallId: string;
    } & PersonaSubagentActivityEntry;
} | {
    type: 'CUSTOM';
    name: 'mcp_app';
    value: {
        toolCallId: string;
        resourceUri: string;
        mcpId: string;
    };
} | {
    type: 'CUSTOM';
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
}
interface SendMessageOverride {
    agentId?: string;
    threadId?: string;
    /** Answers/approves a paused interrupt from a previous turn instead of starting a fresh one. */
    resume?: PersonaResumeValue;
}

interface PersonaContextValue {
    baseUrl: string;
    getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
    defaultAgentId?: string;
    fetchWithAuth: (path: string, init?: RequestInit) => Promise<Response>;
}
declare function PersonaProvider({ baseUrl, getAuthToken, defaultAgentId, children, }: PersonaProviderProps): react__default.JSX.Element;
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
    getThread: (threadId: string) => Promise<PersonaThread>;
};

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

declare const VERSION = "0.3.3";

export { type PersonaAgentSummary, type PersonaClarificationQuestion, type PersonaFileItem, type PersonaHealthInfo, type PersonaHitlActionRequest, type PersonaInterrupt, type PersonaMcpConnection, type PersonaMemoryAgentGroup, type PersonaMemoryFile, type PersonaMemoryList, type PersonaMessage, type PersonaPresentedFile, PersonaProvider, type PersonaProviderProps, type PersonaResumeValue, type PersonaRole, type PersonaStreamingEvent, type PersonaSubagentActivityEntry, type PersonaThread, type PersonaTodo, type PersonaToolCall, type PersonaWorkspaceFile, type SendMessageOverride, type UseChatOptions, type UseMcpConnectionsOptions, VERSION, useAgents, useChat, useConnection, useFiles, useMcpConnections, useMemory, usePersonaContext, useThreads };
