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

const mockUserFindByIdForProfile = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserFindByIdWithPassword = jest.fn();
const mockUserUpdatePassword = jest.fn();

jest.unstable_mockModule('../src/repositories/userRepository.js', () => ({
  default: {
    findByIdForProfile: mockUserFindByIdForProfile,
    update: mockUserUpdate,
    findByIdWithPassword: mockUserFindByIdWithPassword,
    updatePassword: mockUserUpdatePassword,
  },
}));

const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();

jest.unstable_mockModule('../src/services/auth.service.js', () => ({
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword,
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

describe('Profile Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = { body: {}, user: { id: '507f1f77bcf86cd799439011' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('getProfile', () => {
    test('should return profile successfully', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        role: 'normal',
        emailVerified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockUserFindByIdForProfile.mockResolvedValue(mockUser);

      const { getProfile } = await import('../src/controllers/profile.controller.js');

      await getProfile(req, res, next);

      expect(mockUserFindByIdForProfile).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: '507f1f77bcf86cd799439011',
            name: 'John Doe',
            email: 'john@example.com',
            age: 30,
            isActive: true,
            role: 'normal',
            emailVerified: true,
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next when repository throws error', async () => {
      mockUserFindByIdForProfile.mockRejectedValue(new Error('DB error'));

      const { getProfile } = await import('../src/controllers/profile.controller.js');

      await getProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should return profile without sensitive fields', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'jane@example.com',
        age: 25,
        isActive: true,
        role: 'admin',
        emailVerified: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockUserFindByIdForProfile.mockResolvedValue(mockUser);

      const { getProfile } = await import('../src/controllers/profile.controller.js');

      await getProfile(req, res, next);

      const responseData = res.json.mock.calls[0][0].data;
      expect(responseData).not.toHaveProperty('password');
      expect(responseData).not.toHaveProperty('refreshToken');
      expect(responseData).not.toHaveProperty('emailVerificationOTP');
      expect(responseData).not.toHaveProperty('passwordResetOTP');
    });
  });

  describe('updateProfile', () => {
    test('should update name successfully', async () => {
      const updatedUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'Updated Name',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        role: 'normal',
        emailVerified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockUserUpdate.mockResolvedValue(updatedUser);

      const { updateProfile } = await import('../src/controllers/profile.controller.js');

      req.body = { name: 'Updated Name' };
      await updateProfile(req, res, next);

      expect(mockUserUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ name: 'Updated Name' })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile updated successfully',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should update age successfully', async () => {
      const updatedUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        age: 35,
        isActive: true,
        role: 'normal',
        emailVerified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockUserUpdate.mockResolvedValue(updatedUser);

      const { updateProfile } = await import('../src/controllers/profile.controller.js');

      req.body = { age: 35 };
      await updateProfile(req, res, next);

      expect(mockUserUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ age: 35 })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile updated successfully',
        })
      );
    });

    test('should update both name and age', async () => {
      const updatedUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'New Name',
        email: 'john@example.com',
        age: 40,
        isActive: true,
        role: 'normal',
        emailVerified: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockUserUpdate.mockResolvedValue(updatedUser);

      const { updateProfile } = await import('../src/controllers/profile.controller.js');

      req.body = { name: 'New Name', age: 40 };
      await updateProfile(req, res, next);

      expect(mockUserUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ name: 'New Name', age: 40 })
      );
    });

    test('should return 400 when no fields to update', async () => {
      const { updateProfile } = await import('../src/controllers/profile.controller.js');

      req.body = {};
      await updateProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'No fields to update' })
      );
    });

    test('should call next when repository throws error', async () => {
      mockUserUpdate.mockRejectedValue(new Error('DB error'));

      const { updateProfile } = await import('../src/controllers/profile.controller.js');

      req.body = { name: 'Updated Name' };
      await updateProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('changePassword', () => {
    test('should change password successfully', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        password: 'hashedCurrentPassword',
      };

      mockUserFindByIdWithPassword.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue('hashedNewPassword');
      mockUserUpdatePassword.mockResolvedValue(undefined);

      const { changePassword } = await import('../src/controllers/profile.controller.js');

      req.body = { currentPassword: 'currentPass123', newPassword: 'newPass123' };
      await changePassword(req, res, next);

      expect(mockUserFindByIdWithPassword).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockComparePassword).toHaveBeenCalledWith('currentPass123', 'hashedCurrentPassword');
      expect(mockHashPassword).toHaveBeenCalledWith('newPass123');
      expect(mockUserUpdatePassword).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'hashedNewPassword'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 400 when current password is incorrect', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        password: 'hashedCurrentPassword',
      };

      mockUserFindByIdWithPassword.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);

      const { changePassword } = await import('../src/controllers/profile.controller.js');

      req.body = { currentPassword: 'wrongPassword', newPassword: 'newPass123' };
      await changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Current password is incorrect',
        })
      );
    });

    test('should call next when findByIdWithPassword throws', async () => {
      mockUserFindByIdWithPassword.mockRejectedValue(new Error('DB error'));

      const { changePassword } = await import('../src/controllers/profile.controller.js');

      req.body = { currentPassword: 'currentPass123', newPassword: 'newPass123' };
      await changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should call next when updatePassword throws', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        password: 'hashedCurrentPassword',
      };

      mockUserFindByIdWithPassword.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue('hashedNewPassword');
      mockUserUpdatePassword.mockRejectedValue(new Error('DB write failed'));

      const { changePassword } = await import('../src/controllers/profile.controller.js');

      req.body = { currentPassword: 'currentPass123', newPassword: 'newPass123' };
      await changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('default export', () => {
    test('should export all controller functions', async () => {
      const profileController = await import('../src/controllers/profile.controller.js');

      expect(profileController.default).toBeDefined();
      expect(profileController.default.getProfile).toBe(profileController.getProfile);
      expect(profileController.default.updateProfile).toBe(profileController.updateProfile);
      expect(profileController.default.changePassword).toBe(profileController.changePassword);
    });
  });
});
