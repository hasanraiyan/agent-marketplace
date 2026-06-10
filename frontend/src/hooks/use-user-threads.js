"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getThreads, deleteThread, updateThreadTitle } from "@/lib/api/threads";

/**
 * Groups a flat threads array by their associated agent.
 * @param {Array} threads - Array of thread objects with populated agentId.
 * @returns {Array} - Array of { agent, threads[] } groups, sorted by agent name.
 */
function groupThreadsByAgent(threads) {
  const map = {};
  for (const thread of threads) {
    const agent = thread.agentId;
    if (!agent) continue;
    const agentKey = agent._id || agent.id;
    if (!map[agentKey]) {
      map[agentKey] = { agent, threads: [] };
    }
    map[agentKey].threads.push(thread);
  }
  return Object.values(map).sort((a, b) =>
    (a.agent.name || "").localeCompare(b.agent.name || "")
  );
}

/**
 * useUserThreads - Fetches and manages user threads grouped by agent.
 *
 * Returns:
 *   groups        - Array<{ agent: {...}, threads: Thread[] }>
 *   loading       - Boolean
 *   error         - String | null
 *   refresh       - () => void  — call after creating a new thread
 *   renameThread  - (threadId, title) => Promise<void>
 *   removeThread  - (threadId) => Promise<void>
 */
export function useUserThreads() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Use a counter to allow forced refetches without changing the dep array
  const [fetchTick, setFetchTick] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    // Cancel any in-flight request
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
  }, [fetchTick]);

  const refresh = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  const renameThread = useCallback(async (threadId, title) => {
    // Optimistic update
    setThreads((prev) =>
      prev.map((t) =>
        (t._id === threadId || t.id === threadId) ? { ...t, title } : t
      )
    );
    try {
      await updateThreadTitle(threadId, { title });
    } catch (err) {
      // Revert on error by refreshing
      setFetchTick((t) => t + 1);
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
      // Revert on error
      setFetchTick((t) => t + 1);
      throw err;
    }
  }, []);

  const groups = groupThreadsByAgent(threads);

  return { groups, loading, error, refresh, renameThread, removeThread };
}
