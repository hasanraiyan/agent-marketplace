import { jest } from '@jest/globals';

// Mock all dependencies of index.js
jest.unstable_mockModule('../src/config.js', () => ({
  config: { model: {}, threadId: 'test-thread' }
}));
jest.unstable_mockModule('../src/tools.js', () => ({
  tools: [],
  getMcpTools: jest.fn().mockResolvedValue([])
}));
jest.unstable_mockModule('../src/memory.js', () => ({
  store: {},
  checkpointer: {},
  createBackend: jest.fn()
}));
jest.unstable_mockModule('../src/factory.js', () => ({
  createAgent: jest.fn().mockResolvedValue({ id: 'final-agent' })
}));
jest.unstable_mockModule('../src/subagents.js', () => ({
  subagents: []
}));

const { agent } = await import('../src/index.js');

describe('index', () => {
  it('should export the assembled agent', () => {
    expect(agent).toEqual({ id: 'final-agent' });
  });
});
