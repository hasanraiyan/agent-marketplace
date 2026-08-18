import type { ReactNode } from 'react';

export interface PersonaMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
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

export interface UseChatOptions {
  agentId?: string;
  threadId?: string;
  initialMessages?: PersonaMessage[];
  onFinish?: (message: PersonaMessage) => void;
  onError?: (error: Error) => void;
}
