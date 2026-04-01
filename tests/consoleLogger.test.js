import { jest } from '@jest/globals';
import ConsoleLogger from '../src/utils/logger/ConsoleLogger.js';

describe('ConsoleLogger', () => {
  let logger;

  beforeEach(() => {
    logger = new ConsoleLogger();
  });

  test('info/warn/error call console methods', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    logger.info('info message', { a: 1 });
    logger.warn('warn message', { b: 2 });
    logger.error('error message', { c: 3 });

    expect(console.log).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();

    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  test('debug logs only when DEBUG or NODE_ENV=development', () => {
    const origDebug = process.env.DEBUG;
    const origEnv = process.env.NODE_ENV;

    jest.spyOn(console, 'debug').mockImplementation(() => {});

    // When not set, debug should not log
    delete process.env.DEBUG;
    process.env.NODE_ENV = 'production';
    logger.debug('no debug', { x: 1 });
    expect(console.debug).not.toHaveBeenCalled();

    // When DEBUG set
    process.env.DEBUG = '1';
    logger.debug('with debug', { x: 2 });
    expect(console.debug).toHaveBeenCalled();

    // Cleanup
    console.debug.mockRestore();
    if (origDebug !== undefined) process.env.DEBUG = origDebug;
    else delete process.env.DEBUG;
    process.env.NODE_ENV = origEnv;
  });
});
