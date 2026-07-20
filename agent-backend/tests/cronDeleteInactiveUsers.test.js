import { jest } from '@jest/globals';
import mongoose from 'mongoose';

const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.unstable_mockModule('../src/utils/index.js', () => ({
  loggerService: {
    getLogger: () => ({
      info: mockLoggerInfo,
      warn: jest.fn(),
      error: mockLoggerError,
      debug: jest.fn(),
    }),
    setLogger: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    cron: {
      retentionDays: 30,
    },
  },
}));

const mockUserFind = jest.fn();
const mockUserFindByIdAndDelete = jest.fn();
const mockAgentDeleteMany = jest.fn();
const mockSkillDeleteMany = jest.fn();
const mockProviderDeleteMany = jest.fn();
const mockMcpDeleteMany = jest.fn();
const mockMcpUserConnectionDeleteMany = jest.fn();
const mockConversationFind = jest.fn();
const mockConversationDeleteMany = jest.fn();
const mockCleanupThreads = jest.fn();

jest.unstable_mockModule('../src/modules/users/user.model.js', () => ({
  default: {
    find: mockUserFind,
    findByIdAndDelete: mockUserFindByIdAndDelete,
  },
}));

jest.unstable_mockModule('../src/models/Agent.js', () => ({
  default: {
    deleteMany: mockAgentDeleteMany,
  },
}));

jest.unstable_mockModule('../src/modules/skills/skill.model.js', () => ({
  default: {
    deleteMany: mockSkillDeleteMany,
  },
}));

jest.unstable_mockModule('../src/modules/providers/provider.model.js', () => ({
  default: {
    deleteMany: mockProviderDeleteMany,
  },
}));

jest.unstable_mockModule('../src/models/Mcp.js', () => ({
  default: {
    deleteMany: mockMcpDeleteMany,
  },
}));

jest.unstable_mockModule('../src/models/McpUserConnection.js', () => ({
  default: {
    deleteMany: mockMcpUserConnectionDeleteMany,
  },
}));

jest.unstable_mockModule('../src/models/Conversation.js', () => ({
  default: {
    find: mockConversationFind,
    deleteMany: mockConversationDeleteMany,
  },
}));

jest.unstable_mockModule('../src/services/checkpoint.service.js', () => ({
  default: {
    cleanupThreads: mockCleanupThreads,
  },
}));

describe('Cron - deleteInactiveUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should delete inactive users older than retention period', async () => {
    const mockUserId = new mongoose.Types.ObjectId();
    mockUserFind.mockResolvedValue([{ _id: mockUserId }]);
    mockConversationFind.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ threadId: 't1' }]),
    });
    mockCleanupThreads.mockResolvedValue();
    mockConversationDeleteMany.mockResolvedValue();
    mockAgentDeleteMany.mockResolvedValue();
    mockSkillDeleteMany.mockResolvedValue();
    mockProviderDeleteMany.mockResolvedValue();
    mockMcpDeleteMany.mockResolvedValue();
    mockMcpUserConnectionDeleteMany.mockResolvedValue();
    mockUserFindByIdAndDelete.mockResolvedValue();

    const deleteInactiveUsers = (await import('../src/cron/deleteInactiveUsers.js')).default;

    const result = await deleteInactiveUsers();

    expect(mockUserFind).toHaveBeenCalledWith({
      isActive: false,
      updatedAt: expect.any(Object),
    });
    expect(mockCleanupThreads).toHaveBeenCalledWith(['t1']);
    expect(mockMcpDeleteMany).toHaveBeenCalledWith({ ownerId: mockUserId });
    expect(mockMcpUserConnectionDeleteMany).toHaveBeenCalledWith({ userId: mockUserId });
    expect(mockUserFindByIdAndDelete).toHaveBeenCalledWith(mockUserId);
    expect(result.deletedCount).toBe(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith('Deleted 1 inactive users older than 30 days');
  });

  test('should not log when no users to purge', async () => {
    mockUserFind.mockResolvedValue([]);

    const deleteInactiveUsers = (await import('../src/cron/deleteInactiveUsers.js')).default;

    const result = await deleteInactiveUsers();

    expect(result.deletedCount).toBe(0);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  test('should handle user purge failure and continue', async () => {
    const mockUserId1 = new mongoose.Types.ObjectId();
    const mockUserId2 = new mongoose.Types.ObjectId();
    mockUserFind.mockResolvedValue([{ _id: mockUserId1 }, { _id: mockUserId2 }]);

    // Fail first user
    mockConversationFind.mockImplementationOnce(() => {
      throw new Error('DB Error');
    });

    // Succeed second user
    mockConversationFind.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue([]),
    });
    mockAgentDeleteMany.mockResolvedValue();
    mockSkillDeleteMany.mockResolvedValue();
    mockProviderDeleteMany.mockResolvedValue();
    mockMcpDeleteMany.mockResolvedValue();
    mockMcpUserConnectionDeleteMany.mockResolvedValue();
    mockUserFindByIdAndDelete.mockResolvedValue();

    const deleteInactiveUsers = (await import('../src/cron/deleteInactiveUsers.js')).default;

    const result = await deleteInactiveUsers();

    expect(result.deletedCount).toBe(1);
    expect(mockLoggerError).toHaveBeenCalled();
  });
});
