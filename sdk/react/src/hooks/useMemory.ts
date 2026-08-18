'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePersonaContext } from '../context/PersonaContext.js';
import type { PersonaMemoryFile, PersonaMemoryList } from '../types.js';

export function useMemory(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [memory, setMemory] = useState<PersonaMemoryList>({ userFiles: [], agentMemories: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMemory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/memory');
      if (!res.ok) {
        throw new Error(`Failed to fetch memory: ${res.statusText}`);
      }
      const data = (await res.json()) as PersonaMemoryList;
      setMemory(data);
      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return { userFiles: [], agentMemories: [] };
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  const getFile = useCallback(
    async (params: { path: string; scope?: 'user' | 'agent'; agentId?: string }) => {
      const query = new URLSearchParams({ path: params.path });
      if (params.scope) query.set('scope', params.scope);
      if (params.agentId) query.set('agentId', params.agentId);

      const res = await fetchWithAuth(`/memory/file?${query.toString()}`);
      if (!res.ok) throw new Error(`Failed to get memory file: ${res.statusText}`);
      return (await res.json()) as PersonaMemoryFile;
    },
    [fetchWithAuth]
  );

  const writeFile = useCallback(
    async (params: { path: string; content: string; scope?: 'user' | 'agent'; agentId?: string }) => {
      const res = await fetchWithAuth('/memory/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`Failed to write memory file: ${res.statusText}`);
      const updated = (await res.json()) as PersonaMemoryFile;
      void fetchMemory();
      return updated;
    },
    [fetchWithAuth, fetchMemory]
  );

  const deleteFile = useCallback(
    async (params: { path: string; scope?: 'user' | 'agent'; agentId?: string }) => {
      const query = new URLSearchParams({ path: params.path });
      if (params.scope) query.set('scope', params.scope);
      if (params.agentId) query.set('agentId', params.agentId);

      const res = await fetchWithAuth(`/memory/file?${query.toString()}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to delete memory file: ${res.statusText}`);
      void fetchMemory();
    },
    [fetchWithAuth, fetchMemory]
  );

  useEffect(() => {
    if (autoFetch) {
      void fetchMemory();
    }
  }, [autoFetch, fetchMemory]);

  return {
    memory,
    isLoading,
    error,
    refetch: fetchMemory,
    getFile,
    writeFile,
    deleteFile,
  };
}
