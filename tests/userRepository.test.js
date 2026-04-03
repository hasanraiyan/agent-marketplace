import { jest } from '@jest/globals';
import userRepository from '../src/repositories/userRepository.js';
import User from '../src/models/User.js';
import { ValidationError, NotFoundError } from '../src/utils/errors/index.js';

describe('User Repository', () => {
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      toObject: jest.fn().mockReturnValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
  });

  describe('create', () => {
    test('should create a user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      // Mock User constructor and save method
      const mockSave = jest.fn().mockResolvedValue(mockUser);
      const mockUserInstance = {
        save: mockSave,
      };

      // We need to mock the User model constructor
      // Since we can't directly mock the constructor, we'll spy on the prototype
      const userSpy = jest.spyOn(User.prototype, 'save').mockResolvedValue(mockUser);

      const result = await userRepository.create(userData);

      // Verify save was called
      expect(userSpy).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    test('should throw ValidationError for invalid data', async () => {
      const invalidData = {
        name: 'J', // Too short
        email: 'invalid-email',
      };

      await expect(userRepository.create(invalidData)).rejects.toThrow(ValidationError);
    });

    test('should throw ValidationError for duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;

      jest.spyOn(User.prototype, 'save').mockRejectedValue(duplicateError);

      await expect(userRepository.create(userData)).rejects.toThrow(ValidationError);
    });

    test('should re-throw generic errors during creation', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const genericError = new Error('Database connection failed');

      jest.spyOn(User.prototype, 'save').mockRejectedValue(genericError);

      await expect(userRepository.create(userData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById', () => {
    test('should find user by ID', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      const result = await userRepository.findById('507f1f77bcf86cd799439011');

      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      await expect(userRepository.findById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findByEmail', () => {
    test('should find user by email', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('john@example.com');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
      expect(result).toEqual(mockUser);
    });

    test('should throw NotFoundError when email not found', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      await expect(userRepository.findByEmail('nonexistent@example.com')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('findAll', () => {
    test('should return paginated users', async () => {
      const mockUsers = [mockUser, { ...mockUser, _id: '507f1f77bcf86cd799439012' }];

      jest.spyOn(User, 'find').mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockUsers),
      });

      jest.spyOn(User, 'countDocuments').mockResolvedValue(25);

      const result = await userRepository.findAll({ page: 2, limit: 10 });

      expect(result.users).toEqual(mockUsers);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    test('should use default pagination values', async () => {
      jest.spyOn(User, 'find').mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });

      jest.spyOn(User, 'countDocuments').mockResolvedValue(0);

      const result = await userRepository.findAll();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
  });

  describe('update', () => {
    test('should update user successfully', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.update('507f1f77bcf86cd799439011', {
        name: 'Updated Name',
      });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ name: 'Updated Name', updatedAt: expect.any(Date) }),
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when updating non-existent user', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(userRepository.update('nonexistent', { name: 'Updated' })).rejects.toThrow(
        NotFoundError
      );
    });

    test('should throw ValidationError for duplicate email on update', async () => {
      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;

      jest.spyOn(User, 'findByIdAndUpdate').mockRejectedValue(duplicateError);

      await expect(
        userRepository.update('507f1f77bcf86cd799439011', { email: 'duplicate@example.com' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    test('should delete user successfully', async () => {
      jest.spyOn(User, 'findByIdAndDelete').mockResolvedValue(mockUser);

      const result = await userRepository.delete('507f1f77bcf86cd799439011');

      expect(User.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockUser);
    });

    test('should throw NotFoundError when deleting non-existent user', async () => {
      jest.spyOn(User, 'findByIdAndDelete').mockResolvedValue(null);

      await expect(userRepository.delete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('softDelete', () => {
    test('should soft delete user (set isActive to false)', async () => {
      const softDeletedUser = { ...mockUser, isActive: false };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(softDeletedUser);

      const result = await userRepository.softDelete('507f1f77bcf86cd799439011');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { isActive: false, updatedAt: expect.any(Date) },
        { new: true }
      );
      expect(result.isActive).toBe(false);
    });

    test('should throw NotFoundError when soft deleting non-existent user', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(userRepository.softDelete('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('count', () => {
    test('should return count of users', async () => {
      jest.spyOn(User, 'countDocuments').mockResolvedValue(42);

      const result = await userRepository.count();

      expect(User.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(42);
    });

    test('should apply filter when provided', async () => {
      jest.spyOn(User, 'countDocuments').mockResolvedValue(10);

      const filter = { isActive: true };
      await userRepository.count(filter);

      expect(User.countDocuments).toHaveBeenCalledWith(filter);
    });
  });

  describe('emailExists', () => {
    test('should return true if email exists', async () => {
      jest.spyOn(User, 'countDocuments').mockResolvedValue(1);

      const result = await userRepository.emailExists('existing@example.com');

      expect(User.countDocuments).toHaveBeenCalledWith({ email: 'existing@example.com' });
      expect(result).toBe(true);
    });

    test('should return false if email does not exist', async () => {
      jest.spyOn(User, 'countDocuments').mockResolvedValue(0);

      const result = await userRepository.emailExists('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  describe('findByIdWithPassword', () => {
    test('should find user by ID with password field selected', async () => {
      const userWithPassword = { ...mockUser, password: 'hashedpassword' };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithPassword),
      });

      const result = await userRepository.findByIdWithPassword('507f1f77bcf86cd799439011');

      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(userWithPassword);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(userRepository.findByIdWithPassword('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('findByEmailWithSensitive', () => {
    test('should find user by email with sensitive fields selected', async () => {
      const userWithSensitiveFields = {
        ...mockUser,
        password: 'hashedpassword',
        refreshToken: 'token123',
        emailVerificationOTP: 'otp123',
        emailVerificationOTPExpires: new Date(),
        passwordResetOTP: 'resetotp123',
        passwordResetOTPExpires: new Date(),
      };

      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithSensitiveFields),
      });

      const result = await userRepository.findByEmailWithSensitive('john@example.com');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
      expect(result).toEqual(userWithSensitiveFields);
    });

    test('should throw NotFoundError when email not found', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        userRepository.findByEmailWithSensitive('nonexistent@example.com')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateRefreshToken', () => {
    test('should update refresh token successfully', async () => {
      const updatedUser = { ...mockUser, refreshToken: 'newtoken123' };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.updateRefreshToken(
        '507f1f77bcf86cd799439011',
        'newtoken123'
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { refreshToken: 'newtoken123', updatedAt: expect.any(Date) },
        { new: true, runValidators: false }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(userRepository.updateRefreshToken('nonexistent', 'token123')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('updateEmailVerificationOTP', () => {
    test('should update email verification OTP successfully', async () => {
      const expiresAt = new Date();
      const updatedUser = {
        ...mockUser,
        emailVerificationOTP: 'hashedotp123',
        emailVerificationOTPExpires: expiresAt,
      };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.updateEmailVerificationOTP(
        '507f1f77bcf86cd799439011',
        'hashedotp123',
        expiresAt
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        {
          emailVerificationOTP: 'hashedotp123',
          emailVerificationOTPExpires: expiresAt,
          updatedAt: expect.any(Date),
        },
        { new: true, runValidators: false }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(
        userRepository.updateEmailVerificationOTP('nonexistent', 'otp123', new Date())
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('clearEmailVerificationOTP', () => {
    test('should clear email verification OTP successfully', async () => {
      const updatedUser = {
        ...mockUser,
        emailVerificationOTP: undefined,
        emailVerificationOTPExpires: undefined,
      };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.clearEmailVerificationOTP('507f1f77bcf86cd799439011');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        {
          emailVerificationOTP: undefined,
          emailVerificationOTPExpires: undefined,
          updatedAt: expect.any(Date),
        },
        { new: true, runValidators: false }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(userRepository.clearEmailVerificationOTP('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('updatePasswordResetOTP', () => {
    test('should update password reset OTP successfully', async () => {
      const expiresAt = new Date();
      const updatedUser = {
        ...mockUser,
        passwordResetOTP: 'hashedotp123',
        passwordResetOTPExpires: expiresAt,
      };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.updatePasswordResetOTP(
        '507f1f77bcf86cd799439011',
        'hashedotp123',
        expiresAt
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        {
          passwordResetOTP: 'hashedotp123',
          passwordResetOTPExpires: expiresAt,
          updatedAt: expect.any(Date),
        },
        { new: true, runValidators: false }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(
        userRepository.updatePasswordResetOTP('nonexistent', 'otp123', new Date())
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('clearPasswordResetOTP', () => {
    test('should clear password reset OTP successfully', async () => {
      const updatedUser = {
        ...mockUser,
        passwordResetOTP: undefined,
        passwordResetOTPExpires: undefined,
      };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.clearPasswordResetOTP('507f1f77bcf86cd799439011');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        {
          passwordResetOTP: undefined,
          passwordResetOTPExpires: undefined,
          updatedAt: expect.any(Date),
        },
        { new: true, runValidators: false }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(userRepository.clearPasswordResetOTP('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('markEmailAsVerified', () => {
    test('should mark email as verified successfully', async () => {
      const updatedUser = { ...mockUser, emailVerified: true };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.markEmailAsVerified('507f1f77bcf86cd799439011');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { emailVerified: true, updatedAt: expect.any(Date) },
        { new: true, runValidators: false }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(userRepository.markEmailAsVerified('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('findByIdForProfile', () => {
    test('should find user by ID excluding sensitive fields', async () => {
      const userForProfile = {
        ...mockUser,
        password: undefined,
        refreshToken: undefined,
        emailVerificationOTP: undefined,
        emailVerificationOTPExpires: undefined,
        passwordResetOTP: undefined,
        passwordResetOTPExpires: undefined,
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(userForProfile),
      });

      const result = await userRepository.findByIdForProfile('507f1f77bcf86cd799439011');

      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(userForProfile);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(userRepository.findByIdForProfile('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePassword', () => {
    test('should update password successfully', async () => {
      const updatedUser = { ...mockUser, password: 'newhashedpassword' };

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(updatedUser);

      const result = await userRepository.updatePassword(
        '507f1f77bcf86cd799439011',
        'newhashedpassword'
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { password: 'newhashedpassword', updatedAt: expect.any(Date) },
        { new: true, runValidators: false }
      );
      expect(result).toEqual(updatedUser);
    });

    test('should throw NotFoundError when user not found', async () => {
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(null);

      await expect(userRepository.updatePassword('nonexistent', 'newpassword')).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
