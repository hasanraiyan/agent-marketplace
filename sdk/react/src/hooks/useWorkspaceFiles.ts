"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";
import type { PersonaMemoryFile, PersonaWorkspaceFile } from "../types.js";

export type { PersonaWorkspaceFile };

function toWorkspaceFile(file: PersonaMemoryFile): PersonaWorkspaceFile {
  return {
    content: file.content,
    size: file.content.length,
    createdAt: file.createdAt ?? null,
    modifiedAt: file.updatedAt ?? null,
  };
}

/**
 * CRUD over one Agent's `/workspace/` files — the SAME persistent store a
 * `write_file`/`read_file` tool call under `/workspace/...` actually reads
 * and writes (deepagents routes that path prefix to a Mongo-backed memory
 * store, NOT the LangGraph checkpoint's `files` state channel — a Thread's
 * live/checkpointed state is a different, much narrower thing that rarely
 * has anything in it, since agents are instructed to write all real output
 * under `/workspace/outputs/`). Scoped by Agent + Subject: shared across
 * every Thread that Subject has with that Agent, not private to one
 * conversation — the same model the platform's own Files panel uses.
 *
 * Thin wrapper over `client.memory` (`scope: "workspace"`) — no parallel
 * type vocabulary, `PersonaWorkspaceFile` here is just `PersonaMemoryFile`
 * reshaped to the `{content, size, createdAt, modifiedAt}` display shape
 * `useChat()`'s own (read-only, live-run) `files` snapshot already uses.
 */
export function useWorkspaceFiles(agentId: string | undefined, autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [files, setFiles] = useState<Record<string, PersonaWorkspaceFile>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!agentId) return {};
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/memory");
      if (!res.ok) throw new Error(`Failed to list workspace files: ${res.statusText}`);
      const data = await res.json();
      const body = data?.data ?? data;
      const group = (body?.agentWorkspaces ?? []).find(
        (g: { agentId: string }) => g.agentId === agentId,
      );
      const normalized: Record<string, PersonaWorkspaceFile> = {};
      for (const file of group?.files ?? []) {
        normalized[file.path] = toWorkspaceFile(file);
      }
      setFiles(normalized);
      return normalized;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth, agentId]);

  const getFile = useCallback(
    async (path: string) => {
      if (!agentId) throw new Error("useWorkspaceFiles: no agentId set");
      const query = new URLSearchParams({ path, scope: "workspace", agentId });
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to read workspace file: ${res.statusText}`);
      const data = await res.json();
      const raw = (data?.data ?? data) as PersonaMemoryFile;
      return toWorkspaceFile(raw);
    },
    [fetchWithAuth, agentId],
  );

  const writeFile = useCallback(
    async (path: string, content: string) => {
      if (!agentId) throw new Error("useWorkspaceFiles: no agentId set");
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetchWithAuth("/memory/file", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, content, scope: "workspace", agentId }),
        });
        if (!res.ok) throw new Error(`Failed to write workspace file: ${res.statusText}`);
        const data = await res.json();
        const raw = (data?.data ?? data) as PersonaMemoryFile;
        const file = toWorkspaceFile(raw);
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
    [fetchWithAuth, agentId],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      if (!agentId) throw new Error("useWorkspaceFiles: no agentId set");
      const query = new URLSearchParams({ path, scope: "workspace", agentId });
      const res = await fetchWithAuth(`/memory/file?${query.toString()}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete workspace file: ${res.statusText}`);
      setFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    },
    [fetchWithAuth, agentId],
  );

  useEffect(() => {
    if (autoFetch && agentId) {
      void fetchFiles();
    } else if (!agentId) {
      setFiles({});
    }
  }, [autoFetch, agentId, fetchFiles]);

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
