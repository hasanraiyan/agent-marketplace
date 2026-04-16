import { describe, expect, test } from '@jest/globals';
import {
  runAgentExample,
  runAgentMemoryExample,
  runChainExample,
  runDeepAgentExample,
  runLangGraphRoutingExample,
  runPromptTemplateExample,
} from '../src/ai/index.js';

describe('AI stack examples', () => {
  test('runs the prompt template example', async () => {
    const result = await runPromptTemplateExample();

    expect(result.output).toMatch(/LangChain/i);
  });

  test('runs the chain example', async () => {
    const result = await runChainExample();

    expect(result.output).toMatch(/temperature|observability|output parsing/i);
  });

  test('runs the agent example with tool usage', async () => {
    const result = await runAgentExample();

    expect(result.output).toMatch(/Ada Lovelace|enterprise|eu-west-1/i);
  });

  test('persists short-term memory with a thread id', async () => {
    const result = await runAgentMemoryExample();

    expect(result.threadId).toBe('memory-demo-thread');
    expect(result.output).toMatch(/Ada Lovelace|enterprise|preferredContact/i);
  });

  test('routes a langgraph workflow deterministically', async () => {
    const result = await runLangGraphRoutingExample();

    expect(result.route).toBe('billing');
    expect(result.answer).toMatch(/billing escalation workflow/i);
  });

  test('runs a deep agent smoke test', async () => {
    const result = await runDeepAgentExample();

    expect(result.output).toMatch(/Deep agent smoke test completed/i);
  });
});
