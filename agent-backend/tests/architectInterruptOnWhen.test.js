import { createDeepAgent } from 'deepagents';
import { MemorySaver, Command } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Regression test for a real incident: `agent.factory.js`'s
 * `ARCHITECT_INTERRUPT_ON` originally set `{ when: fn }` on each manage_*
 * tool with no `allowedDecisions` field. langchain's `InterruptOnConfigSchema`
 * requires `allowedDecisions` (no default) — `interopParse` throws a ZodError
 * on that config on EVERY afterModel hook invocation (it runs unconditionally,
 * before even checking for tool calls), which the AG-UI translator then
 * misreports as a bogus clarification interrupt with no questions ("I need
 * your input to continue...") on every single turn, tool call or not.
 *
 * Drives the real `createDeepAgent(...)` + langchain `humanInTheLoopMiddleware`
 * end-to-end via a scripted chat model (same pattern as
 * interruptOnMcpParity.test.js) — not a synthetic interrupt payload — so a
 * regression here fails the same way it did in production, not just a unit
 * assertion on the config object shape.
 */

class ScriptedToolCallChatModel extends BaseChatModel {
  constructor(responses) {
    super({});
    this.responses = responses;
    this.calls = 0;
  }

  _llmType() {
    return 'scripted-tool-call-chat-model';
  }

  bindTools() {
    return this;
  }

  async _generate() {
    const message = this.responses[Math.min(this.calls, this.responses.length - 1)];
    this.calls += 1;
    return { generations: [{ text: '', message }] };
  }
}

const manageAgentTool = tool(async ({ action }) => `manage_agent executed: ${action}`, {
  name: 'manage_agent',
  description: 'fake manage_agent for this test',
  schema: z.object({ action: z.string() }),
});

// The exact shape agent.factory.js's ARCHITECT_INTERRUPT_ON now uses.
const mutatingOnly = {
  allowedDecisions: ['approve', 'edit', 'reject'],
  when: (req) => req.toolCall.args?.action !== 'read',
};

async function runOneTurn(action) {
  const model = new ScriptedToolCallChatModel([
    new AIMessage({
      content: '',
      tool_calls: [{ name: 'manage_agent', args: { action }, id: 'call_1' }],
    }),
    new AIMessage({ content: 'done' }),
  ]);

  const agentInstance = await createDeepAgent({
    model,
    systemPrompt: 'test agent',
    checkpointer: new MemorySaver(),
    tools: [manageAgentTool],
    interruptOn: { manage_agent: mutatingOnly },
  });

  const config = { configurable: { thread_id: `t-${action}-${Math.random()}` } };
  return agentInstance.invoke({ messages: [{ role: 'user', content: 'go' }] }, config);
}

describe('ARCHITECT_INTERRUPT_ON with a `when` predicate + required allowedDecisions', () => {
  test('does not throw on a config with `when` + `allowedDecisions` (the fixed shape)', async () => {
    await expect(runOneTurn('read')).resolves.toBeDefined();
  });

  test('a "read" action auto-approves — no interrupt, tool executes immediately', async () => {
    const result = await runOneTurn('read');
    expect(result.__interrupt__).toBeUndefined();
    const toolResultMessage = result.messages.find((m) => m.tool_call_id === 'call_1');
    expect(toolResultMessage?.content).toBe('manage_agent executed: read');
  });

  test('a "create" action interrupts for approval, then executes once approved', async () => {
    const model = new ScriptedToolCallChatModel([
      new AIMessage({
        content: '',
        tool_calls: [{ name: 'manage_agent', args: { action: 'create' }, id: 'call_1' }],
      }),
      new AIMessage({ content: 'done' }),
    ]);
    const agentInstance = await createDeepAgent({
      model,
      systemPrompt: 'test agent',
      checkpointer: new MemorySaver(),
      tools: [manageAgentTool],
      interruptOn: { manage_agent: mutatingOnly },
    });
    const config = { configurable: { thread_id: 't-create-approve' } };

    const paused = await agentInstance.invoke(
      { messages: [{ role: 'user', content: 'go' }] },
      config
    );
    expect(paused.__interrupt__?.[0]?.value?.actionRequests).toHaveLength(1);
    expect(paused.__interrupt__[0].value.actionRequests[0].name).toBe('manage_agent');

    const resumed = await agentInstance.invoke(
      new Command({ resume: { decisions: [{ type: 'approve' }] } }),
      config
    );
    const toolResultMessage = resumed.messages.find((m) => m.tool_call_id === 'call_1');
    expect(toolResultMessage?.content).toBe('manage_agent executed: create');
  });
});
