import { InMemoryStore, MemorySaver } from "@langchain/langgraph";
import { CompositeBackend, StateBackend, StoreBackend } from "deepagents";

/**
 * Single Responsibility: Manage persistence, checkpointer, and backends.
 *
 * Checkpointer : MemorySaver   — in-process thread state (no native deps).
 * Store        : InMemoryStore — skills/memories store.
 *
 * Upgrade path: swap MemorySaver → SqliteSaver once better-sqlite3 is
 * compiled, and InMemoryStore → a persistent store for production.
 */

export const store       = new InMemoryStore();
export const checkpointer = new MemorySaver();

// Backend routing logic
export const createBackend = (config) => new CompositeBackend(
  new StateBackend(config),
  {
    "/memories/": new StoreBackend(config),
    "/skills/":   new StoreBackend(config),
  }
);
