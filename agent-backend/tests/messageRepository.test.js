import { jest } from '@jest/globals';
import messageRepository from '../src/repositories/messageRepository.js';
import Message from '../src/models/Message.js';

describe('Message Repository', () => {
  let mockMessage;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMessage = {
      _id: '60c72b2f9b1d8b3a1c8e4d5d',
      conversationId: '60c72b2f9b1d8b3a1c8e4d5a',
      role: 'user',
      content: 'Hello AI',
      save: jest.fn().mockResolvedValue(this),
    };
    mockMessage.save.mockResolvedValue(mockMessage);
  });

  test('should insert message', async () => {
    const saveSpy = jest.spyOn(Message.prototype, 'save').mockResolvedValue(mockMessage);
    const result = await messageRepository.addMessage('convo_1', 'user', 'Hello AI');
    expect(saveSpy).toHaveBeenCalled();
    expect(result).toEqual(mockMessage);
  });

  test('should find by conversation sorted by oldest first', async () => {
    const mockFind = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockMessage]),
    };
    jest.spyOn(Message, 'find').mockReturnValue(mockFind);

    const result = await messageRepository.findByConversation('convo_1');
    expect(Message.find).toHaveBeenCalledWith({ conversationId: 'convo_1' });
    expect(mockFind.sort).toHaveBeenCalledWith({ createdAt: 1 }); // Required for LLM context!
    expect(result).toEqual([mockMessage]);
  });
});
