"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  CreatePersonaRcpSourceInput,
  PersonaBulkDeleteResult,
  PersonaPagination,
  PersonaRcpSource,
  PersonaRcpSourceTestResult,
  UpdatePersonaRcpSourceInput,
  UseRcpSourcesOptions,
} from "../types.js";

export interface PersonaResourceUsage {
  /** The real total — `agents` below is a preview capped at 20. */
  agentCount: number;
  agents: Array<{ _id: string; name: string }>;
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
export function useRcpSources(options: UseRcpSourcesOptions = {}) {
  const { autoFetch = true, page, limit, search } = options;

  const { fetchWithAuth } = usePersonaContext();
  const [rcpSources, setRcpSources] = useState<PersonaRcpSource[]>([]);
  const [pagination, setPagination] = useState<PersonaPagination>({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRcpSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);

      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/rcp-sources${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list RCP sources: ${res.statusText}`);
      const data = await res.json();
      const items: PersonaRcpSource[] = Array.isArray(data) ? data : (data?.items ?? []);
      setRcpSources(items);
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

  const getRcpSource = useCallback(
    async (sourceId: string): Promise<PersonaRcpSource> => {
      const res = await fetchWithAuth(`/rcp-sources/${sourceId}`);
      if (!res.ok) throw new Error(`Failed to fetch RCP source: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const createRcpSource = useCallback(
    async (input: CreatePersonaRcpSourceInput): Promise<PersonaRcpSource> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/rcp-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create RCP source (${res.status}): ${errText}`);
        }
        const created: PersonaRcpSource = await res.json();
        setRcpSources((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const updateRcpSource = useCallback(
    async (sourceId: string, input: UpdatePersonaRcpSourceInput): Promise<PersonaRcpSource> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/rcp-sources/${sourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update RCP source (${res.status}): ${errText}`);
        }
        const updated: PersonaRcpSource = await res.json();
        setRcpSources((prev) => prev.map((s) => (s._id === sourceId ? updated : s)));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const deleteRcpSource = useCallback(
    async (sourceId: string): Promise<void> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/rcp-sources/${sourceId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete RCP source (${res.status}): ${errText}`);
        }
        setRcpSources((prev) => prev.filter((s) => s._id !== sourceId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const bulkDeleteRcpSources = useCallback(
    async (ids: string[]): Promise<PersonaBulkDeleteResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/rcp-sources/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete RCP sources (${res.status}): ${errText}`);
        }
        const result: PersonaBulkDeleteResult = await res.json();
        const deletedSet = new Set(result.deleted);
        setRcpSources((prev) => prev.filter((s) => !deletedSet.has(s._id)));
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const getRcpSourceUsage = useCallback(
    async (sourceId: string): Promise<PersonaResourceUsage> => {
      const res = await fetchWithAuth(`/rcp-sources/${sourceId}/usage`);
      if (!res.ok) throw new Error(`Failed to fetch RCP source usage: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const testRcpSourceConnection = useCallback(
    async (sourceId: string): Promise<PersonaRcpSourceTestResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/rcp-sources/${sourceId}/test`, { method: "POST" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to test RCP source connection (${res.status}): ${errText}`);
        }
        const result: PersonaRcpSourceTestResult = await res.json();
        setRcpSources((prev) =>
          prev.map((s) =>
            s._id === sourceId
              ? { ...s, tools: result.tools, lastTestedAt: new Date().toISOString() }
              : s,
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
    if (autoFetch) void fetchRcpSources();
  }, [autoFetch, fetchRcpSources]);

  return {
    rcpSources,
    pagination,
    isLoading,
    error,
    refetch: fetchRcpSources,
    getRcpSource,
    createRcpSource,
    updateRcpSource,
    deleteRcpSource,
    bulkDeleteRcpSources,
    getRcpSourceUsage,
    testRcpSourceConnection,
  };
}
