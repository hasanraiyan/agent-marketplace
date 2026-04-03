import { jest } from '@jest/globals';

const mockLoggerInfo = jest.fn();

jest.unstable_mockModule('../src/utils/index.js', () => ({
  loggerService: {
    getLogger: () => ({
      info: mockLoggerInfo,
      warn: jest.fn(),
      error: jest.fn(),
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

const mockDeleteMany = jest.fn();

jest.unstable_mockModule('../src/models/User.js', () => ({
  default: {
    deleteMany: mockDeleteMany,
  },
}));

describe('Cron - deleteInactiveUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('should delete inactive users older than retention period', async () => {
    mockDeleteMany.mockResolvedValue({ deletedCount: 5 });

    const deleteInactiveUsers = (await import('../src/cron/deleteInactiveUsers.js')).default;

    const result = await deleteInactiveUsers();

    expect(mockDeleteMany).toHaveBeenCalledWith({
      isActive: false,
      updatedAt: expect.any(Object),
    });
    expect(result.deletedCount).toBe(5);
    expect(mockLoggerInfo).toHaveBeenCalledWith('Deleted 5 inactive users older than 30 days');
  });

  test('should not log when no users deleted', async () => {
    mockDeleteMany.mockResolvedValue({ deletedCount: 0 });

    const deleteInactiveUsers = (await import('../src/cron/deleteInactiveUsers.js')).default;

    const result = await deleteInactiveUsers();

    expect(result.deletedCount).toBe(0);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  test('should use configured retention days', async () => {
    jest.resetModules();

    jest.unstable_mockModule('../src/config/index.js', () => ({
      default: {
        cron: {
          retentionDays: 90,
        },
      },
    }));

    jest.unstable_mockModule('../src/utils/index.js', () => ({
      loggerService: {
        getLogger: () => ({
          info: mockLoggerInfo,
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
        setLogger: jest.fn(),
      },
    }));

    jest.unstable_mockModule('../src/models/User.js', () => ({
      default: {
        deleteMany: mockDeleteMany,
      },
    }));

    mockDeleteMany.mockResolvedValue({ deletedCount: 3 });

    const deleteInactiveUsers = (await import('../src/cron/deleteInactiveUsers.js')).default;

    await deleteInactiveUsers();

    expect(mockLoggerInfo).toHaveBeenCalledWith('Deleted 3 inactive users older than 90 days');
  });
});
