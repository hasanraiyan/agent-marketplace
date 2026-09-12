"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  PersonaWorkflow,
  PersonaWorkflowDraft,
  PersonaWorkflowVersionSummary,
  UseWorkflowOptions,
} from "../types.js";

export function useWorkflow(
  workflowId: string,
  options?: UseWorkflowOptions | boolean,
) {
  const opts: UseWorkflowOptions =
    typeof options === "boolean" ? { autoFetch: options } : options ?? {};
  const { autoFetch = true } = opts;

  const { fetchWithAuth } = usePersonaContext();
  const [workflow, setWorkflow] = useState<PersonaWorkflow | null>(null);
  const [versions, setVersions] = useState<PersonaWorkflowVersionSummary[]>([]);
  const [mermaid, setMermaid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch workflow (${res.status}): ${res.statusText}`);
      }
      const data = (await res.json()) as PersonaWorkflow;
      setWorkflow(data);
      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, workflowId]);

  const fetchVersions = useCallback(async () => {
    if (!workflowId) return [];
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}/versions`);
      if (!res.ok) return [];
      const data = await res.json();
      const items: PersonaWorkflowVersionSummary[] = Array.isArray(data)
        ? data
        : data?.items || [];
      setVersions(items);
      return items;
    } catch {
      return [];
    }
  }, [fetchWithAuth, workflowId]);

  const fetchMermaid = useCallback(async () => {
    if (!workflowId) return "";
    try {
      const res = await fetchWithAuth(`/workflows/${workflowId}/mermaid`);
      if (!res.ok) return "";
      const data = await res.json();
      const code = typeof data?.mermaid === "string" ? data.mermaid : String(data ?? "");
      setMermaid(code);
      return code;
    } catch {
      return "";
    }
  }, [fetchWithAuth, workflowId]);

  const saveDraft = useCallback(
    async (draft: PersonaWorkflowDraft) => {
      if (!workflowId) throw new Error("Workflow ID is required");
      setError(null);
      const res = await fetchWithAuth(`/workflows/${workflowId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to save draft (${res.status}): ${errText}`);
      }
      const updated = (await res.json()) as PersonaWorkflow;
      setWorkflow(updated);
      return updated;
    },
    [fetchWithAuth, workflowId],
  );

  const publish = useCallback(
    async (summary?: string): Promise<PersonaWorkflowVersionSummary> => {
      if (!workflowId) throw new Error("Workflow ID is required");
      setError(null);
      const res = await fetchWithAuth(`/workflows/${workflowId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary ? { summary } : {}),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to publish workflow (${res.status}): ${errText}`);
      }
      const versionResult = (await res.json()) as PersonaWorkflowVersionSummary;
      void fetchWorkflow();
      void fetchVersions();
      return versionResult;
    },
    [fetchWithAuth, workflowId, fetchWorkflow, fetchVersions],
  );

  const deleteWorkflow = useCallback(async () => {
    if (!workflowId) throw new Error("Workflow ID is required");
    setError(null);
    const res = await fetchWithAuth(`/workflows/${workflowId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`Failed to delete workflow (${res.status}): ${res.statusText}`);
    }
    setWorkflow(null);
  }, [fetchWithAuth, workflowId]);

  useEffect(() => {
    if (autoFetch && workflowId) {
      void fetchWorkflow();
    }
  }, [autoFetch, workflowId, fetchWorkflow]);

  return {
    workflow,
    versions,
    mermaid,
    isLoading,
    error,
    refetch: fetchWorkflow,
    fetchVersions,
    fetchMermaid,
    saveDraft,
    publish,
    deleteWorkflow,
  };
}
