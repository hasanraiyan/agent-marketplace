import { jest } from '@jest/globals';
import threadRepository from '../src/repositories/threadRepository.js';
import Conversation from '../src/models/Conversation.js';

describe('Thread Repository', () => {
  let mockThread;

  beforeEach(() => {
    jest.clearAllMocks();

    mockThread = {
      _id: '60c72b2f9b1d8b3a1c8e4d5a',
      agentId: '60c72b2f9b1d8b3a1c8e4d5b',
      userId: '60c72b2f9b1d8b3a1c8e4d5c',
      threadId: 'uuid-1234',
      title: 'New Conversation',
      lastMessageAt: new Date(),
      isArchived: false,
      save: jest.fn().mockResolvedValue(this),
    };
    mockThread.save.mockResolvedValue(mockThread);
  });

  describe('create & find', () => {
    test('should create thread', async () => {
      const saveSpy = jest.spyOn(Conversation.prototype, 'save').mockResolvedValue(mockThread);
      const result = await threadRepository.create({ threadId: 'uuid-1234' });
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual(mockThread);
    });

    test('should find by mongo _id', async () => {
      jest.spyOn(Conversation, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockThread),
      });
      const result = await threadRepository.findById('60c72b2f9b1d8b3a1c8e4d5a');
      expect(Conversation.findOne).toHaveBeenCalledWith({ _id: '60c72b2f9b1d8b3a1c8e4d5a' });
      expect(result).toEqual(mockThread);
    });
    
    test('should find by custom uuid string', async () => {
      jest.spyOn(Conversation, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockThread),
      });
      const result = await threadRepository.findById('uuid-1234');
      expect(Conversation.findOne).toHaveBeenCalledWith({ threadId: 'uuid-1234' });
      expect(result).toEqual(mockThread);
    });
  });

  describe('lifecycle', () => {
    test('should update title', async () => {
      jest.spyOn(Conversation, 'findOneAndUpdate').mockResolvedValue(mockThread);
      await threadRepository.update('uuid-1234', { title: 'New Title' });
      expect(Conversation.findOneAndUpdate).toHaveBeenCalledWith(
        { threadId: 'uuid-1234' }, 
        { title: 'New Title' }, 
        { new: true }
      );
    });

    test('should touch last message timestamp', async () => {
      jest.spyOn(Conversation, 'findOneAndUpdate').mockResolvedValue(mockThread);
      await threadRepository.touchLastMessageAt('uuid-1234');
      expect(Conversation.findOneAndUpdate).toHaveBeenCalledWith(
        { threadId: 'uuid-1234' },
        { lastMessageAt: expect.any(Date) },
        { new: true }
      );
    });
  });
});
