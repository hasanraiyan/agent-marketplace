"use client";

/**
 * useUserThreads — thin shim that delegates to the shared ThreadsContext.
 *
 * This keeps backward compatibility for any component that already calls
 * useUserThreads(). All state and fetching now lives in <ThreadsProvider>
 * (mounted at dashboard layout level), so every caller shares ONE fetch,
 * ONE state, and ONE refresh() signal — no duplicate API calls.
 */
export { useThreads as useUserThreads } from "@/components/threads-context";
