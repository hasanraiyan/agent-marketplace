import type { DevtoolsStore } from './store.js';
import type { DevtoolsSnapshot } from './types.js';

/**
 * Creates a handler for GET __persona/devtools.
 * The runtime calls this when `devtools: true` (or `PERSONA_DEVTOOLS=1`).
 * It is framework-agnostic — adapters just translate their Request/Response
 * to the runtime's `RuntimeRequest`/`RuntimeResponse` and delegate here.
 */
export interface CreateDevtoolsHandlerOptions {
  store: DevtoolsStore;
  /** Lazy snapshot builder — reads live runtime state (routes, runs, caps). */
  getSnapshot: () => Omit<DevtoolsSnapshot, 'recentRequests' | 'recentLogs' | 'timestamp' | 'version'>;
}

export function createDevtoolsHandler(options: CreateDevtoolsHandlerOptions) {
  const { store, getSnapshot } = options;

  return {
    // For runtime's `Route` handler signature: (req, ctx) => Promise<RuntimeResponse>
    async handle(): Promise<{ status: number; headers: Record<string, string>; body: string }> {
      const snapshot = store.getSnapshot(getSnapshot());
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(snapshot, null, 2),
      };
    },
    // Exposed for adapters that need raw snapshot without HTTP wrapping
    getSnapshot() {
      return store.getSnapshot(getSnapshot());
    },
    store,
  };
}
