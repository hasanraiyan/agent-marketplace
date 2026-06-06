import { jest } from '@jest/globals';
import { randomUUID } from 'crypto';

jest.unstable_mockModule('../src/repositories/threadRepository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/factories/agentFactory.js', () => ({
  default: {
    buildAgent: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/chat.service.js', () => ({
  default: {
    checkpointer: {},
  },
}));

jest.unstable_mockModule('../src/middlewares/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { _id: 'user_1' };
    next();
  },
}));

// We need to mock CopilotRuntime to extract the factory
let capturedFactory;
jest.unstable_mockModule('@copilotkit/runtime/v2', () => ({
    CopilotRuntime: class {
        constructor(config) {
            capturedFactory = config.agents.default.factory;
        }
    },
    BuiltInAgent: class {
        constructor(config) {
            this.factory = config.factory;
        }
    }
}));

const agentFactory = (await import('../src/factories/agentFactory.js')).default;
const { requestStore } = await import('../src/routes/copilotkit.routes.js');

describe('Reproduction: CopilotKit Stream Disconnect on Tool Call', () => {
  test('should continue streaming after tool call in CopilotKit runtime', async () => {
    const mockStreamEvents = jest.fn();
    async function* mockGenerator() {
      yield { event: 'on_chat_model_stream', data: { chunk: { content: 'Thinking...' } } };
      yield { event: 'on_tool_start', run_id: 'tool_1', name: 'search_web', data: { input: { query: 'test' } } };
      yield { event: 'on_tool_end', run_id: 'tool_1', name: 'search_web', data: { output: 'search results' } };
      yield { event: 'on_chat_model_stream', data: { chunk: { content: 'Done.' } } };
    }
    mockStreamEvents.mockReturnValue(mockGenerator());

    agentFactory.buildAgent.mockResolvedValue({
      agentInstance: { streamEvents: mockStreamEvents },
      providerConfig: { label: 'OpenAI' },
    });

    const events = [];
    await requestStore.run({ agentId: 'agent_1', userId: 'user_1' }, async () => {
        const result = await capturedFactory({
            input: {
                messages: [{ role: 'user', content: 'hello' }],
            },
        });

        for await (const event of result) {
            events.push(event);
        }
    });

    console.log('Events:', JSON.stringify(events, null, 2));

    const contentEvents = events.filter(e => e.type === 'TEXT_MESSAGE_CONTENT');
    const allText = contentEvents.map(e => e.delta).join('');

    expect(allText).toContain('Thinking...');
    expect(allText).toContain('Done.');
  });
});
