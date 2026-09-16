"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type { PersonaWorkspaceFile } from "../types.js";
import { normalizeWorkspaceFiles } from "./streamEventHelpers.js";

export type { PersonaWorkspaceFile };

/**
 * CRUD over one Thread's workspace files (the agent's own virtual
 * filesystem) — `useChat()` already exposes a read-only `files` snapshot
 * tied to that thread's live/loaded messages; this hook is for a
 * standalone file-explorer UI that needs to list, read, write, and delete
 * files independently of an active chat session.
 *
 * KNOWN LIMITATION (inherited from the backend): no lock exists against a
 * concurrent live run on the same Thread — writing here while the agent is
 * actively mid-run could race with its own file writes.
 */
export function useWorkspaceFiles(threadId: string | undefined, autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = useState<Record<string, PersonaWorkspaceFile>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!threadId) return {};
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/threads/${threadId}/files`);
      if (!res.ok) throw new Error(`Failed to list workspace files: ${res.statusText}`);
      const data = await res.json();
      const normalized = normalizeWorkspaceFiles(data?.data ?? data ?? {});
      setFiles(normalized);
      return normalized;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, threadId]);

  const getFile = useCallback(
    async (path: string) => {
      if (!threadId) throw new Error("useWorkspaceFiles: no threadId set");
      const res = await fetchWithAuth(
        `/threads/${threadId}/file?path=${encodeURIComponent(path)}`,
      );
      if (!res.ok) throw new Error(`Failed to read workspace file: ${res.statusText}`);
      const data = await res.json();
      const raw = data?.data ?? data;
      return normalizeWorkspaceFiles({ [path]: raw })[path];
    },
    [fetchWithAuth, threadId],
  );

  const writeFile = useCallback(
    async (path: string, content: string) => {
      if (!threadId) throw new Error("useWorkspaceFiles: no threadId set");
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`/threads/${threadId}/file`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content }),
        });
        if (!res.ok) throw new Error(`Failed to write workspace file: ${res.statusText}`);
        const data = await res.json();
        const raw = data?.data ?? data;
        const file = normalizeWorkspaceFiles({ [path]: raw })[path];
        setFiles((prev) => ({ ...prev, [path]: file }));
        return file;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchWithAuth, threadId],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      if (!threadId) throw new Error("useWorkspaceFiles: no threadId set");
      const res = await fetchWithAuth(
        `/threads/${threadId}/file?path=${encodeURIComponent(path)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Failed to delete workspace file: ${res.statusText}`);
      setFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    },
    [fetchWithAuth, threadId],
  );

  useEffect(() => {
    if (autoFetch && threadId) {
      void fetchFiles();
    } else if (!threadId) {
      setFiles({});
    }
  }, [autoFetch, threadId, fetchFiles]);

  return {
    files,
    isLoading,
    isSaving,
    error,
    refetch: fetchFiles,
    getFile,
    writeFile,
    deleteFile,
  };
}
