"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  PersonaWorkflowRunSummary,
  UseWorkflowRunsOptions,
} from "../types.js";

export function useWorkflowRuns(
  workflowId?: string,
  options?: UseWorkflowRunsOptions | boolean,
) {
  const opts: UseWorkflowRunsOptions =
    typeof options === "boolean" ? { autoFetch: options } : options ?? {};
  const { autoFetch = true, page = 1, limit = 20 } = opts;

  const { fetchWithAuth } = usePersonaContext();
  const [runs, setRuns] = useState<PersonaWorkflowRunSummary[]>([]);
  const [pagination, setPagination] = useState({
    page,
    limit,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!workflowId) return [];
    setIsLoading(true);
    setError(null);
    try {
      const query = `?page=${page}&limit=${limit}`;
      const res = await fetchWithAuth(`/workflows/${workflowId}/runs${query}`);
      if (!res.ok) {
        throw new Error(`Failed to list workflow runs: ${res.statusText}`);
      }
      const data = await res.json();
      const items: PersonaWorkflowRunSummary[] = Array.isArray(data)
        ? data
        : data?.items || data?.runs || [];
      setRuns(items);

      if (data?.pagination) {
        setPagination({
          page: data.pagination.page ?? page,
          limit: data.pagination.limit ?? limit,
          total: data.pagination.total ?? items.length,
          totalPages: data.pagination.totalPages ?? 1,
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
  }, [fetchWithAuth, workflowId, page, limit]);

  const getRun = useCallback(
    async (runId: string): Promise<PersonaWorkflowRunSummary> => {
      if (!runId) throw new Error("Run ID is required");
      const res = await fetchWithAuth(`/workflows/runs/${runId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch workflow run (${res.status}): ${res.statusText}`);
      }
      return (await res.json()) as PersonaWorkflowRunSummary;
    },
    [fetchWithAuth],
  );

  const cancelRun = useCallback(
    async (runId: string): Promise<void> => {
      if (!runId) throw new Error("Run ID is required");
      const res = await fetchWithAuth(`/workflows/runs/${runId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Failed to cancel workflow run (${res.status}): ${res.statusText}`);
      }
      setRuns((prev) =>
        prev.map((r) => (r._id === runId ? { ...r, status: "cancelled" } : r)),
      );
    },
    [fetchWithAuth],
  );

  useEffect(() => {
    if (autoFetch && workflowId) {
      void fetchRuns();
    }
  }, [autoFetch, workflowId, fetchRuns]);

  return {
    runs,
    pagination,
    isLoading,
    error,
    refetch: fetchRuns,
    getRun,
    cancelRun,
  };
}
