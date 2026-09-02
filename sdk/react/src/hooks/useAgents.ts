"use client";

import { useCallback, useEffect, useState } from "react";
import { usePersonaContext } from "../context/PersonaContext.js";

export interface PersonaAgentSummary {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  tagline?: string;
  avatar?: string;
}

export function useAgents(autoFetch = true) {
  const { fetchWithAuth } = usePersonaContext();
  const [agents, setAgents] = useState<PersonaAgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/agents");
      if (!res.ok) throw new Error(`Failed to list agents: ${res.statusText}`);
      const data = await res.json();
      // Real shape is { items, pagination }.
      const items: PersonaAgentSummary[] = Array.isArray(data)
        ? data
        : data?.items || data?.agents || [];
      setAgents(items);
      return items;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (autoFetch) {
      void fetchAgents();
    }
  }, [autoFetch, fetchAgents]);

  return {
    agents,
    isLoading,
    error,
    refetch: fetchAgents,
  };
}
