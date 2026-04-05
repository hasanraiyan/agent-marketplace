import { jest } from '@jest/globals';

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
      deleteInactiveUsers: '0 3 * * *',
      cleanExpiredOTPs: '0 */6 * * *',
      retentionDays: 30,
    },
  },
}));

const mockStop = jest.fn();

function createMockSchedule() {
  const schedule = jest.fn();
  schedule.mockReturnValue({ stop: mockStop });
  return schedule;
}

jest.unstable_mockModule('node-cron', () => ({
  default: {
    schedule: createMockSchedule(),
  },
}));

jest.unstable_mockModule('../src/cron/deleteInactiveUsers.js', () => ({
  default: jest.fn().mockResolvedValue({ deletedCount: 5 }),
}));

jest.unstable_mockModule('../src/cron/cleanExpiredOTPs.js', () => ({
  default: jest.fn().mockResolvedValue({ modifiedCount: 10 }),
}));

describe('Cron Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    delete process.env.DISABLE_CRON;

    mockStop.mockClear();
  });

  test('should register all cron jobs on start', async () => {
    const cron = await import('../src/cron/index.js');
    const mockSchedule = (await import('node-cron')).default.schedule;

    cron.startAllCronJobs();

    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(mockSchedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
    expect(mockSchedule).toHaveBeenCalledWith('0 */6 * * *', expect.any(Function));
  });

  test('should not register jobs when DISABLE_CRON is true', async () => {
    process.env.DISABLE_CRON = 'true';

    const cron = await import('../src/cron/index.js');
    const mockSchedule = (await import('node-cron')).default.schedule;

    cron.startAllCronJobs();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  test('should stop all cron jobs', async () => {
    const cron = await import('../src/cron/index.js');
    const mockSchedule = (await import('node-cron')).default.schedule;

    cron.startAllCronJobs();
    cron.stopAllCronJobs();

    expect(mockStop).toHaveBeenCalledTimes(2);
  });

  test('should execute task and log on cron trigger', async () => {
    const cron = await import('../src/cron/index.js');
    const mockSchedule = (await import('node-cron')).default.schedule;

    cron.startAllCronJobs();

    const deleteTaskFn = mockSchedule.mock.calls[0][1];
    await deleteTaskFn();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Cron job "deleteInactiveUsers" started')
    );
  });

  test('should log error when task throws', async () => {
    const failingTask = jest.fn().mockRejectedValue(new Error('DB connection failed'));

    jest.resetModules();
    jest.clearAllMocks();
    mockStop.mockClear();

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
          deleteInactiveUsers: '0 3 * * *',
          cleanExpiredOTPs: '0 */6 * * *',
          retentionDays: 30,
        },
      },
    }));

    jest.unstable_mockModule('node-cron', () => ({
      default: {
        schedule: createMockSchedule(),
      },
    }));

    jest.unstable_mockModule('../src/cron/deleteInactiveUsers.js', () => ({
      default: failingTask,
    }));

    jest.unstable_mockModule('../src/cron/cleanExpiredOTPs.js', () => ({
      default: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    }));

    const cron = await import('../src/cron/index.js');
    const mockSchedule = (await import('node-cron')).default.schedule;

    cron.startAllCronJobs();

    const failingTaskFn = mockSchedule.mock.calls[0][1];
    await failingTaskFn();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('Cron job "deleteInactiveUsers" failed:'),
      expect.any(Error)
    );
  });
});
