/** A small preview of the Agents referencing a resource — `agentCount` is the real total. */
export interface ResourceUsage {
  agentCount: number;
  agents: Array<{ _id: string; name: string }>;
}
