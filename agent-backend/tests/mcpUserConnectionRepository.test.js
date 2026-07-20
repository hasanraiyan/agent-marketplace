import { jest } from '@jest/globals';
import mcpUserConnectionRepository from '../src/modules/mcp/mcp-user-connection.repository.js';
import McpUserConnection from '../src/modules/mcp/mcp-user-connection.model.js';

describe('McpUserConnection Repository', () => {
  let mockConnection;
  const mockMcpId = '507f1f77bcf86cd799439022';
  const mockUserId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      _id: '507f1f77bcf86cd799439033',
      mcpId: mockMcpId,
      userId: mockUserId,
      accessTokenEncrypted: 'enc-access',
      refreshTokenEncrypted: 'enc-refresh',
      expiresAt: new Date(),
    };
  });

  describe('findByMcpAndUser', () => {
    test('should look up a connection by mcpId + userId', async () => {
      jest.spyOn(McpUserConnection, 'findOne').mockResolvedValue(mockConnection);

      const result = await mcpUserConnectionRepository.findByMcpAndUser(mockMcpId, mockUserId);

      expect(McpUserConnection.findOne).toHaveBeenCalledWith({
        mcpId: mockMcpId,
        userId: mockUserId,
      });
      expect(result).toEqual(mockConnection);
    });
  });

  describe('upsert', () => {
    test('should upsert token data for the mcpId + userId pair', async () => {
      jest.spyOn(McpUserConnection, 'findOneAndUpdate').mockResolvedValue(mockConnection);

      const tokenData = { accessTokenEncrypted: 'enc-access', expiresAt: mockConnection.expiresAt };
      const result = await mcpUserConnectionRepository.upsert(mockMcpId, mockUserId, tokenData);

      expect(McpUserConnection.findOneAndUpdate).toHaveBeenCalledWith(
        { mcpId: mockMcpId, userId: mockUserId },
        { $set: { mcpId: mockMcpId, userId: mockUserId, ...tokenData } },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );
      expect(result).toEqual(mockConnection);
    });
  });

  describe('deleteByMcpAndUser', () => {
    test('should delete a single connection', async () => {
      jest.spyOn(McpUserConnection, 'findOneAndDelete').mockResolvedValue(mockConnection);

      const result = await mcpUserConnectionRepository.deleteByMcpAndUser(mockMcpId, mockUserId);

      expect(McpUserConnection.findOneAndDelete).toHaveBeenCalledWith({
        mcpId: mockMcpId,
        userId: mockUserId,
      });
      expect(result).toEqual(mockConnection);
    });
  });

  describe('deleteByMcp', () => {
    test('should delete all connections for an mcp', async () => {
      jest.spyOn(McpUserConnection, 'deleteMany').mockResolvedValue({ deletedCount: 3 });

      const result = await mcpUserConnectionRepository.deleteByMcp(mockMcpId);

      expect(McpUserConnection.deleteMany).toHaveBeenCalledWith({ mcpId: mockMcpId });
      expect(result.deletedCount).toBe(3);
    });
  });
});
