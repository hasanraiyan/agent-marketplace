
import { jest } from '@jest/globals';
import threadController from '../src/controllers/thread.controller.js';
import threadRepository from '../src/repositories/threadRepository.js';

describe('Thread Controller Extensions', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user123' },
      query: {},
      params: {},
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('getAllByUser returns metadata', async () => {
    const mockData = { threads: [{ id: 't1' }], total: 1 };
    jest.spyOn(threadRepository, 'findByUser').mockResolvedValue(mockData);

    await threadController.getAllByUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockData.threads,
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });

  test('search calls repository search', async () => {
    req.query = { q: 'test' };
    const mockThreads = [{ id: 't1' }];
    jest.spyOn(threadRepository, 'search').mockResolvedValue(mockThreads);

    await threadController.search(req, res, next);

    expect(threadRepository.search).toHaveBeenCalledWith('user123', expect.objectContaining({ q: 'test' }));
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockThreads });
  });

  test('getAgentSummary calls repository getAgentSummary', async () => {
    const mockSummary = [{ name: 'Agent' }];
    jest.spyOn(threadRepository, 'getAgentSummary').mockResolvedValue(mockSummary);

    await threadController.getAgentSummary(req, res, next);

    expect(threadRepository.getAgentSummary).toHaveBeenCalledWith('user123');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSummary });
  });
});
