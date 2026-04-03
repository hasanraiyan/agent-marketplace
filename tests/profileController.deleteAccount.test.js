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

const mockUserFindByIdWithPassword = jest.fn();
const mockUserSoftDelete = jest.fn();
const mockUserUpdateRefreshToken = jest.fn();

jest.unstable_mockModule('../src/repositories/userRepository.js', () => ({
  default: {
    findByIdWithPassword: mockUserFindByIdWithPassword,
    softDelete: mockUserSoftDelete,
    updateRefreshToken: mockUserUpdateRefreshToken,
  },
}));

const mockComparePassword = jest.fn();
const mockHashPassword = jest.fn();

jest.unstable_mockModule('../src/services/auth.service.js', () => ({
  comparePassword: mockComparePassword,
  hashPassword: mockHashPassword,
}));

jest.unstable_mockModule('../src/utils/index.js', () => ({
  errors: {},
  validators: {},
  formatters: {},
  loggerService: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
    setLogger: jest.fn(),
  },
  constants: {},
}));

describe('Profile Controller - deleteAccount', () => {
  let req, res, next;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    req = {
      body: { password: 'correctPassword' },
      user: { id: '507f1f77bcf86cd799439011' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('should soft delete account when password is correct', async () => {
    const mockUser = {
      id: '507f1f77bcf86cd799439011',
      password: 'hashedPassword',
      email: 'test@example.com',
    };

    mockUserFindByIdWithPassword.mockResolvedValue(mockUser);
    mockComparePassword.mockResolvedValue(true);
    mockUserSoftDelete.mockResolvedValue({ ...mockUser, isActive: false });
    mockUserUpdateRefreshToken.mockResolvedValue(mockUser);

    const { deleteAccount } = await import('../src/controllers/profile.controller.js');

    await deleteAccount(req, res, next);

    expect(mockUserFindByIdWithPassword).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(mockComparePassword).toHaveBeenCalledWith('correctPassword', 'hashedPassword');
    expect(mockUserSoftDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(mockUserUpdateRefreshToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011', null);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Account deletion scheduled',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 400 when password is incorrect', async () => {
    const mockUser = {
      id: '507f1f77bcf86cd799439011',
      password: 'hashedPassword',
    };

    mockUserFindByIdWithPassword.mockResolvedValue(mockUser);
    mockComparePassword.mockResolvedValue(false);

    const { deleteAccount } = await import('../src/controllers/profile.controller.js');

    await deleteAccount(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Password is incorrect',
      })
    );
  });

  test('should call next when findByIdWithPassword throws', async () => {
    mockUserFindByIdWithPassword.mockRejectedValue(new Error('DB error'));

    const { deleteAccount } = await import('../src/controllers/profile.controller.js');

    await deleteAccount(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('should call next when softDelete throws', async () => {
    const mockUser = {
      id: '507f1f77bcf86cd799439011',
      password: 'hashedPassword',
    };

    mockUserFindByIdWithPassword.mockResolvedValue(mockUser);
    mockComparePassword.mockResolvedValue(true);
    mockUserSoftDelete.mockRejectedValue(new Error('DB write failed'));

    const { deleteAccount } = await import('../src/controllers/profile.controller.js');

    await deleteAccount(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('should call next when updateRefreshToken throws', async () => {
    const mockUser = {
      id: '507f1f77bcf86cd799439011',
      password: 'hashedPassword',
    };

    mockUserFindByIdWithPassword.mockResolvedValue(mockUser);
    mockComparePassword.mockResolvedValue(true);
    mockUserSoftDelete.mockResolvedValue(mockUser);
    mockUserUpdateRefreshToken.mockRejectedValue(new Error('DB write failed'));

    const { deleteAccount } = await import('../src/controllers/profile.controller.js');

    await deleteAccount(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
