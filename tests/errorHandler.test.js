import { jest } from '@jest/globals';
import errorHandler from '../src/middlewares/errorHandler.js';

describe('errorHandler middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { path: '/test-path', method: 'GET' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('logs error and sends formatted response for standard Error', () => {
    const err = new Error('Something went wrong');
    errorHandler(err, req, res, next);

    // Logger uses console.error internally; ensure it was called
    expect(console.error).toHaveBeenCalledTimes(1);
    const logArgs = console.error.mock.calls[0];
    // first arg is the formatted log message string, second arg is the metadata object
    expect(logArgs[1]).toMatchObject({
      message: err.message,
      code: undefined,
      statusCode: undefined,
      path: req.path,
      method: req.method,
    });

    // Response should be 500 with formatted error body
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        message: 'Something went wrong',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      })
    );
  });

  test('formats custom error via toJSON and respects its statusCode', () => {
    const customErr = {
      statusCode: 400,
      toJSON: () => ({
        message: 'Bad Request',
        code: 'BAD_REQUEST',
        details: [{ field: 'email', message: 'invalid' }],
      }),
    };

    errorHandler(customErr, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Bad Request',
        code: 'BAD_REQUEST',
        details: expect.any(Array),
        timestamp: expect.any(String),
      })
    );

    // Ensure logger was invoked with statusCode present
    expect(console.error).toHaveBeenCalledTimes(1);
    const meta = console.error.mock.calls[0][1];
    expect(meta).toMatchObject({ statusCode: 400, path: req.path, method: req.method });
  });
});
