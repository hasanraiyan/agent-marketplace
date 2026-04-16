import { InMemoryStore, MemorySaver } from "@langchain/langgraph";
import { CompositeBackend, StateBackend, StoreBackend } from "deepagents";

/**
 * Single Responsibility: Manage persistence, checkpointer, and backends.
 */

// Dependency Injection: Can be swapped for PostgresStore in production
export const store = new InMemoryStore();
export const checkpointer = new MemorySaver();

// Backend routing logic
export const createBackend = (config) => new CompositeBackend(
  new StateBackend(config),
  {
    "/memories/": new StoreBackend(config),
    "/skills/": new StoreBackend(config)
  }
);
