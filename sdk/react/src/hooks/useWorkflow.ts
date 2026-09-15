"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type {
  PersonaWorkflow,
  PersonaWorkflowDraft,
  PersonaWorkflowVersion,
  UpdatePersonaWorkflowInput,
  UseWorkflowOptions,
} from "../types.js";

/**
 * Single-workflow read + the full `capabilities.workflowsWrite`-gated
 * authoring surface: metadata update, draft autosave, publish, version
 * history, and Mermaid export.
 */
export function useWorkflow(
  workflowId: string,
  options?: UseWorkflowOptions | boolean,
) {
  const opts: UseWorkflowOptions =
    typeof options === "boolean" ? { autoFetch: options } : options ?? {};
  const { autoFetch = true } = opts;

  const { fetchWithAuth } = usePersonaContext();
  const [workflow, setWorkflow] = useState<PersonaWorkflow | null>(null);
  const [versions, setVersions] = useState<PersonaWorkflowVersion[]>([]);
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
      const items: PersonaWorkflowVersion[] = Array.isArray(data)
        ? data
        : (data?.items ?? []);
      setVersions(items);
      return items;
    } catch {
      return [];
    }
  }, [fetchWithAuth, workflowId]);

  const getVersion = useCallback(
    async (version: number): Promise<PersonaWorkflowVersion> => {
      if (!workflowId) throw new Error("Workflow ID is required");
      const res = await fetchWithAuth(`/workflows/${workflowId}/versions/${version}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch workflow version (${res.status}): ${res.statusText}`);
      }
      return (await res.json()) as PersonaWorkflowVersion;
    },
    [fetchWithAuth, workflowId],
  );

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

  /** Updates metadata (name/description/visibility/isEnabled) — for the node graph itself, use `saveDraft`. */
  const updateWorkflow = useCallback(
    async (input: UpdatePersonaWorkflowInput): Promise<PersonaWorkflow> => {
      if (!workflowId) throw new Error("Workflow ID is required");
      setError(null);
      const res = await fetchWithAuth(`/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to update workflow (${res.status}): ${errText}`);
      }
      const updated = (await res.json()) as PersonaWorkflow;
      setWorkflow(updated);
      return updated;
    },
    [fetchWithAuth, workflowId],
  );

  const saveDraft = useCallback(
    async (draft: PersonaWorkflowDraft) => {
      if (!workflowId) throw new Error("Workflow ID is required");
      setError(null);
      // The runtime route is PUT /workflows/:id/draft, and expects the
      // draft object directly as the body — not wrapped in `{ draft }`.
      const res = await fetchWithAuth(`/workflows/${workflowId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
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

  const publish = useCallback(async (): Promise<PersonaWorkflowVersion> => {
    if (!workflowId) throw new Error("Workflow ID is required");
    setError(null);
    const res = await fetchWithAuth(`/workflows/${workflowId}/publish`, {
      method: "POST",
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Failed to publish workflow (${res.status}): ${errText}`);
    }
    const versionResult = (await res.json()) as PersonaWorkflowVersion;
    void fetchWorkflow();
    void fetchVersions();
    return versionResult;
  }, [fetchWithAuth, workflowId, fetchWorkflow, fetchVersions]);

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
    getVersion,
    fetchMermaid,
    updateWorkflow,
    saveDraft,
    publish,
    deleteWorkflow,
  };
}
