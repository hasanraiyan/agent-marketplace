import assert from 'node:assert/strict';
import {
  runAgentExample,
  runAgentMemoryExample,
  runChainExample,
  runDeepAgentExample,
  runLangGraphRoutingExample,
  runPromptTemplateExample,
} from '../src/ai/index.js';

async function main() {
  const prompt = await runPromptTemplateExample();
  const chain = await runChainExample();
  const agent = await runAgentExample();
  const memory = await runAgentMemoryExample();
  const graph = await runLangGraphRoutingExample();
  const deepAgent = await runDeepAgentExample();

  assert.match(prompt.output, /LangChain/i);
  assert.match(chain.output, /temperature|observability|output parsing/i);
  assert.match(agent.output, /Ada Lovelace|enterprise|eu-west-1/i);
  assert.match(memory.output, /Ada Lovelace|enterprise|preferredContact/i);
  assert.equal(graph.route, 'billing');
  assert.match(graph.answer, /billing escalation workflow/i);
  assert.match(deepAgent.output, /Deep agent smoke test completed/i);

  console.log(
    JSON.stringify(
      {
        prompt,
        chain,
        agent,
        memory,
        graph,
        deepAgent,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('AI stack verification failed.', error);
  process.exitCode = 1;
});
