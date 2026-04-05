import { jest } from '@jest/globals';
import { errorFormatter, successFormatter } from '../src/utils/formatters/index.js';

describe('formatters', () => {
  test('errorFormatter formats standard Error', () => {
    const err = new Error('Something broke');
    const formatted = errorFormatter.formatError(err, 500);
    expect(formatted).toMatchObject({
      success: false,
      statusCode: 500,
      message: 'Something broke',
      code: 'INTERNAL_ERROR',
    });
    expect(formatted.timestamp).toEqual(expect.any(String));
  });

  test('errorFormatter uses toJSON when available', () => {
    const custom = { toJSON: () => ({ message: 'Bad', code: 'BAD', extra: true }) };
    const formatted = errorFormatter.formatError(custom, 400);
    expect(formatted).toMatchObject({ success: false, message: 'Bad', code: 'BAD', extra: true });
    expect(formatted.timestamp).toEqual(expect.any(String));
  });

  test('successFormatter formatSuccess and formatList', () => {
    const data = { hello: 'world' };
    const s = successFormatter.formatSuccess(data, 'OK', 200);
    expect(s).toMatchObject({ success: true, statusCode: 200, message: 'OK', data });
    expect(s.timestamp).toEqual(expect.any(String));

    const items = [{ id: 1 }, { id: 2 }];
    const list = successFormatter.formatList(items, 50, 2, 10);
    expect(list).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Data retrieved successfully',
    });
    expect(list.data.pagination).toMatchObject({ total: 50, page: 2, limit: 10, pages: 5 });
    expect(list.timestamp).toEqual(expect.any(String));
  });
});
