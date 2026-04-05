import { jest } from '@jest/globals';
import ConsoleLogger from '../src/utils/logger/ConsoleLogger.js';

describe('ConsoleLogger - NODE_ENV development', () => {
  test('debug logs when NODE_ENV=development', () => {
    const orig = process.env.NODE_ENV;
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    delete process.env.DEBUG;
    const logger = new ConsoleLogger();
    logger.debug('dev debug', { a: 1 });
    expect(console.debug).toHaveBeenCalled();
    console.debug.mockRestore();
    process.env.NODE_ENV = orig;
  });
});
