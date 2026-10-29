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

/** Structured, trackable details of a non-ok API response. */
export interface PersonaHttpFailureInfo {
  status: number;
  code?: string;
  message?: string;
}

/** A Response whose error body has been parsed and attached by fetchWithAuth. */
export interface PersonaFailureResponse extends Response {
  personaError?: PersonaHttpFailureInfo;
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
          // Parse the error body so failures are trackable (`code` +
          // `message`, e.g. NOT_FOUND "Agent not found") instead of only a
          // status number — and attach them on the Response for callers so
          // they never have to re-parse (see PersonaFailureResponse).
          const parsedResult: {
            info?: PersonaHttpFailureInfo;
            isJson: boolean;
          } = { isJson: false };
          try {
            const body = (await res.clone().json()) as {
              error?: { code?: string; message?: string };
              message?: string;
            };
            if (body && typeof body === "object") {
              const message =
                body.error?.message ?? body.message ?? undefined;
              if (body.error?.code ?? message) {
                parsedResult.isJson = true;
                parsedResult.info = {
                  status: res.status,
                  code: body.error?.code,
                  message,
                };
              }
            }
          } catch {
            // body isn't JSON (HTML error page, empty body) — nothing to
            // attach, callers fall back to status/statusText as before.
          }
          logger.warn("fetchWithAuth non-ok", {
            path: cleanPath,
            status: res.status,
            ...(parsedResult.info ?? {}),
          });
          if (parsedResult.info) {
            try {
              (res as PersonaFailureResponse).personaError =
                parsedResult.info;
            } catch {
              // Response engines that reject expando properties — logging
              // above already carries full detail.
            }
          }
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
