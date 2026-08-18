'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePersonaContext } from '../context/PersonaContext.js';

/**
 * One `authType: 'oauth', authMode: 'user'` MCP an Agent has attached, and
 * whether the current end user has connected it yet. `authorizeUrl` is only
 * present when `connected` is `false` — navigate the browser there (a
 * same-tab redirect is fine; it's a real OAuth authorization URL) to start
 * the consent flow.
 */
export interface PersonaMcpConnection {
  mcpId: string;
  name: string;
  description: string;
  connected: boolean;
  authorizeUrl: string | null;
}

export interface UseMcpConnectionsOptions {
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
export function useMcpConnections(options: UseMcpConnectionsOptions = {}) {
  const { defaultAgentId, fetchWithAuth } = usePersonaContext();
  const agentId = options.agentId ?? defaultAgentId;
  const autoFetch = options.autoFetch ?? true;

  const [connections, setConnections] = useState<PersonaMcpConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!agentId) return [];
    setIsLoading(true);
    setError(null);
    try {
      const returnTo =
        options.returnTo ?? (typeof window !== 'undefined' ? window.location.href : undefined);
      const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
      const res = await fetchWithAuth(`/agents/${agentId}/mcp-connections${query}`);
      if (!res.ok) throw new Error(`Failed to load MCP connections: ${res.statusText}`);
      const data = await res.json();
      const items: PersonaMcpConnection[] = Array.isArray(data) ? data : data?.items || [];
      setConnections(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [agentId, fetchWithAuth, options.returnTo]);

  useEffect(() => {
    if (autoFetch) void fetchConnections();
  }, [autoFetch, fetchConnections]);

  return {
    connections,
    /** Convenience filter for the common "show a banner for what's missing" case. */
    unconnected: connections.filter((c) => !c.connected),
    isLoading,
    error,
    refetch: fetchConnections,
  };
}
