"use client";

import { useCallback } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";

export interface UseMcpOptions {
  /** Default MCP server ID for resource reads and tool calls */
  mcpId?: string;
}

/**
 * Hook for interacting with MCP servers connected via the Persona runtime.
 * Provides helper functions for reading UI/data resources and calling server tools.
 */
export function useMcp(options: UseMcpOptions = {}) {
  const { fetchWithAuth } = usePersonaContext();
  const defaultMcpId = options.mcpId;

  /**
   * Reads a resource by URI from an MCP server.
   * @param uri - The resource URI (e.g. `ui://...` or data resource URI).
   * @param mcpId - Optional MCP ID to override the hook's default.
   */
  const readResource = useCallback(
    async (uri: string, mcpId?: string) => {
      const id = mcpId ?? defaultMcpId;
      if (!id) throw new Error("MCP server ID is required to read resource");
      const res = await fetchWithAuth(
        `/mcps/${id}/resource?uri=${encodeURIComponent(uri)}`
      );
      if (!res.ok) {
        throw new Error(`Failed to read MCP resource: ${res.statusText}`);
      }
      return await res.json();
    },
    [fetchWithAuth, defaultMcpId]
  );

  /**
   * Invokes a tool exposed by an MCP server.
   * @param name - Tool name.
   * @param args - Arguments matching the tool's schema.
   * @param mcpId - Optional MCP ID to override the hook's default.
   */
  const callTool = useCallback(
    async (
      name: string,
      args?: Record<string, unknown>,
      mcpId?: string
    ) => {
      const id = mcpId ?? defaultMcpId;
      if (!id) throw new Error("MCP server ID is required to call tool");
      const res = await fetchWithAuth(`/mcps/${id}/call-tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
      });
      if (!res.ok) {
        throw new Error(`Failed to call MCP tool: ${res.statusText}`);
      }
      return await res.json();
    },
    [fetchWithAuth, defaultMcpId]
  );

  return {
    readResource,
    callTool,
  };
}
