'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DevtoolsSnapshot } from '../core/types.js';

export interface UseDevtoolsOptions {
  /** Base URL of the devtools endpoint, e.g. "/api/persona" or "https://api.example.com/api/persona". Pass "" to disable polling. */
  baseUrl?: string;
  /** Poll interval ms. 0 = manual only. */
  intervalMs?: number;
  /** When false, do not auto-poll (still exposes refetch). */
  enabled?: boolean;
}

export function useDevtoolsSnapshot(options: UseDevtoolsOptions = {}) {
  const { baseUrl = '', intervalMs = 3000, enabled = true } = options;
  const [snapshot, setSnapshot] = useState<DevtoolsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!baseUrl) return null;
    setIsLoading(true);
    setError(null);
    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/__persona/devtools`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 404) {
        // Server devtools not mounted — not an error, just client-only mode.
        // Stop further polling by returning null without setting error.
        setError(null);
        return null;
      }
      if (!res.ok) throw new Error(`Devtools fetch ${res.status}: ${res.statusText}`);
      const data = (await res.json()) as DevtoolsSnapshot;
      setSnapshot(data);
      return data;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!enabled || !baseUrl || intervalMs === 0) return;
    void fetchSnapshot();
    const id = setInterval(() => void fetchSnapshot(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, baseUrl, intervalMs, fetchSnapshot]);

  return { snapshot, isLoading, error, refetch: fetchSnapshot };
}
