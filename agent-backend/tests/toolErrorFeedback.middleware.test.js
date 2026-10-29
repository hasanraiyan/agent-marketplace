import { createAgent, createMiddleware, tool } from 'langchain';
import { GraphInterrupt } from '@langchain/langgraph';
import { z } from 'zod';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import {
  createToolErrorFeedbackMiddleware,
  formatToolErrorContent,
  unwrapToolError,
} from '../src/modules/agents/toolErrorFeedback.middleware.js';

/**
 * Minimal scripted chat model: returns the queued responses in order (repeating
 * the last one). `bindTools` is a no-op so the agent's bound-tool validation
 * passes without a real provider.
 */
class ScriptedModel extends BaseChatModel {
  constructor(responses) {
    super({});
    this.responses = responses;
    this.index = 0;
  }

  _llmType() {
    return 'scripted';
  }

  bindTools() {
    return this;
  }

  async _generate() {
    const message = this.responses[Math.min(this.index, this.responses.length - 1)];
    this.index += 1;
    return {
      generations: [{ message, text: typeof message.content === 'string' ? message.content : '' }],
    };
  }
}

const addTool = tool(async ({ a, b }) => a + b, {
  name: 'add',
  description: 'Add two numbers.',
  schema: z.object({ a: z.number(), b: z.number() }),
});

/**
 * Stand-in for deepagents' filesystem middleware, whose tool-output eviction
 * installs the wrapToolCall hook that makes langchain's ToolNode re-throw.
 */
const evalLikeMiddleware = createMiddleware({
  name: 'evalLike',
  wrapToolCall: async (request, handler) => handler(request),
});

function toolCallAgent({ args, middleware }) {
  const model = new ScriptedModel([
    new AIMessage({
      content: '',
      tool_calls: [{ name: 'add', args, id: 'call_1', type: 'tool_call' }],
    }),
    new AIMessage({ content: 'done' }),
  ]);
  return createAgent({ model, tools: [addTool], middleware });
}

describe('toolErrorFeedback middleware', () => {
  it('reproduces the failure mode: bad arguments abort the run through a wrapToolCall chain', async () => {
    const agent = toolCallAgent({ args: { a: 'nope', b: 2 }, middleware: [evalLikeMiddleware] });

    await expect(agent.invoke({ messages: [new HumanMessage('add')] })).rejects.toThrow(
      /did not match expected schema/
    );
  });

  it('feeds a bad-argument tool call back to the model as an error ToolMessage', async () => {
    const agent = toolCallAgent({
      args: { a: 'nope', b: 2 },
      middleware: [evalLikeMiddleware, createToolErrorFeedbackMiddleware()],
    });

    const result = await agent.invoke({ messages: [new HumanMessage('add')] });

    const toolMessage = result.messages.find((message) => ToolMessage.isInstance(message));
    expect(toolMessage).toBeDefined();
    expect(toolMessage.status).toBe('error');
    expect(toolMessage.tool_call_id).toBe('call_1');
    expect(String(toolMessage.content)).toContain('did not match expected schema');
    expect(result.messages.at(-1).content).toBe('done');
  });

  it('passes successful tool results through untouched', async () => {
    const agent = toolCallAgent({
      args: { a: 1, b: 2 },
      middleware: [evalLikeMiddleware, createToolErrorFeedbackMiddleware()],
    });

    const result = await agent.invoke({ messages: [new HumanMessage('add')] });

    const toolMessage = result.messages.find((message) => ToolMessage.isInstance(message));
    expect(toolMessage.status).toBe('success');
    expect(toolMessage.content).toBe('3');
  });

  it('rethrows interrupts and aborted runs instead of turning them into tool errors', async () => {
    const middleware = createToolErrorFeedbackMiddleware();
    const request = { toolCall: { name: 'add', id: 'call_1', args: {} }, runtime: {} };

    await expect(
      middleware.wrapToolCall(request, async () => {
        throw new GraphInterrupt([{ value: 'approve?' }]);
      })
    ).rejects.toMatchObject({ name: 'GraphInterrupt' });

    await expect(
      middleware.wrapToolCall({ ...request, runtime: { signal: { aborted: true } } }, async () => {
        throw new Error('aborted');
      })
    ).rejects.toThrow('aborted');
  });
});

describe('formatToolErrorContent', () => {
  it('unwraps wrapper errors down to the real cause', () => {
    const parseError = new Error('Received tool input did not match expected schema\n✖ at action');
    const invocationError = new Error('Error invoking tool with error: <stack>');
    invocationError.toolError = parseError;
    const middlewareError = new Error('Error invoking tool with error: <stack>');
    middlewareError.cause = invocationError;

    expect(unwrapToolError(middlewareError)).toBe(parseError);
    expect(formatToolErrorContent(middlewareError)).toContain('at action');
    expect(formatToolErrorContent(middlewareError)).not.toContain('<stack>');
  });

  it('caps very long error messages so one bad call cannot flood the context', () => {
    const content = formatToolErrorContent(new Error('x'.repeat(5000)));
    expect(content.length).toBeLessThan(1700);
    expect(
      content.endsWith('…\nPlease fix the tool arguments if they were invalid and try again.')
    ).toBe(true);
  });
});
