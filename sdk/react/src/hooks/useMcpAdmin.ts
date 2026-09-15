"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  CreatePersonaMcpInput,
  PersonaBulkDeleteResult,
  PersonaMcp,
  PersonaMcpTestConnectionResult,
  PersonaPagination,
  UpdatePersonaMcpInput,
  UseMcpAdminOptions,
} from "../types.js";

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
export function useMcpAdmin(options: UseMcpAdminOptions = {}) {
  const { autoFetch = true, page, limit, search } = options;

  const { fetchWithAuth } = usePersonaContext();
  const [mcps, setMcps] = useState<PersonaMcp[]>([]);
  const [pagination, setPagination] = useState<PersonaPagination>({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMcps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      query.set("scope", "mine");

      const res = await fetchWithAuth(`/mcps?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to list MCPs: ${res.statusText}`);
      const data = await res.json();
      const items: PersonaMcp[] = Array.isArray(data) ? data : (data?.items ?? []);
      setMcps(items);
      setPagination(
        data?.pagination ?? { total: items.length, page: 1, limit: items.length, pages: 1 },
      );
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, page, limit, search]);

  const getMcp = useCallback(
    async (mcpId: string): Promise<PersonaMcp> => {
      const res = await fetchWithAuth(`/mcps/${mcpId}`);
      if (!res.ok) throw new Error(`Failed to fetch MCP: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const createMcp = useCallback(
    async (input: CreatePersonaMcpInput): Promise<PersonaMcp> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/mcps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create MCP (${res.status}): ${errText}`);
        }
        const created: PersonaMcp = await res.json();
        setMcps((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const updateMcp = useCallback(
    async (mcpId: string, input: UpdatePersonaMcpInput): Promise<PersonaMcp> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update MCP (${res.status}): ${errText}`);
        }
        const updated: PersonaMcp = await res.json();
        setMcps((prev) => prev.map((m) => (m._id === mcpId ? updated : m)));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const deleteMcp = useCallback(
    async (mcpId: string): Promise<void> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete MCP (${res.status}): ${errText}`);
        }
        setMcps((prev) => prev.filter((m) => m._id !== mcpId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const bulkDeleteMcps = useCallback(
    async (ids: string[]): Promise<PersonaBulkDeleteResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/mcps/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete MCPs (${res.status}): ${errText}`);
        }
        const result: PersonaBulkDeleteResult = await res.json();
        const deletedSet = new Set(result.deleted);
        setMcps((prev) => prev.filter((m) => !deletedSet.has(m._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const testConnection = useCallback(
    async (mcpId: string): Promise<PersonaMcpTestConnectionResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/mcps/${mcpId}/test`, { method: "POST" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to test MCP connection (${res.status}): ${errText}`);
        }
        const result: PersonaMcpTestConnectionResult = await res.json();
        setMcps((prev) =>
          prev.map((m) =>
            m._id === mcpId
              ? { ...m, tools: result.tools, resources: result.resources, resourceTemplates: result.resourceTemplates }
              : m,
          ),
        );
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  useEffect(() => {
    if (autoFetch) void fetchMcps();
  }, [autoFetch, fetchMcps]);

  return {
    mcps,
    pagination,
    isLoading,
    error,
    refetch: fetchMcps,
    getMcp,
    createMcp,
    updateMcp,
    deleteMcp,
    bulkDeleteMcps,
    testConnection,
  };
}
