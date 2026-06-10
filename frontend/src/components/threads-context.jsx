"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { getThreads, deleteThread, updateThreadTitle } from "@/lib/api/threads";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupThreadsByAgent(threads) {
  const map = {};
  for (const thread of threads) {
    const agent = thread.agentId;
    if (!agent) continue;
    const key = agent._id || agent.id;
    if (!map[key]) map[key] = { agent, threads: [] };
    map[key].threads.push(thread);
  }
  return Object.values(map).sort((a, b) =>
    (a.agent.name || "").localeCompare(b.agent.name || "")
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThreadsContext = createContext(null);

/**
 * ThreadsProvider — single source of truth for the user's thread list.
 *
 * Mount once at dashboard layout level. All children share the same data.
 * Waits for Clerk `isLoaded` before the first fetch so the auth token is
 * guaranteed to be available, eliminating the 401-on-mount race condition.
 */
export function ThreadsProvider({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fetchTick, setFetchTick] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    // Don't fire until Clerk has resolved auth state
    if (!isLoaded) return;

    // Unauthenticated users: clear and stop
    if (!isSignedIn) {
      setThreads([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    getThreads()
      .then((res) => {
        if (!controller.signal.aborted) {
          setThreads(res.data?.data || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err?.response?.data?.message || "Failed to load threads");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [isLoaded, isSignedIn, fetchTick]);

  const refresh = useCallback(() => setFetchTick((t) => t + 1), []);

  const renameThread = useCallback(async (threadId, title) => {
    // Optimistic update
    setThreads((prev) =>
      prev.map((t) =>
        t._id === threadId || t.id === threadId ? { ...t, title } : t
      )
    );
    try {
      await updateThreadTitle(threadId, { title });
    } catch (err) {
      setFetchTick((t) => t + 1); // revert
      throw err;
    }
  }, []);

  const removeThread = useCallback(async (threadId) => {
    // Optimistic update
    setThreads((prev) =>
      prev.filter((t) => t._id !== threadId && t.id !== threadId)
    );
    try {
      await deleteThread(threadId);
    } catch (err) {
      setFetchTick((t) => t + 1); // revert
      throw err;
    }
  }, []);

  const groups = groupThreadsByAgent(threads);

  return (
    <ThreadsContext.Provider
      value={{ groups, loading, error, refresh, renameThread, removeThread }}
    >
      {children}
    </ThreadsContext.Provider>
  );
}

/**
 * useThreads — consume the shared threads context.
 * Must be used inside a <ThreadsProvider>.
 */
export function useThreads() {
  const ctx = useContext(ThreadsContext);
  if (!ctx) {
    throw new Error("useThreads must be used within a <ThreadsProvider>");
  }
  return ctx;
}
