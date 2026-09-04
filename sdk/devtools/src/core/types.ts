/**
 * Snapshot returned by GET __persona/devtools.
 * Shaped to cover every feature a Next.js app reaches via `@personaai/nextjs`
 * (which re-exports `@personaai/react` on `src/nextjs/src/client.ts:15` and
 * wraps `@personaai/runtime` on `src/nextjs/src/server.ts:177`).
 */
export interface DevtoolsSnapshot {
  version: string;
  timestamp: string;
  runtime: {
    mode: 'development' | 'production';
    mountPath: string;
    capabilities: Record<string, boolean>;
    routeCount: number;
    runCount: number;
    heartbeatIntervalMs: number;
  };
  routes: Array<{
    method: string;
    pattern: string;
    requiresAuth: boolean;
  }>;
  runs: Array<{
    id: string;
    startedAt: string;
    ageMs: number;
  }>;
  // Last N requests seen (redacted). Client panel polls this.
  recentRequests: Array<{
    method: string;
    path: string;
    status?: number;
    durationMs?: number;
    timestamp: string;
  }>;
  // Last N logger lines (ring buffer, level-filtered).
  recentLogs: Array<{
    level: string;
    namespace: string;
    message: string;
    meta?: Record<string, unknown>;
    timestamp: string;
  }>;
}

export interface DevtoolsStoreOptions {
  maxRecentRequests?: number;
  maxRecentLogs?: number;
}
