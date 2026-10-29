"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";

/**
 * Why a user-mode MCP isn't usable, in increasing specificity over the bare
 * `connected` boolean:
 * - `connected` — a usable token row exists (may still be refreshed soon).
 * - `expired` — a row exists but its access token is dead and there's no
 *   refresh token to renew it; `authorizeUrl` is populated.
 * - `needs_auth` — the provider rejected the stored grant (revoked or
 *   expired refresh token); reconnecting is the only fix.
 * - `not_connected` — this end user has never connected.
 */
export type PersonaMcpConnectionStatus =
  | "connected"
  | "expired"
  | "needs_auth"
  | "not_connected";

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
  /**
   * Finer-grained than `connected` — tells "never connected" apart from
   * "token expired" and "grant revoked", so the UI can say "Connect" vs.
   * "Reconnect". Absent against backends predating this field; treat
   * `undefined` as `connected ? "connected" : "not_connected"`.
   */
  status?: PersonaMcpConnectionStatus;
  /** When the stored access token expires (ISO string), if the provider returned one. */
  expiresAt?: string | null;
  /** The provider's rejection reason when `status` is `needs_auth` (never contains tokens). */
  lastError?: string | null;
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
        options.returnTo ??
        (typeof window !== "undefined" ? window.location.href : undefined);
      const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
      const res = await fetchWithAuth(
        `/agents/${agentId}/mcp-connections${query}`,
      );
      if (!res.ok)
        throw new Error(`Failed to load MCP connections: ${res.statusText}`);
      const data = await res.json();
      const items: PersonaMcpConnection[] = Array.isArray(data)
        ? data
        : data?.items || [];
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

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  /** Revokes the current end user's own connection to this MCP (`DELETE .../oauth/user/connection`). */
  const disconnect = useCallback(
    async (mcpId: string) => {
      setIsDisconnecting(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}/oauth/user/connection`, {
          method: "DELETE",
        });
        if (!res.ok)
          throw new Error(`Failed to disconnect MCP: ${res.statusText}`);
        setConnections((prev) =>
          prev.map((c) =>
            c.mcpId === mcpId
              ? { ...c, connected: false, status: "not_connected", authorizeUrl: null }
              : c,
          ),
        );
        // authorizeUrl for the now-disconnected MCP came back null above —
        // refetch to get a real one (needed to reconnect) instead of leaving
        // the affordance dead until the next unrelated refetch.
        void fetchConnections();
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsDisconnecting(false);
      }
    },
    [fetchWithAuth, fetchConnections],
  );

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
    disconnect,
    isDisconnecting,
  };
}
