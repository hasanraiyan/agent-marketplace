/**
 * Single Responsibility: Logic for retrieving and managing user preferences/memories.
 * Interface Segregation: Only expose what the agent or app needs for memory.
 */
export class MemoryService {
  constructor(agent) {
    this.agent = agent;
  }

  /**
   * Retrieves the current state of a memory file.
   * @param {string} threadId - The conversation thread.
   * @param {string} filePath - The path to the memory file.
   */
  async getMemory(threadId, filePath) {
    console.log(`[MemoryService] Fetching memory: ${filePath} for thread ${threadId}`);
    const config = { configurable: { thread_id: threadId } };
    const state = await this.agent.getState(config);
    // In a real implementation, you'd use the filesystem tool results to read the content.
    return state.values.messages.at(-1)?.content || "No memory found.";
  }

  /**
   * Resumes a paused execution with a human decision.
   * @param {string} threadId - The thread to resume.
   * @param {object} decision - The decision object (approve, reject, edit).
   */
  async handleHumanDecision(threadId, decision, CommandClass) {
    console.log(`[MemoryService] Applying human decision: ${decision.type}`);
    const config = { configurable: { thread_id: threadId } };
    return await this.agent.invoke(new CommandClass({ resume: { decisions: [decision] } }), config);
  }
}
