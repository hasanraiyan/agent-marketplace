import { jest } from '@jest/globals';
import { successFormatter, errorFormatter } from '../src/utils/formatters/index.js';

describe('formatters - additional cases', () => {
  test('formatSuccess uses default message and code when not provided', () => {
    const res = successFormatter.formatSuccess({ foo: 'bar' });
    expect(res).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: { foo: 'bar' },
    });
    expect(res.timestamp).toEqual(expect.any(String));
  });

  test('formatList uses default limit and computes pages correctly', () => {
    const items = [{}, {}];
    const list = successFormatter.formatList(items, 3);
    expect(list.data.pagination).toMatchObject({ total: 3, page: 1, limit: 10, pages: 1 });
  });

  test('formatList with limit 0 yields pages Infinity', () => {
    const list = successFormatter.formatList([], 5, 1, 0);
    expect(list.data.pagination.pages).toEqual(Infinity);
  });

  test('errorFormatter ignores non-function toJSON property', () => {
    const bad = { message: 'oops', toJSON: true };
    const formatted = errorFormatter.formatError(bad, 418);
    expect(formatted).toMatchObject({
      success: false,
      statusCode: 418,
      message: 'oops',
      code: 'INTERNAL_ERROR',
    });
  });

  test('errorFormatter uses default statusCode when not provided', () => {
    const err = new Error('test');
    const formatted = errorFormatter.formatError(err);
    expect(formatted.statusCode).toBe(500);
  });

  test('errorFormatter uses default message when error.message is missing', () => {
    const err = {};
    const formatted = errorFormatter.formatError(err, 400);
    expect(formatted.message).toBe('Internal Server Error');
  });

  test('errorFormatter uses default message when error.message is empty string', () => {
    const err = { message: '' };
    const formatted = errorFormatter.formatError(err, 400);
    expect(formatted.message).toBe('Internal Server Error');
  });

  test('errorFormatter uses custom code when provided', () => {
    const err = { message: 'test', code: 'CUSTOM_CODE' };
    const formatted = errorFormatter.formatError(err, 400);
    expect(formatted.code).toBe('CUSTOM_CODE');
  });
});
