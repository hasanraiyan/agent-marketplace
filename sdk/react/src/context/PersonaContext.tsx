'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { PersonaProviderProps } from '../types.js';

interface PersonaContextValue {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
  defaultAgentId?: string;
  fetchWithAuth: (path: string, init?: RequestInit) => Promise<Response>;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({
  baseUrl,
  getAuthToken,
  defaultAgentId,
  children,
}: PersonaProviderProps) {
  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/+$/, ''), [baseUrl]);

  const value = useMemo<PersonaContextValue>(() => {
    async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
      const token = getAuthToken ? await getAuthToken() : null;
      const headers = new Headers(init.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const url = `${normalizedBaseUrl}${cleanPath}`;

      return fetch(url, {
        ...init,
        headers,
      });
    }

    return {
      baseUrl: normalizedBaseUrl,
      getAuthToken,
      defaultAgentId,
      fetchWithAuth,
    };
  }, [normalizedBaseUrl, getAuthToken, defaultAgentId]);

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersonaContext(): PersonaContextValue {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersonaContext must be used within a <PersonaProvider>');
  }
  return context;
}
