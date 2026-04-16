import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/repositories/threadRepository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn(),
    update: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/messageRepository.js', () => ({
  default: {
    addMessage: jest.fn(),
    findByConversation: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/agentRepository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/repositories/providerRepository.js', () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/utils/encryption.js', () => ({
  default: {
    decrypt: jest.fn().mockReturnValue('mocked-decrypted-key'),
  },
}));

const threadRepository = (await import('../src/repositories/threadRepository.js')).default;
const messageRepository = (await import('../src/repositories/messageRepository.js')).default;
const agentRepository = (await import('../src/repositories/agentRepository.js')).default;
const providerRepository = (await import('../src/repositories/providerRepository.js')).default;
const chatService = (await import('../src/services/chat.service.js')).default;

describe('Chat Service (Runtime LLM Engine)', () => {
  let mockRes;
  let mockThread;
  let mockAgent;
  let mockProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRes = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    mockThread = {
      _id: 'thread_1',
      userId: 'user_1',
      agentId: 'agent_1',
    };

    mockAgent = {
      _id: 'agent_1',
      providerId: 'prov_1',
      systemPrompt: 'You are an agent',
    };

    mockProvider = {
      _id: 'prov_1',
      apiKeyEncrypted: 'enc-key',
      defaultModel: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
    };
  });

  describe('streamChat headers and validation', () => {
    test('should reject unauthorized user', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);

      await chatService.streamChat(mockRes, 'thread_1', 'different_user', 'hello');

      expect(mockRes.write).toHaveBeenCalledWith('data: {"error": "Unauthorized"}\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    test('should reject missing agent', async () => {
      threadRepository.findById.mockResolvedValue(mockThread);
      agentRepository.findById.mockResolvedValue(null);

      await chatService.streamChat(mockRes, 'thread_1', 'user_1', 'hello');

      expect(mockRes.write).toHaveBeenCalledWith('data: {"error": "Agent deleted or unavailable"}\n\n');
    });
  });

  describe('LangChain message mapping', () => {
    test('should accurately map internal messages to LangChain objects array', () => {
       const mapped = chatService._mapToLangchainMessages([
           { role: 'user', content: 'hello' },
           { role: 'assistant', content: 'hi' },
           { role: 'system', content: 'cmd' },
       ]);

       expect(mapped[0].constructor.name).toBe('HumanMessage');
       expect(mapped[1].constructor.name).toBe('AIMessage');
       expect(mapped[2].constructor.name).toBe('SystemMessage');
    });
  });
});
