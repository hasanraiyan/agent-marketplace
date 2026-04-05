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

const mockUpdateMany = jest.fn();

jest.unstable_mockModule('../src/models/User.js', () => ({
  default: {
    updateMany: mockUpdateMany,
  },
}));

describe('Cron - cleanExpiredOTPs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('should clean expired OTPs from users', async () => {
    mockUpdateMany.mockResolvedValue({ modifiedCount: 10 });

    const cleanExpiredOTPs = (await import('../src/cron/cleanExpiredOTPs.js')).default;

    const result = await cleanExpiredOTPs();

    expect(mockUpdateMany).toHaveBeenCalledWith(
      {
        $or: [
          { emailVerificationOTPExpires: { $lt: expect.any(Date) } },
          { passwordResetOTPExpires: { $lt: expect.any(Date) } },
        ],
      },
      {
        $unset: {
          emailVerificationOTP: '',
          emailVerificationOTPExpires: '',
          passwordResetOTP: '',
          passwordResetOTPExpires: '',
        },
      }
    );
    expect(result.modifiedCount).toBe(10);
    expect(mockLoggerInfo).toHaveBeenCalledWith('Cleaned expired OTPs from 10 users');
  });

  test('should not log when no users cleaned', async () => {
    mockUpdateMany.mockResolvedValue({ modifiedCount: 0 });

    const cleanExpiredOTPs = (await import('../src/cron/cleanExpiredOTPs.js')).default;

    const result = await cleanExpiredOTPs();

    expect(result.modifiedCount).toBe(0);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });
});
