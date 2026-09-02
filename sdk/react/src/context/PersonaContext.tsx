"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { PersonaProviderProps } from "../types.js";
import { createLogger, type Logger } from "@personaai/logger";

interface PersonaContextValue {
  baseUrl: string;
  getAuthToken?: () =>
    Promise<string | null | undefined> | string | null | undefined;
  defaultAgentId?: string;
  fetchWithAuth: (path: string, init?: RequestInit) => Promise<Response>;
  logger: Logger;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({
  baseUrl,
  getAuthToken,
  defaultAgentId,
  logLevel,
  logger: loggerProp,
  children,
}: PersonaProviderProps) {
  const normalizedBaseUrl = useMemo(
    () => baseUrl.replace(/\/+$/, ""),
    [baseUrl],
  );

  const logger = useMemo<Logger>(() => {
    const l =
      loggerProp ??
      createLogger(
        "react",
        logLevel !== undefined ? { level: logLevel } : undefined,
      );
    l.debug("PersonaProvider created", {
      baseUrl: normalizedBaseUrl,
      hasDefaultAgentId: !!defaultAgentId,
    });
    l.info("PersonaProvider mounted", { baseUrl: normalizedBaseUrl });
    l.trace("PersonaProvider config", {
      baseUrl: normalizedBaseUrl,
      hasGetAuthToken: !!getAuthToken,
    });
    return l;
  }, [loggerProp, logLevel, normalizedBaseUrl, defaultAgentId, getAuthToken]);

  const value = useMemo<PersonaContextValue>(() => {
    async function fetchWithAuth(
      path: string,
      init: RequestInit = {},
    ): Promise<Response> {
      const token = getAuthToken ? await getAuthToken() : null;
      const headers = new Headers(init.headers || {});
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        logger.trace("fetchWithAuth with token", { path });
      } else {
        logger.trace("fetchWithAuth without token", { path });
        logger.debug("fetchWithAuth no token", { path });
      }

      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${normalizedBaseUrl}${cleanPath}`;
      logger.debug("fetchWithAuth request", {
        path: cleanPath,
        url,
        hasToken: !!token,
      });
      logger.trace("fetchWithAuth details", {
        url,
        path: cleanPath,
        hasToken: !!token,
      });

      try {
        const res = await fetch(url, {
          ...init,
          headers,
        });
        logger.debug("fetchWithAuth response", {
          path: cleanPath,
          status: res.status,
          ok: res.ok,
        });
        if (!res.ok) {
          logger.warn("fetchWithAuth non-ok", {
            path: cleanPath,
            status: res.status,
          });
        } else {
          logger.info("fetchWithAuth succeeded", {
            path: cleanPath,
            status: res.status,
          });
        }
        return res;
      } catch (err) {
        logger.error("fetchWithAuth failed", {
          path: cleanPath,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }

    return {
      baseUrl: normalizedBaseUrl,
      getAuthToken,
      defaultAgentId,
      fetchWithAuth,
      logger,
    };
  }, [normalizedBaseUrl, getAuthToken, defaultAgentId, logger]);

  return (
    <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>
  );
}

export function usePersonaContext(): PersonaContextValue {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error(
      "usePersonaContext must be used within a <PersonaProvider>",
    );
  }
  return context;
}
