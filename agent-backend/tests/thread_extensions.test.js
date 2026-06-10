
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import threadRepository from '../src/repositories/threadRepository.js';
import Conversation from '../src/models/Conversation.js';

describe('Thread Repository Extensions', () => {
  const userId = '60c72b2f9b1d8b3a1c8e4d5c';
  const agentId = '60c72b2f9b1d8b3a1c8e4d5b';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findByUser returns threads and total', async () => {
    const mockThreads = [{ _id: 't1' }, { _id: 't2' }];
    const findSpy = jest.spyOn(Conversation, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(mockThreads),
    });
    const countSpy = jest.spyOn(Conversation, 'countDocuments').mockResolvedValue(2);

    const result = await threadRepository.findByUser(userId, { page: 1, limit: 10 });

    expect(findSpy).toHaveBeenCalledWith({ userId, isArchived: false });
    expect(countSpy).toHaveBeenCalledWith({ userId, isArchived: false });
    expect(result.threads).toEqual(mockThreads);
    expect(result.total).toBe(2);
  });

  test('search finds threads by title', async () => {
    const mockThreads = [{ title: 'First Thread' }];
    jest.spyOn(Conversation, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(mockThreads),
    });

    const results = await threadRepository.search(userId, { q: 'First' });

    expect(Conversation.find).toHaveBeenCalledWith({
      userId,
      isArchived: false,
      title: { $regex: 'First', $options: 'i' }
    });
    expect(results).toEqual(mockThreads);
  });

  test('search escapes regex special characters', async () => {
    jest.spyOn(Conversation, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([]),
    });

    await threadRepository.search(userId, { q: 'Test (Char)' });

    expect(Conversation.find).toHaveBeenCalledWith(expect.objectContaining({
      title: { $regex: 'Test \\(Char\\)', $options: 'i' }
    }));
  });

  test('getAgentSummary calls aggregate', async () => {
    const mockSummary = [{ name: 'Test Agent', totalThreads: 2 }];
    const aggregateSpy = jest.spyOn(Conversation, 'aggregate').mockResolvedValue(mockSummary);

    const result = await threadRepository.getAgentSummary(userId);

    expect(aggregateSpy).toHaveBeenCalled();
    expect(result).toEqual(mockSummary);
  });
});
