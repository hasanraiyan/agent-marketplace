import { jest } from '@jest/globals';
import loggerService from '../src/utils/logger/index.js';

describe('loggerService', () => {
  const original = loggerService.getLogger();

  afterEach(() => {
    loggerService.setLogger(original);
  });

  test('setLogger swaps the logger instance and methods are callable', () => {
    const mock = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    loggerService.setLogger(mock);
    const got = loggerService.getLogger();
    expect(got).toBe(mock);
    got.info('hello');
    expect(mock.info).toHaveBeenCalledWith('hello');
  });

  test('allows partial logger objects', () => {
    const partial = { info: jest.fn() };
    loggerService.setLogger(partial);
    expect(loggerService.getLogger()).toBe(partial);
  });
});
