import { createDeepAgent } from 'deepagents';
import { MemorySaver, Command } from '@langchain/langgraph';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * REQ-4: prove that `interruptOn` gates an MCP-sourced tool name identically
 * to a built-in tool name — i.e. the pause/resume cycle doesn't depend on
 * where a tool came from.
 *
 * This exercises the real `createDeepAgent(...)` call the exact same way
 * `agent.factory.js` invokes it (same `tools`/`interruptOn` shape), driving
 * langchain's real `humanInTheLoopMiddleware` end-to-end via a scripted chat
 * model — not a synthetic interrupt payload. `resolveAgentTools` (tools/
 * index.js) already merges built-in and MCP-loaded tools into one flat array
 * before this point, and `@langchain/mcp-adapters` names MCP tools
 * `${serverKey}__${toolName}` (mcp.tools.js, prefixToolNameWithServerName:
 * true) — `canva__search_designs` below mirrors that exact shape.
 *
 * No mocking of MultiServerMCPClient is needed here: the middleware being
 * proven (langchain's humanInTheLoopMiddleware) only ever looks up
 * `interruptOn[toolCall.name]`, a plain string key — it has no notion of
 * "this tool came from MCP" to fake in the first place. A tool object with
 * that exact name reaching the same `tools` array `agent.factory.js` builds
 * is what matters, not how it got there.
 */

// Replays canned AIMessages instead of calling a real provider, so this
// test needs no network access / API key. bindTools is a no-op: the fake
// model doesn't need real tool-schema binding to emit scripted tool_calls.
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

async function buildAndRunInterruptCycle({ toolName, toolCallArgs, extraTools }) {
  const model = new ScriptedToolCallChatModel([
    new AIMessage({
      content: '',
      tool_calls: [{ name: toolName, args: toolCallArgs, id: 'call_1' }],
    }),
    new AIMessage({ content: 'done' }),
  ]);

  const agentInstance = await createDeepAgent({
    model,
    systemPrompt: 'test agent',
    checkpointer: new MemorySaver(),
    tools: extraTools || [],
    interruptOn: { [toolName]: true },
  });

  const config = { configurable: { thread_id: `t-${toolName}` } };

  const paused = await agentInstance.invoke(
    { messages: [{ role: 'user', content: 'go' }] },
    config
  );
  const interruptValue = paused.__interrupt__?.[0]?.value;

  const resumed = await agentInstance.invoke(
    new Command({ resume: { decisions: [{ type: 'approve' }] } }),
    config
  );
  const toolResultMessage = resumed.messages.find((m) => m.tool_call_id === 'call_1');

  return { interruptValue, toolResultContent: toolResultMessage?.content };
}

describe('interruptOn gates MCP-sourced tool names the same way as built-in tool names (REQ-4)', () => {
  test('built-in tool (write_file): pauses on interrupt, executes after approval', async () => {
    const { interruptValue, toolResultContent } = await buildAndRunInterruptCycle({
      toolName: 'write_file',
      toolCallArgs: { file_path: '/x.md', content: 'hi' },
    });

    expect(interruptValue.actionRequests).toHaveLength(1);
    expect(interruptValue.actionRequests[0].name).toBe('write_file');
    expect(interruptValue.reviewConfigs[0]).toMatchObject({ actionName: 'write_file' });
    expect(toolResultContent).toContain("Successfully wrote to '/x.md'");
  });

  test('MCP-sourced tool (server-prefixed name): pauses on interrupt, executes after approval', async () => {
    const mcpTool = tool(async () => 'mcp tool executed', {
      name: 'canva__search_designs',
      description:
        'a fake MCP-registered tool, named the way @langchain/mcp-adapters prefixes MCP tools',
      schema: z.object({}),
    });

    const { interruptValue, toolResultContent } = await buildAndRunInterruptCycle({
      toolName: 'canva__search_designs',
      toolCallArgs: {},
      extraTools: [mcpTool],
    });

    expect(interruptValue.actionRequests).toHaveLength(1);
    expect(interruptValue.actionRequests[0].name).toBe('canva__search_designs');
    expect(interruptValue.reviewConfigs[0]).toMatchObject({ actionName: 'canva__search_designs' });
    expect(toolResultContent).toBe('mcp tool executed');
  });

  test('parity: both shapes produce structurally identical interrupt/resume payloads', async () => {
    const mcpTool = tool(async () => 'ok', {
      name: 'stripe__create_invoice',
      description: 'another fake MCP-registered tool',
      schema: z.object({}),
    });

    const builtIn = await buildAndRunInterruptCycle({
      toolName: 'write_file',
      toolCallArgs: { file_path: '/y.md', content: 'y' },
    });
    const mcpSourced = await buildAndRunInterruptCycle({
      toolName: 'stripe__create_invoice',
      toolCallArgs: {},
      extraTools: [mcpTool],
    });

    // Same shape of interrupt payload — reviewConfigs' allowedDecisions in
    // particular, since that's what the client renders approve/reject from.
    expect(Object.keys(builtIn.interruptValue).sort()).toEqual(
      Object.keys(mcpSourced.interruptValue).sort()
    );
    expect(builtIn.interruptValue.reviewConfigs[0].allowedDecisions).toEqual(
      mcpSourced.interruptValue.reviewConfigs[0].allowedDecisions
    );
  });
});
