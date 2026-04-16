import { createDeepAgent } from "deepagents";

/**
 * Single Responsibility: Assemble the agent by injecting its dependencies.
 * Dependency Inversion Principle: AgentFactory depends on abstractions (config, tools, memory).
 */
export async function createAgent({ model, tools, store, checkpointer, backend, skills, subagents = [] }) {
  return await createDeepAgent({
    model,
    tools,
    store,
    checkpointer,
    backend,
    skills,
    subagents,
    systemPrompt: "You are a professional assistant with dynamic skills, long-term memory, and multi-step planning. Use your tools whenever needed. Critical operations like writing files will be paused for human approval automatically, so do not ask for permission in text; just call the tool.",
    interruptOn: { write_file: true },
  });
}
