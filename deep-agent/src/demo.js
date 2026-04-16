import { agent } from "./index.js";
import { store } from "./memory.js";
import { Command } from "@langchain/langgraph";
import { SkillService } from "./services/SkillService.js";
import { MemoryService } from "./services/MemoryService.js";

/**
 * SOLID Refactor: Use specialized services to handle different concerns.
 * SRP: demo.js only handles orchestration of the demo workflow.
 */

async function main() {
  const threadId = "demo-thread-789";
  const config = { configurable: { thread_id: threadId } };

  // 1. Initialize Services
  const skillService = new SkillService(store);
  const memoryService = new MemoryService(agent);

  // 2. Load Skills via SkillService (SRP)
  console.log("\n--- [Demo] Initializing Skills ---");
  const colorSkill = `---
name: color-expert
description: Expert advice on color theory and matching colors.
---
# Color Expert Skill
Suggest 3 matching colors for any specific color mentioned.`;

  await skillService.loadSkill("color-expert", colorSkill);

  // 3. Propose Action (HITL Demo)
  console.log("\n--- [Demo] Proposing Action ---");
  await agent.invoke({
    messages: [{ role: "user", content: "Write 'Hello SOLID Services' to /memories/solid.txt" }]
  }, config);

  // 4. Handle Rejection via MemoryService (SRP)
  console.log("\n--- [Demo] Handling Rejection ---");
  console.log("Interrupt detected! Rejecting with feedback: 'Use uppercase Spanish.'");
  await memoryService.handleHumanDecision(threadId, { 
    type: "reject", 
    message: "Por favor escribe en ESPAÑOL y todo en MAYÚSCULAS." 
  }, Command);

  // 5. Handle Final Approval via MemoryService (SRP)
  let state = await agent.getState(config);
  while (state.next && state.next.length > 0) {
    const pendingCall = state.values.tasks?.find(t => t.calls && t.calls.length > 0)?.calls[0];
    if (pendingCall) {
      console.log(`Agent re-proposed: ${pendingCall.name} with args:`, JSON.stringify(pendingCall.args));
    }
    console.log("Final approval for the updated action...");
    await memoryService.handleHumanDecision(threadId, { type: "approve" }, Command);
    state = await agent.getState(config);
  }

  // 6. Verify Results
  console.log("\n--- [Demo] Verifying Results ---");
  const finalContent = await memoryService.getMemory(threadId, "/memories/solid.txt");
  console.log("Final Output:", JSON.stringify(finalContent, null, 2));
}

main().catch(console.error);
