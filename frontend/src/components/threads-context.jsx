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
import {
  getThreads,
  deleteThread,
  updateThreadTitle,
  deleteAllThreads,
} from "@/lib/api/threads";

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

  // Sort threads inside each agent group by lastMessageAt descending
  for (const key in map) {
    map[key].threads.sort((a, b) => {
      const aDate = new Date(a.lastMessageAt || a.createdAt || 0);
      const bDate = new Date(b.lastMessageAt || b.createdAt || 0);
      return bDate - aDate;
    });
  }

  // Sort agent groups by the lastMessageAt of their most recent thread descending (most active first)
  return Object.values(map).sort((a, b) => {
    const aLatest = new Date(
      a.threads[0]?.lastMessageAt || a.threads[0]?.createdAt || 0,
    );
    const bLatest = new Date(
      b.threads[0]?.lastMessageAt || b.threads[0]?.createdAt || 0,
    );
    return bLatest - aLatest;
  });
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThreadsContext = createContext(null);

/**
 * ThreadsProvider — single source of truth for the user's thread list.
 * Supports paginated loading, infinite scroll, and recency sorting.
 */
export function ThreadsProvider({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);

  const lastFetchTickRef = useRef(fetchTick);

  // When Clerk Auth loads or user triggers a reset/refresh, reset page and clear threads
  useEffect(() => {
    if (isLoaded) {
      setTimeout(() => {
        setPage(1);
        setThreads([]);
        setHasMore(true);
      }, 0);
    }
  }, [isLoaded, isSignedIn, fetchTick]);

  // Load threads for current page
  useEffect(() => {
    if (!isLoaded) return;

    const tickChanged = lastFetchTickRef.current !== fetchTick;
    lastFetchTickRef.current = fetchTick;

    if (tickChanged && page !== 1) {
      // Skip this execution as page state will soon reset to 1 asynchronously
      return;
    }

    if (!isSignedIn) {
      setTimeout(() => {
        setThreads([]);
        setLoading(false);
        setLoadingMore(false);
      }, 0);
      return;
    }

    const controller = new AbortController();
    const limit = 20;

    const isInitial = page === 1;
    setTimeout(() => {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
    }, 0);

    getThreads({ page, limit })
      .then((res) => {
        if (!controller.signal.aborted) {
          const newThreads = res.data?.data || [];
          setThreads((prev) => {
            if (isInitial) {
              return newThreads;
            } else {
              // Deduplicate threads in case of state overlap
              const existingIds = new Set(prev.map((t) => t._id || t.id));
              const filteredNew = newThreads.filter(
                (t) => !existingIds.has(t._id || t.id),
              );
              return [...prev, ...filteredNew];
            }
          });
          setHasMore(newThreads.length === limit);
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
          setLoadingMore(false);
        }
      });

    return () => controller.abort();
  }, [isLoaded, isSignedIn, page, fetchTick]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setPage((p) => p + 1);
  }, [loading, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  const renameThread = useCallback(async (threadId, title) => {
    // Optimistic update
    setThreads((prev) =>
      prev.map((t) =>
        t._id === threadId || t.id === threadId ? { ...t, title } : t,
      ),
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
      prev.filter((t) => t._id !== threadId && t.id !== threadId),
    );
    try {
      await deleteThread(threadId);
    } catch (err) {
      setFetchTick((t) => t + 1); // revert
      throw err;
    }
  }, []);

  const removeAllThreads = useCallback(async () => {
    // Optimistic update
    setThreads([]);
    try {
      await deleteAllThreads();
    } catch (err) {
      setFetchTick((t) => t + 1); // revert
      throw err;
    }
  }, []);

  const groups = groupThreadsByAgent(threads);

  return (
    <ThreadsContext.Provider
      value={{
        groups,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        error,
        refresh,
        renameThread,
        removeThread,
        removeAllThreads,
      }}
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
