import { jest } from '@jest/globals';

// Mock deepagents before importing factory
jest.unstable_mockModule('deepagents', () => ({
  createDeepAgent: jest.fn().mockResolvedValue({ id: 'mock-agent' }),
}));

const { createAgent } = await import('../src/factory.js');
const { createDeepAgent } = await import('deepagents');

describe('factory', () => {
  it('should call createDeepAgent with correct parameters', async () => {
    const mockDeps = {
      model: {},
      tools: [],
      store: {},
      checkpointer: {},
      backend: jest.fn(),
      skills: ['/skills/'],
      subagents: [],
    };

    const agent = await createAgent(mockDeps);

    expect(createDeepAgent).toHaveBeenCalled();
    expect(agent).toEqual({ id: 'mock-agent' });
    
    const callArgs = jest.mocked(createDeepAgent).mock.calls[0][0];
    expect(callArgs).toHaveProperty('systemPrompt');
    expect(callArgs.interruptOn).toEqual({ write_file: true });
  });
});
