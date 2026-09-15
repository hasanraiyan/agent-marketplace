"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  CreatePersonaWorkflowInput,
  PersonaWorkflow,
  UseWorkflowsOptions,
} from "../types.js";

export interface WorkflowsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Read-only discovery (`workflows`) is always on. `createWorkflow` requires
 * the host's `createPersonaHandler`/`createRuntime` to opt in with
 * `capabilities: { workflowsWrite: true }` — otherwise that one route
 * 404s/is unreachable (authoring workflows is Project-admin/builder work,
 * not something an ordinary end-user session does by default).
 */
export function useWorkflows(options?: UseWorkflowsOptions | boolean) {
  const opts: UseWorkflowsOptions =
    typeof options === "boolean" ? { autoFetch: options } : options ?? {};
  const { autoFetch = true, search, scope, visibility, isEnabled, page, limit } = opts;

  const { fetchWithAuth } = usePersonaContext();
  const [workflows, setWorkflows] = useState<PersonaWorkflow[]>([]);
  const [pagination, setPagination] = useState<WorkflowsPagination>({
    page: page ?? 1,
    limit: limit ?? 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (scope) params.set("scope", scope);
      if (visibility) params.set("visibility", visibility);
      if (isEnabled !== undefined) params.set("isEnabled", String(isEnabled));
      if (page) params.set("page", String(page));
      if (limit) params.set("limit", String(limit));

      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await fetchWithAuth(`/workflows${queryStr}`);
      if (!res.ok) {
        throw new Error(`Failed to list workflows: ${res.statusText}`);
      }
      const data = await res.json();
      const items: PersonaWorkflow[] = Array.isArray(data) ? data : (data?.items ?? []);
      setWorkflows(items);

      if (data?.pagination) {
        setPagination({
          page: data.pagination.page ?? 1,
          limit: data.pagination.limit ?? items.length,
          total: data.pagination.total ?? items.length,
          // Backend's paginationEnvelope() names this field `pages`, not
          // `totalPages` — this used to always fall through to the `?? 1`
          // default.
          totalPages: data.pagination.pages ?? 1,
        });
      } else {
        setPagination({
          page: 1,
          limit: items.length,
          total: items.length,
          totalPages: 1,
        });
      }
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, search, scope, visibility, isEnabled, page, limit]);

  const createWorkflow = useCallback(
    async (input: CreatePersonaWorkflowInput): Promise<PersonaWorkflow> => {
      setError(null);
      try {
        const res = await fetchWithAuth("/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to create workflow (${res.status}): ${errText}`);
        }
        const created = (await res.json()) as PersonaWorkflow;
        setWorkflows((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      }
    },
    [fetchWithAuth],
  );

  useEffect(() => {
    if (autoFetch) {
      void fetchWorkflows();
    }
  }, [autoFetch, fetchWorkflows]);

  return {
    workflows,
    pagination,
    isLoading,
    error,
    refetch: fetchWorkflows,
    createWorkflow,
  };
}
