import { jest } from '@jest/globals';

describe('healthController', () => {
  test('success path: logs info and responds with formatted success', async () => {
    jest.resetModules();

    const { default: loggerService } = await import('../src/utils/logger/index.js');
    const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    loggerService.setLogger(mockLogger);

    const { default: healthService } = await import('../src/modules/health/health.service.js');
    healthService.getHealth = jest
      .fn()
      .mockReturnValue({ status: 'ok', uptime: 42, timestamp: '2020-01-01T00:00:00.000Z' });

    const { default: healthController } =
      await import('../src/modules/health/health.controller.js');

    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();

    healthController.getHealth(req, res, next);

    expect(mockLogger.info).toHaveBeenCalledWith('Health check performed', { uptime: 42 });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Server is healthy',
        data: expect.objectContaining({ uptime: 42 }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('error path: logs error and calls next with error', async () => {
    jest.resetModules();

    const { default: loggerService } = await import('../src/utils/logger/index.js');
    const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    loggerService.setLogger(mockLogger);

    const { default: healthService } = await import('../src/modules/health/health.service.js');
    healthService.getHealth = jest.fn().mockImplementation(() => {
      throw new Error('boom');
    });

    const { default: healthController } =
      await import('../src/modules/health/health.controller.js');

    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();

    healthController.getHealth(req, res, next);

    expect(mockLogger.error).toHaveBeenCalledWith('Health check failed', expect.any(Error));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.json).not.toHaveBeenCalled();
  });
});
