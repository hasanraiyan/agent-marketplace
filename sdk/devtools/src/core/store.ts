import type { DevtoolsSnapshot, DevtoolsStoreOptions } from './types.js';

type RequestEntry = DevtoolsSnapshot['recentRequests'][number];
type LogEntry = DevtoolsSnapshot['recentLogs'][number];

export interface DevtoolsStore {
  pushRequest(entry: Omit<RequestEntry, 'timestamp'>): void;
  pushLog(entry: Omit<LogEntry, 'timestamp'>): void;
  getRecentRequests(): RequestEntry[];
  getRecentLogs(): LogEntry[];
  getSnapshot(partial: Omit<DevtoolsSnapshot, 'recentRequests' | 'recentLogs' | 'timestamp' | 'version'>): DevtoolsSnapshot;
}

export function createDevtoolsStore(options: DevtoolsStoreOptions = {}): DevtoolsStore {
  const maxRequests = options.maxRecentRequests ?? 50;
  const maxLogs = options.maxRecentLogs ?? 100;

  const requests: RequestEntry[] = [];
  const logs: LogEntry[] = [];

  return {
    pushRequest(entry) {
      requests.unshift({ ...entry, timestamp: new Date().toISOString() });
      if (requests.length > maxRequests) requests.length = maxRequests;
    },
    pushLog(entry) {
      logs.unshift({ ...entry, timestamp: new Date().toISOString() });
      if (logs.length > maxLogs) logs.length = maxLogs;
    },
    getRecentRequests() {
      return [...requests];
    },
    getRecentLogs() {
      return [...logs];
    },
    getSnapshot(partial) {
      return {
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        ...partial,
        recentRequests: [...requests],
        recentLogs: [...logs],
      };
    },
  };
}
