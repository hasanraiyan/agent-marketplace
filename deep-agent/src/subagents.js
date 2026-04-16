import { searchWeb } from "./tools.js";

/**
 * Single Responsibility: Define and export all sub-agent specifications.
 *
 * Sub-agents are ephemeral, task-focused agents spawned by the main agent
 * via the built-in `task` tool. Each has an isolated context and returns
 * a single result to the parent agent.
 *
 * Reference: SubAgent interface from `deepagents`
 *   - name        : identifier used by the `task` tool for routing
 *   - description : shown to the model so it knows when to delegate here
 *   - systemPrompt: the sub-agent's own instruction set
 *   - tools       : (optional) override the default tool set
 *   - skills      : (optional) skill-directory paths for this sub-agent
 */

/**
 * Researcher sub-agent.
 *
 * Handles all tasks that require live web searches, fact-finding, or
 * gathering up-to-date information from the internet. The main agent
 * delegates research tasks here so its own context stays clean.
 */
export const researcherSubagent = {
  name: "researcher",
  description:
    "Expert research agent. Use this sub-agent for any task that requires " +
    "searching the web, finding current information, verifying facts, " +
    "gathering news, or summarising online resources. Do NOT use it for " +
    "tasks the main agent can answer directly from its training data.",
  systemPrompt:
    "You are an expert research assistant with live access to the web. " +
    "Your only job is to find accurate, up-to-date information using the " +
    "search_web tool. Always search before answering. Summarise your " +
    "findings clearly and cite the key sources you used.",
  tools: [searchWeb],
};

/**
 * All sub-agents registered with the main agent.
 * Import this array in index.js and pass it to createAgent().
 */
export const subagents = [researcherSubagent];
