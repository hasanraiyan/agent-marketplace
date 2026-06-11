import { jest } from '@jest/globals';
import agentRepository from '../src/repositories/agentRepository.js';
import Agent from '../src/models/Agent.js';

describe('Agent Repository', () => {
  let mockAgent;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAgent = {
      _id: 'agent_123',
      ownerId: 'user_123',
      name: 'JS Expert',
      slug: 'js-expert-a1b2',
      systemPrompt: 'You are an expert JS dev',
      providerId: 'prov_123',
      visibility: 'public',
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockResolvedValue(this),
    };
    mockAgent.save.mockResolvedValue(mockAgent);
  });

  describe('create', () => {
    test('should create agent', async () => {
      const saveSpy = jest.spyOn(Agent.prototype, 'save').mockResolvedValue(mockAgent);
      const result = await agentRepository.create({ name: 'JS Expert' });
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual(mockAgent);
    });
  });

  describe('findById and findBySlug', () => {
    test('should find by id', async () => {
      jest.spyOn(Agent, 'findById').mockResolvedValue(mockAgent);
      const result = await agentRepository.findById('agent_123');
      expect(Agent.findById).toHaveBeenCalledWith('agent_123');
      expect(result).toEqual(mockAgent);
    });

    test('should find by slug', async () => {
      jest.spyOn(Agent, 'findOne').mockResolvedValue(mockAgent);
      const result = await agentRepository.findBySlug('js-expert-a1b2');
      expect(Agent.findOne).toHaveBeenCalledWith({ slug: 'js-expert-a1b2' });
      expect(result).toEqual(mockAgent);
    });
  });

  describe('update and delete', () => {
    test('should update agent', async () => {
      jest.spyOn(Agent, 'findByIdAndUpdate').mockResolvedValue(mockAgent);
      await agentRepository.update('agent_123', { name: 'New' });
      expect(Agent.findByIdAndUpdate).toHaveBeenCalledWith(
        'agent_123',
        { name: 'New' },
        {
          new: true,
          runValidators: true,
        }
      );
    });

    test('should soft-delete agent', async () => {
      jest.spyOn(Agent, 'findByIdAndUpdate').mockResolvedValue(mockAgent);
      await agentRepository.delete('agent_123');
      expect(Agent.findByIdAndUpdate).toHaveBeenCalledWith(
        'agent_123',
        expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
        { new: true }
      );
    });
  });

  describe('search and count', () => {
    test('should perform sorted search', async () => {
      const mockResult = [mockAgent];
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue(mockResult);

      jest.spyOn(Agent, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: mockSkip,
          limit: mockLimit,
        }),
      });

      const filters = { visibility: 'public' };
      const pagination = { page: 2, limit: 10, sortBy: 'oldest' };

      const result = await agentRepository.search(filters, pagination);

      expect(Agent.find).toHaveBeenCalledWith(filters);
      // oldest means createdAt: 1
      expect(mockSkip).toHaveBeenCalledWith(10);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockResult);
    });

    test('should count documents', async () => {
      jest.spyOn(Agent, 'countDocuments').mockResolvedValue(42);
      const count = await agentRepository.count({ category: 'coding' });
      expect(count).toBe(42);
    });
  });
});
