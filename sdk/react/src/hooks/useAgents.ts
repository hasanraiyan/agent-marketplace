"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  CreatePersonaAgentInput,
  PersonaAgent,
  PersonaBulkDeleteResult,
  PersonaPagination,
  UpdatePersonaAgentInput,
  UseAgentsOptions,
} from "../types.js";

/**
 * Read-only discovery (`agents`) is always on. Create/update/delete/
 * bulk-delete/getAgent require the host's `createPersonaHandler`/
 * `createRuntime` to opt in with `capabilities: { agentsWrite: true }` —
 * every write route this hook calls 404s/is unreachable otherwise
 * (provisioning Agents is Project-level work the host must deliberately
 * turn on, not something a chat session gets by default).
 *
 * Ownership follows the same self-serve model as `useSkills`/`useWorkflows`:
 * pass `scope: 'mine'` to restrict `agents` to the asserted external user's
 * own Agents (only meaningful when `PersonaProvider` is wired through an
 * adapter that resolves a real end-user identity) — omit it to see every
 * Agent visible to this Project.
 */
export function useAgents(options: UseAgentsOptions | boolean = true) {
  const opts: UseAgentsOptions =
    typeof options === "boolean" ? { autoFetch: options } : options;
  const { autoFetch = true, page, limit, search, category, scope } = opts;

  const { fetchWithAuth } = usePersonaContext();
  const [agents, setAgents] = useState<PersonaAgent[]>([]);
  const [pagination, setPagination] = useState<PersonaPagination>({
    total: 0,
    page: page ?? 1,
    limit: limit ?? 20,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (page) query.set("page", String(page));
      if (limit) query.set("limit", String(limit));
      if (search) query.set("search", search);
      if (category) query.set("category", category);
      if (scope) query.set("scope", scope);

      const queryStr = query.toString() ? `?${query.toString()}` : "";
      const res = await fetchWithAuth(`/agents${queryStr}`);
      if (!res.ok) throw new Error(`Failed to list agents: ${res.statusText}`);
      const data = await res.json();
      const items: PersonaAgent[] = Array.isArray(data) ? data : (data?.items ?? []);
      setAgents(items);
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
  }, [fetchWithAuth, page, limit, search, category, scope]);

  const getAgent = useCallback(
    async (agentId: string): Promise<PersonaAgent> => {
      const res = await fetchWithAuth(`/agents/${agentId}`);
      if (!res.ok) throw new Error(`Failed to fetch agent: ${res.statusText}`);
      return res.json();
    },
    [fetchWithAuth],
  );

  const createAgent = useCallback(
    async (input: CreatePersonaAgentInput): Promise<PersonaAgent> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create agent (${res.status}): ${errText}`);
        }
        const created: PersonaAgent = await res.json();
        setAgents((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const updateAgent = useCallback(
    async (agentId: string, input: UpdatePersonaAgentInput): Promise<PersonaAgent> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to update agent (${res.status}): ${errText}`);
        }
        const updated: PersonaAgent = await res.json();
        setAgents((prev) => prev.map((a) => (a._id === agentId ? updated : a)));
        return updated;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const deleteAgent = useCallback(
    async (agentId: string): Promise<void> => {
      setError(null);
      try {
        const res = await fetchWithAuth(`/agents/${agentId}`, { method: "DELETE" });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to delete agent (${res.status}): ${errText}`);
        }
        setAgents((prev) => prev.filter((a) => a._id !== agentId));
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  const bulkDeleteAgents = useCallback(
    async (ids: string[]): Promise<PersonaBulkDeleteResult> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/agents/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to bulk-delete agents (${res.status}): ${errText}`);
        }
        const result: PersonaBulkDeleteResult = await res.json();
        const deletedSet = new Set(result.deleted);
        setAgents((prev) => prev.filter((a) => !deletedSet.has(a._id)));
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
    if (autoFetch) void fetchAgents();
  }, [autoFetch, fetchAgents]);

  return {
    agents,
    pagination,
    isLoading,
    error,
    refetch: fetchAgents,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    bulkDeleteAgents,
  };
}
