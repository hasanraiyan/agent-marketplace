import { createDeepAgent, CompositeBackend, StateBackend, StoreBackend } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { MemorySaver, InMemoryStore, Command } from "@langchain/langgraph";
import "dotenv/config";

const getWeather = tool(
  async ({ city }) => `It is always sunny in ${city}`,
  {
    name: "get_weather",
    description: "Get weather for a city",
    schema: z.object({ city: z.string() }),
  }
);

const model = new ChatOpenAI({
  model: "gpt-5.4-nano",
  apiKey: process.env.OPENAI_API_KEY,
});

const store = new InMemoryStore();

export const agent = await createDeepAgent({
  model,
  tools: [getWeather],
  systemPrompt: "You are a helpful assistant with access to long-term memory in /memories/, multi-step planning, and dynamic skills loaded from storage.",
  checkpointer: new MemorySaver(),
  store,
  backend: (config) => new CompositeBackend(
    new StateBackend(config),
    { 
      "/memories/": new StoreBackend(config),
      "/skills/": new StoreBackend(config) 
    }
  ),
  interruptOn: { write_file: true },
  skills: ["/skills/"],
});

async function main() {
  const config = { configurable: { thread_id: "user-123" } };
  
  // Simulate loading structured skills into the store with frontmatter
  console.log("--- Simulating structured dynamic skill storage ---");
  
  const colorSkill = `---
name: color-expert
description: Expert advice on color theory, matching colors, and color psychology.
---
# Color Expert Skill
## Instructions
1. Always recommend matching colors when asked about preferences.
2. Provide brief psychological context for colors (e.g., "Blue is calming").
3. Suggest 3 complementary colors for any specific color mentioned.`;

  const mathSkill = `---
name: math-wizard
description: Advanced mathematical problem solving and formula explanations.
---
# Math Wizard Skill
## Instructions
1. Explain the logic behind mathematical operations.
2. Use LaTeX-like formatting for formulas where appropriate.
3. Offer to break down complex problems into steps.`;

  const skillsToLoad = [
    { id: "color-expert", content: colorSkill },
    { id: "math-wizard", content: mathSkill }
  ];

  for (const skill of skillsToLoad) {
    await store.put(
      ["filesystem"], 
      `/skills/${skill.id}/SKILL.md`, 
      { 
        content: Buffer.from(skill.content).toString("base64"),
        encoding: "base64"
      }
    );
  }

  // Demonstration: Advanced HITL (Reject with Feedback and Edit)
  console.log("\n--- Advanced HITL Demo: Reject with Feedback ---");
  const hitlConfig = { configurable: { thread_id: "hitl-demo-456" } };
  
  // 1. Propose an action
  console.log("Proposing a file write...");
  await agent.invoke({
    messages: [{ role: "user", content: "Write 'Hello World' to /memories/hello.txt" }]
  }, hitlConfig);

  // 2. Reject with feedback
  console.log("Interrupt detected! Rejecting with feedback: 'Please write in Spanish instead.'");
  await agent.invoke(new Command({ 
    resume: { 
      decisions: [{ 
        type: "reject", 
        message: "Please write in Spanish instead." 
      }] 
    } 
  }), hitlConfig);

  // 3. The agent will now try to write in Spanish. Let's see what it proposes.
  let hitlState = await agent.getState(hitlConfig);
  if (hitlState.next && hitlState.next.length > 0) {
    console.log("Interrupt detected on second attempt! Editing the proposed Spanish content...");
    
    // Find the pending write_file call in the tasks
    const pendingTask = hitlState.values.tasks?.find(t => t.calls && t.calls.some(c => c.name === "write_file"));
    const pendingCall = pendingTask?.calls.find(c => c.name === "write_file");
    
    if (pendingCall) {
      await agent.invoke(new Command({ 
        resume: { 
          decisions: [{ 
            type: "edit", 
            edited_action: {
              name: "write_file",
              args: {
                path: "/memories/hello.txt",
                content: (pendingCall.args.content || "Hola Mundo") + " (Edited by Human)"
              }
            }
          }] 
        } 
      }), hitlConfig);
    } else {
      console.log("Could not find pending write_file call, approving instead...");
      await agent.invoke(new Command({ resume: { decisions: [{ type: "approve" }] } }), hitlConfig);
    }
  }

  // 4. Final approval to finish the execution
  hitlState = await agent.getState(hitlConfig);
  while (hitlState.next && hitlState.next.length > 0) {
    console.log("Final approval for the edited action...");
    await agent.invoke(new Command({ resume: { decisions: [{ type: "approve" }] } }), hitlConfig);
    hitlState = await agent.getState(hitlConfig);
  }

  const finalResult = await agent.getState(hitlConfig);
  console.log("\nFinal Content of /memories/hello.txt (simulated):");
  console.log(JSON.stringify(finalResult.values.messages.at(-1)?.content, null, 2));
}

if (process.argv[1] === import.meta.filename) {
  main().catch(console.error);
}
