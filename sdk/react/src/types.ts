import type { ReactNode } from 'react';

export type PersonaRole = 'user' | 'assistant' | 'system';

export interface PersonaToolCall {
  toolCallId: string;
  toolName: string;
  args?: string;
  result?: string;
  isError?: boolean;
}

export interface PersonaMessage {
  id: string;
  role: PersonaRole;
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  toolCalls?: PersonaToolCall[];
}

export interface PersonaProviderProps {
  /** Base URL where the Persona runtime / adapter is mounted, e.g. "http://localhost:4000/api/persona" */
  baseUrl: string;
  /** Async or sync getter for the user's Bearer JWT authentication token */
  getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
  /** Default Agent ID to direct chat conversations to */
  defaultAgentId?: string;
  children: ReactNode;
}

export interface PersonaThread {
  _id: string;
  agentId: string;
  title?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaMemoryFile {
  path: string;
  content: string;
  updatedAt?: string;
}

export interface PersonaMemoryList {
  user: Array<{ path: string; size?: number; updatedAt?: string }>;
  agents: Record<string, Array<{ path: string; size?: number; updatedAt?: string }>>;
}

/** AG-UI Streaming Protocol Event types emitted during streaming */
export type PersonaStreamingEvent =
  | { type: 'TEXT_MESSAGE_CHUNK'; delta: string; messageId?: string }
  | { type: 'TOOL_CALL_START'; toolCallId: string; toolName: string; parentMessageId?: string }
  | { type: 'TOOL_CALL_ARGS'; toolCallId: string; delta: string }
  | { type: 'TOOL_CALL_RESULT'; toolCallId: string; result: string; isError?: boolean }
  | { type: 'RUN_STARTED'; runId: string; threadId?: string }
  | { type: 'RUN_FINISHED'; runId: string; tokenUsage?: { promptTokens?: number; completionTokens?: number } }
  | { type: 'RUN_ERROR'; code: string; message: string }
  | { type: 'STEP_STARTED'; stepName: string }
  | { type: 'STEP_FINISHED'; stepName: string }
  | { type: 'CUSTOM'; name: string; payload: unknown };

export interface UseChatOptions {
  agentId?: string;
  threadId?: string;
  initialMessages?: PersonaMessage[];
  onFinish?: (message: PersonaMessage) => void;
  onError?: (error: Error) => void;
  /** Hook for receiving every low-level AG-UI streaming event (tool calls, steps, subagents) */
  onEvent?: (event: PersonaStreamingEvent) => void;
}
