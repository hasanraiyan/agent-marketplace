import * as react from 'react';
import react__default, { ReactNode } from 'react';

type PersonaRole = 'user' | 'assistant' | 'system';
interface PersonaToolCall {
    toolCallId: string;
    toolName: string;
    args?: string;
    result?: string;
    isError?: boolean;
}
interface PersonaMessage {
    id: string;
    role: PersonaRole;
    content: string;
    createdAt: Date;
    isStreaming?: boolean;
    toolCalls?: PersonaToolCall[];
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
    agentId: string;
    title?: string;
    isArchived?: boolean;
    createdAt: string;
    updatedAt: string;
}
interface PersonaMemoryFile {
    path: string;
    content: string;
    updatedAt?: string;
}
interface PersonaMemoryList {
    user: Array<{
        path: string;
        size?: number;
        updatedAt?: string;
    }>;
    agents: Record<string, Array<{
        path: string;
        size?: number;
        updatedAt?: string;
    }>>;
}
/** AG-UI Streaming Protocol Event types emitted during streaming */
type PersonaStreamingEvent = {
    type: 'TEXT_MESSAGE_CHUNK';
    delta: string;
    messageId?: string;
} | {
    type: 'TOOL_CALL_START';
    toolCallId: string;
    toolName: string;
    parentMessageId?: string;
} | {
    type: 'TOOL_CALL_ARGS';
    toolCallId: string;
    delta: string;
} | {
    type: 'TOOL_CALL_RESULT';
    toolCallId: string;
    result: string;
    isError?: boolean;
} | {
    type: 'RUN_STARTED';
    runId: string;
    threadId?: string;
} | {
    type: 'RUN_FINISHED';
    runId: string;
    tokenUsage?: {
        promptTokens?: number;
        completionTokens?: number;
    };
} | {
    type: 'RUN_ERROR';
    code: string;
    message: string;
} | {
    type: 'STEP_STARTED';
    stepName: string;
} | {
    type: 'STEP_FINISHED';
    stepName: string;
} | {
    type: 'CUSTOM';
    name: string;
    payload: unknown;
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
    sendMessage: (contentToSend?: string, overrideOptions?: {
        agentId?: string;
        threadId?: string;
    }) => Promise<void>;
    isStreaming: boolean;
    isLoading: boolean;
    error: Error | null;
    stop: () => void;
    reload: () => void;
    clear: () => void;
    setMessages: react.Dispatch<react.SetStateAction<PersonaMessage[]>>;
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
    refetch: () => Promise<any>;
    createThread: (agentId?: string) => Promise<PersonaThread>;
    deleteThread: (threadId: string) => Promise<void>;
};

interface PersonaAgentSummary {
    _id: string;
    name: string;
    description?: string;
    avatarUrl?: string;
}
declare function useAgents(autoFetch?: boolean): {
    agents: PersonaAgentSummary[];
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<any>;
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

declare const VERSION = "0.1.1";

export { type PersonaAgentSummary, type PersonaHealthInfo, type PersonaMemoryFile, type PersonaMemoryList, type PersonaMessage, PersonaProvider, type PersonaProviderProps, type PersonaRole, type PersonaStreamingEvent, type PersonaThread, type PersonaToolCall, type UseChatOptions, VERSION, useAgents, useChat, useConnection, useMemory, usePersonaContext, useThreads };
