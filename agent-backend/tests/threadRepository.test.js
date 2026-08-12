import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import threadRepository from '../src/modules/threads/thread.repository.js';
import Conversation from '../src/modules/threads/thread.model.js';
import { ARCHITECT_AGENT_ID } from '../src/modules/agents/architectConstants.js';

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

  describe('findBySubject / countBySubject exclude the Architect thread', () => {
    // Sage's own working thread (agentId: ARCHITECT_AGENT_ID) has no real
    // Agent behind it, so it can never be opened from a "my conversations"
    // list — it must never come back from either method.
    test('findBySubject filters out the Architect sentinel', async () => {
      const findMock = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      };
      jest.spyOn(Conversation, 'find').mockReturnValue(findMock);

      await threadRepository.findBySubject({ userId: 'user-1' }, { page: 1, limit: 20 });

      expect(Conversation.find).toHaveBeenCalledWith({
        userId: 'user-1',
        isArchived: false,
        agentId: { $ne: ARCHITECT_AGENT_ID },
      });
    });

    test('countBySubject filters out the Architect sentinel', async () => {
      jest.spyOn(Conversation, 'countDocuments').mockResolvedValue(0);

      await threadRepository.countBySubject({ userId: 'user-1' });

      expect(Conversation.countDocuments).toHaveBeenCalledWith({
        userId: 'user-1',
        isArchived: false,
        agentId: { $ne: ARCHITECT_AGENT_ID },
      });
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

    test('should delete all conversations matching a subjectFilter', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const mockThreads = [{ threadId: 't1' }, { threadId: 't2' }];

      jest.spyOn(Conversation, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockThreads),
      });
      const deleteManySpy = jest
        .spyOn(Conversation, 'deleteMany')
        .mockResolvedValue({ deletedCount: 2 });

      const result = await threadRepository.deleteAllBySubject({ userId: mockUserId });

      expect(deleteManySpy).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result).toEqual({ deletedCount: 2, threadIds: ['t1', 't2'] });
    });
  });
});
