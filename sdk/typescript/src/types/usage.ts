/** A small preview of the Agents referencing a resource — `agentCount` is the real total. */
export interface ResourceUsage {
  /** The real total count of referencing Agents — use this, not `agents.length`. */
  agentCount: number;
  /** A preview list, capped at 20 — not necessarily every matching Agent when `agentCount > 20`. */
  agents: Array<{ _id: string; name: string }>;
}
