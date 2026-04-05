import { jest } from '@jest/globals';
import ConsoleLogger from '../src/utils/logger/ConsoleLogger.js';

describe('ConsoleLogger - falsy data branches', () => {
  let logger;

  beforeEach(() => {
    logger = new ConsoleLogger();
  });

  afterEach(() => {
    if (console.log && console.log.mockRestore) console.log.mockRestore();
    if (console.warn && console.warn.mockRestore) console.warn.mockRestore();
    if (console.error && console.error.mockRestore) console.error.mockRestore();
  });

  test('info with no data passes empty string as second arg', () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('info only');
    expect(console.log).toHaveBeenCalled();
    const args = console.log.mock.calls[0];
    expect(args[0]).toEqual(expect.stringContaining('[INFO]'));
    expect(args[1]).toBe('');
  });

  test('warn with null data passes empty string as second arg', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warn only', null);
    expect(console.warn).toHaveBeenCalled();
    const args = console.warn.mock.calls[0];
    expect(args[0]).toEqual(expect.stringContaining('[WARN]'));
    expect(args[1]).toBe('');
  });

  test('error with undefined data passes empty string as second arg', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('error only', undefined);
    expect(console.error).toHaveBeenCalled();
    const args = console.error.mock.calls[0];
    expect(args[0]).toEqual(expect.stringContaining('[ERROR]'));
    expect(args[1]).toBe('');
  });

  test('warn called without second arg uses default empty string', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('warn no arg');
    expect(console.warn).toHaveBeenCalled();
    const args = console.warn.mock.calls[0];
    expect(args[1]).toBe('');
  });
});
