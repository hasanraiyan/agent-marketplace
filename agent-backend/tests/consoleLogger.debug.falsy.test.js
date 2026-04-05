import { jest } from '@jest/globals';
import ConsoleLogger from '../src/utils/logger/ConsoleLogger.js';

describe('ConsoleLogger - debug and falsy data branches', () => {
  const origDebug = process.env.DEBUG;
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origDebug !== undefined) process.env.DEBUG = origDebug;
    else delete process.env.DEBUG;
    if (origEnv !== undefined) process.env.NODE_ENV = origEnv;
    else delete process.env.NODE_ENV;
    jest.resetModules();
    if (console.debug && console.debug.mockRestore) console.debug.mockRestore();
    if (console.log && console.log.mockRestore) console.log.mockRestore();
    if (console.warn && console.warn.mockRestore) console.warn.mockRestore();
    if (console.error && console.error.mockRestore) console.error.mockRestore();
  });

  test('debug with DEBUG=1 and null data logs empty string', () => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    process.env.DEBUG = '1';
    process.env.NODE_ENV = 'production';
    const logger = new ConsoleLogger();
    logger.debug('test null', null);
    expect(console.debug).toHaveBeenCalled();
    const args = console.debug.mock.calls[0];
    expect(args[0]).toEqual(expect.stringContaining('[DEBUG]'));
    expect(args[1]).toBe('');
  });

  test('debug with DEBUG=1 and 0 logs empty string', () => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    process.env.DEBUG = '1';
    process.env.NODE_ENV = 'production';
    const logger = new ConsoleLogger();
    logger.debug('test zero', 0);
    expect(console.debug).toHaveBeenCalled();
    const args = console.debug.mock.calls[0];
    expect(args[1]).toBe('');
  });

  test('debug with DEBUG=1 and non-empty string "0" logs that string', () => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    process.env.DEBUG = '1';
    process.env.NODE_ENV = 'production';
    const logger = new ConsoleLogger();
    logger.debug('test string zero', '0');
    expect(console.debug).toHaveBeenCalled();
    const args = console.debug.mock.calls[0];
    expect(args[1]).toBe('0');
  });

  test('info/warn/error with 0 or false use fallback empty string', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new ConsoleLogger();
    logger.info('info zero', 0);
    logger.warn('warn false', false);
    logger.error('error zero', 0);
    expect(console.log.mock.calls[0][1]).toBe('');
    expect(console.warn.mock.calls[0][1]).toBe('');
    expect(console.error.mock.calls[0][1]).toBe('');
  });

  test('debug does not log when DEBUG empty string and NODE_ENV != development', () => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    process.env.DEBUG = '';
    process.env.NODE_ENV = 'production';
    const logger = new ConsoleLogger();
    logger.debug('should not log', undefined);
    expect(console.debug).not.toHaveBeenCalled();
  });
});
