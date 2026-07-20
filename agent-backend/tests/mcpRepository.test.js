import { jest } from '@jest/globals';
import mcpRepository from '../src/modules/mcp/mcp.repository.js';
import Mcp from '../src/modules/mcp/mcp.model.js';

describe('Mcp Repository', () => {
  let mockMcp;
  let mockUserId;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserId = '507f1f77bcf86cd799439011';
    mockMcp = {
      _id: '507f1f77bcf86cd799439022',
      ownerId: mockUserId,
      name: 'My MCP',
      transport: 'http',
      url: 'https://example.com/mcp',
      authType: 'none',
      authMode: 'owner',
      save: jest.fn(),
    };
    mockMcp.save.mockResolvedValue(mockMcp);
  });

  describe('create', () => {
    test('should create an MCP server successfully', async () => {
      const saveSpy = jest.spyOn(Mcp.prototype, 'save').mockResolvedValue(mockMcp);

      const result = await mcpRepository.create({
        ownerId: mockUserId,
        name: 'My MCP',
        transport: 'http',
        url: 'https://example.com/mcp',
      });

      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual(mockMcp);
    });
  });

  describe('findById', () => {
    test('should find an MCP server by ID', async () => {
      jest.spyOn(Mcp, 'findById').mockResolvedValue(mockMcp);

      const result = await mcpRepository.findById(mockMcp._id);

      expect(Mcp.findById).toHaveBeenCalledWith(mockMcp._id);
      expect(result).toEqual(mockMcp);
    });
  });

  describe('findByOwner', () => {
    test('should find MCP servers by owner sorted by createdAt', async () => {
      jest.spyOn(Mcp, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockMcp]),
      });

      const result = await mcpRepository.findByOwner(mockUserId);

      expect(Mcp.find).toHaveBeenCalledWith({ ownerId: mockUserId });
      expect(result).toEqual([mockMcp]);
    });
  });

  describe('update', () => {
    test('should update an MCP server owned by the user', async () => {
      const updated = { ...mockMcp, name: 'Renamed' };
      jest.spyOn(Mcp, 'findOneAndUpdate').mockResolvedValue(updated);

      const result = await mcpRepository.update(mockMcp._id, mockUserId, { name: 'Renamed' });

      expect(Mcp.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockMcp._id, ownerId: mockUserId },
        { $set: { name: 'Renamed' } },
        { returnDocument: 'after', runValidators: true }
      );
      expect(result).toEqual(updated);
    });

    test('should throw NotFoundError if no document matched', async () => {
      jest.spyOn(Mcp, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(mcpRepository.update(mockMcp._id, mockUserId, {})).rejects.toThrow(
        'MCP server not found or unauthorized'
      );
    });
  });

  describe('delete', () => {
    test('should delete an MCP server owned by the user', async () => {
      jest.spyOn(Mcp, 'findOneAndDelete').mockResolvedValue(mockMcp);

      const result = await mcpRepository.delete(mockMcp._id, mockUserId);

      expect(Mcp.findOneAndDelete).toHaveBeenCalledWith({
        _id: mockMcp._id,
        ownerId: mockUserId,
      });
      expect(result).toEqual(mockMcp);
    });

    test('should throw NotFoundError if no document matched', async () => {
      jest.spyOn(Mcp, 'findOneAndDelete').mockResolvedValue(null);

      await expect(mcpRepository.delete(mockMcp._id, mockUserId)).rejects.toThrow(
        'MCP server not found or unauthorized'
      );
    });
  });
});
