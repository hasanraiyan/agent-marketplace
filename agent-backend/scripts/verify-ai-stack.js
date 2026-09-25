import assert from 'node:assert/strict';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { StateGraph, Annotation, MemorySaver } from '@langchain/langgraph';
import { GoogleGenAI } from '@google/genai';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';
import { sanitizeToolsForGemini } from '../src/modules/agents/sanitizeToolsForGemini.js';
import { frameAudioForClient } from '../src/modules/voice/gateway/audioFraming.js';

async function verifyAiStack() {
  console.log('Verifying AI stack components...');

  // 1. LangChain messages & tools
  const tool = new DynamicStructuredTool({
    name: 'test_calculator',
    description: 'Adds two numbers',
    schema: z.object({
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
    func: async ({ a, b }) => String(a + b),
  });

  const toolOutput = await tool.invoke({ a: 21, b: 21 });
  assert.equal(toolOutput, '42', 'LangChain DynamicStructuredTool failed execution');

  // 2. Tool Sanitization for Gemini
  const sanitized = sanitizeToolsForGemini([tool]);
  assert.equal(sanitized.length, 1, 'sanitizeToolsForGemini failed');
  assert.equal(sanitized[0].name, 'test_calculator');

  // 3. LangGraph StateGraph & Checkpointing
  const StateAnnotation = Annotation.Root({
    messages: Annotation({
      reducer: (curr, update) => curr.concat(update),
      default: () => [],
    }),
    route: Annotation({
      reducer: (_curr, update) => update,
      default: () => 'start',
    }),
  });

  const graphBuilder = new StateGraph(StateAnnotation)
    .addNode('step1', (state) => ({
      messages: [new HumanMessage('User greeting')],
      route: 'step2',
    }))
    .addNode('step2', (state) => ({
      messages: [new AIMessage('Agent reply')],
      route: 'done',
    }))
    .addEdge('__start__', 'step1')
    .addEdge('step1', 'step2')
    .addEdge('step2', '__end__');

  const checkpointer = new MemorySaver();
  const graph = graphBuilder.compile({ checkpointer });

  const graphResult = await graph.invoke(
    { messages: [] },
    { configurable: { thread_id: 'verify-ai-thread' } }
  );

  assert.equal(graphResult.route, 'done', 'LangGraph node transitions failed');
  assert.equal(graphResult.messages.length, 2, 'LangGraph state reducer failed');

  // 4. Google GenAI initialization (without network call)
  const genai = new GoogleGenAI({ apiKey: 'dummy-verification-key' });
  assert.ok(genai, 'GoogleGenAI initialization failed');

  // 5. MCP client class loading
  assert.ok(McpClient, 'Model Context Protocol client class failed to load');

  // 6. Voice audio framing verification
  const testPcm = Buffer.from(new Int16Array([1000, -1000, 2000, -2000]).buffer);
  const framed = frameAudioForClient(1, testPcm);
  assert.equal(framed.length, testPcm.length + 4, 'Audio framing failed');
  assert.equal(framed.readUInt32LE(0), 1, 'Audio turnSeq header incorrect');

  console.log('AI stack verification passed successfully (all local components validated).');
}

verifyAiStack().catch((err) => {
  console.error('AI stack verification failed:', err);
  process.exitCode = 1;
});
