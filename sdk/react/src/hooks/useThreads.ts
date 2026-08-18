'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePersonaContext } from '../context/PersonaContext.js';
import type { PersonaThread } from '../types.js';

export function useThreads(autoFetch = true) {
  const { fetchWithAuth, defaultAgentId } = usePersonaContext();
  const [threads, setThreads] = useState<PersonaThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/threads');
      if (!res.ok) throw new Error(`Failed to list threads: ${res.statusText}`);
      const data = await res.json();
      // Real shape is { items, pagination }. Bare array / `.data` / `.threads`
      // are defensive fallbacks for other deployments, not the actual contract.
      const items: PersonaThread[] = Array.isArray(data)
        ? data
        : data?.items || data?.threads || (Array.isArray(data?.data) ? data.data : undefined) || [];
      setThreads(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  const createThread = useCallback(
    async (agentId?: string) => {
      const targetAgentId = agentId || defaultAgentId;
      const res = await fetchWithAuth('/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: targetAgentId }),
      });
      if (!res.ok) throw new Error(`Failed to create thread: ${res.statusText}`);
      const data = await res.json();
      const created = (data?.data ?? data) as PersonaThread;
      void fetchThreads();
      return created;
    },
    [fetchWithAuth, defaultAgentId, fetchThreads]
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      const res = await fetchWithAuth(`/threads/${threadId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete thread: ${res.statusText}`);
      setThreads((prev) => prev.filter((t) => t._id !== threadId));
    },
    [fetchWithAuth]
  );

  // Best-effort batch delete — no not-found id aborts the rest. Up to 100
  // ids per call, matching the server's own limit.
  const bulkDeleteThreads = useCallback(
    async (threadIds: string[]) => {
      const res = await fetchWithAuth('/threads/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: threadIds }),
      });
      if (!res.ok) throw new Error(`Failed to bulk-delete threads: ${res.statusText}`);
      const data = await res.json();
      const result = (data?.data ?? data) as { deleted: string[]; failed: Array<{ id: string; reason: string }> };
      const deletedSet = new Set(result.deleted);
      setThreads((prev) => prev.filter((t) => !deletedSet.has(t._id)));
      return result;
    },
    [fetchWithAuth]
  );

  // Convenience wrapper: there is no server-side "delete everything"
  // endpoint, only bulk-delete-by-id — so this bulk-deletes every
  // currently-loaded thread (up to 100 per call, chunked if there are more).
  const deleteAllThreads = useCallback(async () => {
    const ids = threads.map((t) => t._id);
    for (let i = 0; i < ids.length; i += 100) {
      await bulkDeleteThreads(ids.slice(i, i + 100));
    }
  }, [threads, bulkDeleteThreads]);

  // General-purpose update — { title?, isArchived? }.
  const updateThread = useCallback(
    async (threadId: string, input: { title?: string; isArchived?: boolean }) => {
      const res = await fetchWithAuth(`/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`Failed to update thread: ${res.statusText}`);
      const data = await res.json();
      const updated = (data?.data ?? data) as PersonaThread;
      setThreads((prev) => prev.map((t) => (t._id === threadId ? { ...t, ...updated } : t)));
      return updated;
    },
    [fetchWithAuth]
  );

  const renameThread = useCallback(
    (threadId: string, title: string) => updateThread(threadId, { title }),
    [updateThread]
  );

  const getThread = useCallback(
    async (threadId: string) => {
      const res = await fetchWithAuth(`/threads/${threadId}`);
      if (!res.ok) throw new Error(`Failed to fetch thread: ${res.statusText}`);
      const data = await res.json();
      return (data?.data ?? data) as PersonaThread;
    },
    [fetchWithAuth]
  );

  useEffect(() => {
    if (autoFetch) {
      void fetchThreads();
    }
  }, [autoFetch, fetchThreads]);

  return {
    threads,
    isLoading,
    error,
    refetch: fetchThreads,
    createThread,
    deleteThread,
    bulkDeleteThreads,
    deleteAllThreads,
    updateThread,
    renameThread,
    getThread,
  };
}
