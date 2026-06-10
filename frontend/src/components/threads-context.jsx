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
  searchThreads,
  getAgentSummary,
  deleteThread,
  updateThreadTitle,
  deleteAllThreads,
} from "@/lib/api/threads";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupThreadsByAgent(threads, agentSummary = [], isSearching = false) {
  const map = {};

  // If we are NOT searching, initialize map with all agents from the summary
  // to ensure they appear even if no threads have been loaded for them yet.
  if (!isSearching) {
    for (const item of agentSummary) {
      const key = item.agentId;
      map[key] = {
        agent: {
          _id: item.agentId,
          name: item.name,
          avatar: item.avatar,
          slug: item.slug,
        },
        threads: [],
        totalCount: item.totalThreads,
        lastInteractionAt: new Date(item.lastInteractionAt),
      };
    }
  }

  for (const thread of threads) {
    const agent = thread.agentId;
    if (!agent) continue;
    const key = agent._id || agent.id;
    if (!map[key]) {
      map[key] = {
        agent,
        threads: [],
        totalCount: 0,
        lastInteractionAt: new Date(thread.lastMessageAt || 0),
      };
    }
    // Avoid duplicates if a thread was already added
    if (
      !map[key].threads.some((t) => (t._id || t.id) === (thread._id || thread.id))
    ) {
      map[key].threads.push(thread);
    }
  }

  // Sort threads inside each agent group by lastMessageAt descending
  for (const key in map) {
    map[key].threads.sort((a, b) => {
      const aDate = new Date(a.lastMessageAt || a.createdAt || 0);
      const bDate = new Date(b.lastMessageAt || b.createdAt || 0);
      return bDate - aDate;
    });
  }

  // Sort agent groups by their lastInteractionAt descending (most active first)
  return Object.values(map).sort((a, b) => {
    return b.lastInteractionAt - a.lastInteractionAt;
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
  const [agentSummary, setAgentSummary] = useState([]);
  const [totalThreads, setTotalThreads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const lastFetchTickRef = useRef(fetchTick);

  // Load agent summary independently (only once or on refresh)
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      getAgentSummary()
        .then((res) => {
          setAgentSummary(res.data?.data || []);
        })
        .catch(console.error);
    }
  }, [isLoaded, isSignedIn, fetchTick]);

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
    if (!isLoaded || isSearching) return;

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
          const total = res.data?.meta?.total || 0;
          setTotalThreads(total);

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
          setHasMore(total > page * limit);
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
  }, [isLoaded, isSignedIn, page, fetchTick, isSearching]);

  // Handle searching
  useEffect(() => {
    if (!searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        setIsSearching(false);
        setSearchResults([]);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      searchThreads({ q: searchQuery, limit: 50 })
        .then((res) => {
          setSearchResults(res.data?.data || []);
        })
        .catch((err) => {
          console.error("Search failed:", err);
        })
        .finally(() => {
          // Keep isSearching true to show results instead of paginated list
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

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

  const displayedThreads = isSearching ? searchResults : threads;
  const groups = groupThreadsByAgent(displayedThreads, agentSummary, isSearching);

  return (
    <ThreadsContext.Provider
      value={{
        groups,
        totalThreads,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        error,
        refresh,
        renameThread,
        removeThread,
        removeAllThreads,
        searchQuery,
        setSearchQuery,
        isSearching,
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
