import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/utils/logger/index.js', () => ({
  default: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
    setLogger: jest.fn(),
  },
}));

const mockUserFindById = jest.fn();

jest.unstable_mockModule('../src/models/User.js', () => ({
  default: {
    findById: mockUserFindById,
  },
}));

jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

describe('Admin Middleware', () => {
  let req, res, next;
  let adminMiddleware;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    req = { headers: {}, user: {} };
    res = {};
    next = jest.fn();

    mockUserFindById.mockResolvedValue({ id: '507f1f77bcf86cd799439011', role: 'admin' });

    const module = await import('../src/modules/users/admin.middleware.js');
    adminMiddleware = module.default;
  });

  test('should call next when user is admin', async () => {
    req.user = { id: '507f1f77bcf86cd799439011', role: 'admin' };

    await adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('should call next with 403 when user is not admin', async () => {
    req.user = { id: '507f1f77bcf86cd799439011', role: 'normal' };

    await adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Admin access required',
      })
    );
  });

  test('should call next with 403 when user is missing', async () => {
    req.user = undefined;

    await adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Admin access required',
      })
    );
  });

  test('should call next with 403 when user has no role', async () => {
    req.user = { id: '507f1f77bcf86cd799439011' };

    await adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Admin access required',
      })
    );
  });
});
