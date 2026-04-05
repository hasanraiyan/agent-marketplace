import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Reset module registry so unstable_mockModule applies correctly
jest.resetModules();

// Set up JWT secrets before importing any modules
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';

describe('Auth Middleware', () => {
  let req, res, next;
  let authMiddleware;
  let mockUserFindById;

  beforeEach(async () => {
    // Reset modules to ensure fresh imports with mocks
    jest.resetModules();

    req = { headers: {} };
    res = {};
    next = jest.fn();

    mockUserFindById = jest.fn();

    jest.unstable_mockModule('../src/models/User.js', () => ({
      default: {
        findById: mockUserFindById,
      },
    }));

    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));

    // Import the module fresh for each test to ensure mocks are in place
    const module = await import('../src/middlewares/auth.middleware.js');
    authMiddleware = module.default;
  });

  test('should call next with error if no authorization header', async () => {
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('should call next with error if authorization header does not start with Bearer', async () => {
    req.headers.authorization = 'Basic sometoken';
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('should call next with error if token is invalid', async () => {
    req.headers.authorization = 'Bearer invalid.token.here';
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('should call next with error if user not found', async () => {
    const token = jwt.sign(
      { userId: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'test-secret',
      {
        expiresIn: '15m',
      }
    );
    req.headers.authorization = `Bearer ${token}`;
    mockUserFindById.mockResolvedValue(null);
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('should set req.user and call next() if token is valid', async () => {
    const mockUser = { id: '507f1f77bcf86cd799439011', name: 'Test', email: 'test@example.com' };
    const token = jwt.sign({ userId: mockUser.id }, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '15m',
    });
    req.headers.authorization = `Bearer ${token}`;
    mockUserFindById.mockResolvedValue(mockUser);
    await authMiddleware(req, res, next);
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledWith();
  });
});
