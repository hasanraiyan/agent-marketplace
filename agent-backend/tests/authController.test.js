import { jest } from '@jest/globals';

// Mock logger to suppress console output during tests
// Must be before any other unstable_mockModule calls
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

// Mock userRepository instead of User model directly
const mockUserFindByEmail = jest.fn();
const mockUserFindByEmailWithSensitive = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdateRefreshToken = jest.fn();
const mockUserUpdateEmailVerificationOTP = jest.fn();
const mockUserClearEmailVerificationOTP = jest.fn();
const mockUserMarkEmailAsVerified = jest.fn();
const mockUserUpdatePasswordResetOTP = jest.fn();
const mockUserClearPasswordResetOTP = jest.fn();
const mockUserUpdatePassword = jest.fn();
const mockUserEmailExists = jest.fn();
const mockUserFindByIdWithPassword = jest.fn();

jest.unstable_mockModule('../src/repositories/userRepository.js', () => ({
  default: {
    findByEmail: mockUserFindByEmail,
    findByEmailWithSensitive: mockUserFindByEmailWithSensitive,
    create: mockUserCreate,
    updateRefreshToken: mockUserUpdateRefreshToken,
    updateEmailVerificationOTP: mockUserUpdateEmailVerificationOTP,
    clearEmailVerificationOTP: mockUserClearEmailVerificationOTP,
    markEmailAsVerified: mockUserMarkEmailAsVerified,
    updatePasswordResetOTP: mockUserUpdatePasswordResetOTP,
    clearPasswordResetOTP: mockUserClearPasswordResetOTP,
    updatePassword: mockUserUpdatePassword,
    emailExists: mockUserEmailExists,
    findByIdWithPassword: mockUserFindByIdWithPassword,
  },
}));

const mockSendVerificationEmail = jest.fn();
const mockSendWelcomeEmail = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

jest.unstable_mockModule('../src/services/mail.service.js', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendWelcomeEmail: mockSendWelcomeEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

// Mock auth.service.js functions
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockGenerateOTP = jest.fn();
const mockHashOTP = jest.fn();
const mockCompareOTP = jest.fn();
const mockGenerateAccessToken = jest.fn();
const mockGenerateRefreshToken = jest.fn();

jest.unstable_mockModule('../src/services/auth.service.js', () => ({
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword,
  generateOTP: mockGenerateOTP,
  hashOTP: mockHashOTP,
  compareOTP: mockCompareOTP,
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
}));

// Mock utils/index.js to ensure logger mock is used
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

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, user: { id: '507f1f77bcf86cd799439011' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    mockUserFindByEmail.mockReset();
    mockUserFindByEmailWithSensitive.mockReset();
    mockUserCreate.mockReset();
    mockUserUpdateRefreshToken.mockReset();
    mockUserUpdateEmailVerificationOTP.mockReset();
    mockUserClearEmailVerificationOTP.mockReset();
    mockUserMarkEmailAsVerified.mockReset();
    mockUserUpdatePasswordResetOTP.mockReset();
    mockUserClearPasswordResetOTP.mockReset();
    mockUserUpdatePassword.mockReset();
    mockUserEmailExists.mockReset();
    mockSendVerificationEmail.mockReset();
    mockSendWelcomeEmail.mockReset();
    mockSendPasswordResetEmail.mockReset();
    mockHashPassword.mockReset();
    mockComparePassword.mockReset();
    mockGenerateOTP.mockReset();
    mockHashOTP.mockReset();
    mockCompareOTP.mockReset();
    mockGenerateAccessToken.mockReset();
    mockGenerateRefreshToken.mockReset();
    mockUserFindByIdWithPassword.mockReset();
  });

  describe('register', () => {
    test('should register a new user and return 201', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockUserEmailExists.mockResolvedValue(false);
      mockHashPassword.mockResolvedValue('hashedPassword');
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashedOTP');
      mockUserCreate.mockResolvedValue(mockUser);
      mockSendVerificationEmail.mockResolvedValue(undefined);

      const { register } = await import('../src/controllers/auth.controller.js');

      req.body = { name: 'John Doe', email: 'john@example.com', password: 'password123' };
      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Registration successful. Please verify your email.',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 409 if email already exists', async () => {
      mockUserEmailExists.mockResolvedValue(true);

      const { register } = await import('../src/controllers/auth.controller.js');

      req.body = { name: 'John Doe', email: 'john@example.com', password: 'password123' };
      await register(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 409, message: 'Email already registered' })
      );
    });

    test('should handle verification email fire-and-forget rejection', async () => {
      const mockUser = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
      };

      mockUserEmailExists.mockResolvedValue(false);
      mockHashPassword.mockResolvedValue('hashedPassword');
      mockGenerateOTP.mockReturnValue('123456');
      mockHashOTP.mockResolvedValue('hashedOTP');
      mockUserCreate.mockResolvedValue(mockUser);
      mockSendVerificationEmail.mockRejectedValue(new Error('Email service down'));

      const { register } = await import('../src/controllers/auth.controller.js');

      req.body = { name: 'John Doe', email: 'john@example.com', password: 'password123' };
      await register(req, res, next);

      // Should still succeed even if email fails
      expect(res.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next with error when repository throws unexpected error', async () => {
      mockUserEmailExists.mockRejectedValue(new Error('Database connection failed'));

      const { register } = await import('../src/controllers/auth.controller.js');

      req.body = { name: 'John Doe', email: 'john@example.com', password: 'password123' };
      await register(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('login', () => {
    test('should return 401 for non-existent user', async () => {
      const notFoundError = new Error('User not found');
      notFoundError.name = 'NotFoundError';
      mockUserFindByEmail.mockRejectedValue(notFoundError);

      const { login } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', password: 'password123' };
      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: 'Invalid email or password' })
      );
    });

    test('should return 401 for wrong password', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        password: 'hashedPassword',
        emailVerified: true,
      };

      mockUserFindByEmail.mockResolvedValue(user);
      mockUserFindByIdWithPassword.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(false);

      const { login } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', password: 'wrongpassword' };
      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: 'Invalid email or password' })
      );
    });

    test('should return 403 if email not verified', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        password: 'hashedPassword',
        emailVerified: false,
      };

      mockUserFindByEmail.mockResolvedValue(user);
      mockUserFindByIdWithPassword.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);

      const { login } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', password: 'password123' };
      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403, message: 'Please verify your email first' })
      );
    });

    test('should login successfully and return tokens', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword',
        emailVerified: true,
      };

      mockUserFindByEmail.mockResolvedValue(user);
      mockUserFindByIdWithPassword.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockGenerateAccessToken.mockReturnValue('access-token-123');
      mockGenerateRefreshToken.mockReturnValue('refresh-token-456');
      mockUserUpdateRefreshToken.mockResolvedValue(undefined);

      const { login } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', password: 'password123' };
      await login(req, res, next);

      expect(mockGenerateAccessToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockGenerateRefreshToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockUserUpdateRefreshToken).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'refresh-token-456'
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-456',
            user: expect.objectContaining({
              id: '507f1f77bcf86cd799439011',
              name: 'John Doe',
              email: 'john@example.com',
              emailVerified: true,
            }),
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should throw non-NotFoundError from findByEmail', async () => {
      mockUserFindByEmail.mockRejectedValue(new Error('Database error'));

      const { login } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', password: 'password123' };
      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should call next when findByIdWithPassword throws', async () => {
      const user = { id: '507f1f77bcf86cd799439011', email: 'john@example.com' };
      mockUserFindByEmail.mockResolvedValue(user);
      mockUserFindByIdWithPassword.mockRejectedValue(new Error('DB error'));

      const { login } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', password: 'password123' };
      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('logout', () => {
    test('should logout successfully', async () => {
      mockUserUpdateRefreshToken.mockResolvedValue(undefined);

      const { logout } = await import('../src/controllers/auth.controller.js');

      req.user = { id: '507f1f77bcf86cd799439011' };
      await logout(req, res, next);

      expect(mockUserUpdateRefreshToken).toHaveBeenCalledWith('507f1f77bcf86cd799439011', null);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Logged out successfully',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next when repository throws error', async () => {
      mockUserUpdateRefreshToken.mockRejectedValue(new Error('DB error'));

      const { logout } = await import('../src/controllers/auth.controller.js');

      req.user = { id: '507f1f77bcf86cd799439011' };
      await logout(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('verifyEmailOTP', () => {
    test('should return 404 if user not found', async () => {
      const notFoundError = new Error('User not found');
      notFoundError.name = 'NotFoundError';
      mockUserFindByEmailWithSensitive.mockRejectedValue(notFoundError);

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456' };
      await verifyEmailOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: 'User not found' })
      );
    });

    test('should return 400 if email already verified', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: true,
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456' };
      await verifyEmailOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'Email already verified' })
      );
    });

    test('should return 400 if no OTP found', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: false,
        emailVerificationOTP: null,
        emailVerificationOTPExpires: null,
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456' };
      await verifyEmailOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'No OTP found. Please request a new one.',
        })
      );
    });

    test('should return 400 if OTP expired', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: false,
        emailVerificationOTP: 'hashedOTP',
        emailVerificationOTPExpires: new Date(Date.now() - 60000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456' };
      await verifyEmailOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'OTP has expired' })
      );
    });

    test('should return 400 if OTP is invalid', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: false,
        emailVerificationOTP: 'hashedOTP',
        emailVerificationOTPExpires: new Date(Date.now() + 600000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);
      mockCompareOTP.mockResolvedValue(false);

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: 'wrongOTP' };
      await verifyEmailOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'Invalid OTP' })
      );
    });

    test('should verify email successfully', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        emailVerified: false,
        emailVerificationOTP: 'hashedOTP',
        emailVerificationOTPExpires: new Date(Date.now() + 600000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);
      mockCompareOTP.mockResolvedValue(true);
      mockUserMarkEmailAsVerified.mockResolvedValue(undefined);
      mockUserClearEmailVerificationOTP.mockResolvedValue(undefined);
      mockSendWelcomeEmail.mockResolvedValue(undefined);

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456' };
      await verifyEmailOTP(req, res, next);

      expect(mockUserMarkEmailAsVerified).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockUserClearEmailVerificationOTP).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockSendWelcomeEmail).toHaveBeenCalledWith('john@example.com', 'John Doe');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Email verified successfully',
        })
      );
    });

    test('should handle welcome email fire-and-forget rejection', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        email: 'john@example.com',
        emailVerified: false,
        emailVerificationOTP: 'hashedOTP',
        emailVerificationOTPExpires: new Date(Date.now() + 600000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);
      mockCompareOTP.mockResolvedValue(true);
      mockUserMarkEmailAsVerified.mockResolvedValue(undefined);
      mockUserClearEmailVerificationOTP.mockResolvedValue(undefined);
      mockSendWelcomeEmail.mockRejectedValue(new Error('Email service down'));

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456' };
      await verifyEmailOTP(req, res, next);

      // Should still succeed
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Email verified successfully' })
      );
    });

    test('should throw non-NotFoundError from findByEmailWithSensitive', async () => {
      mockUserFindByEmailWithSensitive.mockRejectedValue(new Error('DB error'));

      const { verifyEmailOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456' };
      await verifyEmailOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('resendOTP', () => {
    test('should resend OTP successfully', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: false,
      };

      mockUserFindByEmail.mockResolvedValue(user);
      mockGenerateOTP.mockReturnValue('654321');
      mockHashOTP.mockResolvedValue('hashedNewOTP');
      mockUserUpdateEmailVerificationOTP.mockResolvedValue(undefined);
      mockSendVerificationEmail.mockResolvedValue(undefined);

      const { resendOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await resendOTP(req, res, next);

      expect(mockUserUpdateEmailVerificationOTP).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'hashedNewOTP',
        expect.any(Date)
      );
      expect(mockSendVerificationEmail).toHaveBeenCalledWith('john@example.com', '654321');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Verification OTP sent',
        })
      );
    });

    test('should return 404 if user not found', async () => {
      const notFoundError = new Error('User not found');
      notFoundError.name = 'NotFoundError';
      mockUserFindByEmail.mockRejectedValue(notFoundError);

      const { resendOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await resendOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: 'User not found' })
      );
    });

    test('should return 400 if email already verified', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: true,
      };

      mockUserFindByEmail.mockResolvedValue(user);

      const { resendOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await resendOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'Email already verified' })
      );
    });

    test('should throw non-NotFoundError from findByEmail', async () => {
      mockUserFindByEmail.mockRejectedValue(new Error('DB error'));

      const { resendOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await resendOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should handle verification email fire-and-forget rejection', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: false,
      };

      mockUserFindByEmail.mockResolvedValue(user);
      mockGenerateOTP.mockReturnValue('654321');
      mockHashOTP.mockResolvedValue('hashedNewOTP');
      mockUserUpdateEmailVerificationOTP.mockResolvedValue(undefined);
      mockSendVerificationEmail.mockRejectedValue(new Error('Email down'));

      const { resendOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await resendOTP(req, res, next);

      // Should still succeed
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Verification OTP sent' })
      );
    });

    test('should call next when repository throws unexpected error', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        emailVerified: false,
      };

      mockUserFindByEmail.mockResolvedValue(user);
      mockGenerateOTP.mockReturnValue('654321');
      mockHashOTP.mockResolvedValue('hashedNewOTP');
      mockUserUpdateEmailVerificationOTP.mockRejectedValue(new Error('DB write failed'));

      const { resendOTP } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await resendOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('forgotPassword', () => {
    test('should return 404 if user not found', async () => {
      const notFoundError = new Error('User not found');
      notFoundError.name = 'NotFoundError';
      mockUserFindByEmail.mockRejectedValue(notFoundError);

      const { forgotPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: 'User not found' })
      );
    });

    test('should send password reset OTP successfully', async () => {
      const user = { id: '507f1f77bcf86cd799439011', email: 'john@example.com' };

      mockUserFindByEmail.mockResolvedValue(user);
      mockGenerateOTP.mockReturnValue('999888');
      mockHashOTP.mockResolvedValue('hashedResetOTP');
      mockUserUpdatePasswordResetOTP.mockResolvedValue(undefined);
      mockSendPasswordResetEmail.mockResolvedValue(undefined);

      const { forgotPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await forgotPassword(req, res, next);

      expect(mockUserUpdatePasswordResetOTP).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'hashedResetOTP',
        expect.any(Date)
      );
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('john@example.com', '999888');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password reset OTP sent to your email',
        })
      );
    });

    test('should throw non-NotFoundError from findByEmail', async () => {
      mockUserFindByEmail.mockRejectedValue(new Error('DB error'));

      const { forgotPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should handle password reset email fire-and-forget rejection', async () => {
      const user = { id: '507f1f77bcf86cd799439011', email: 'john@example.com' };

      mockUserFindByEmail.mockResolvedValue(user);
      mockGenerateOTP.mockReturnValue('999888');
      mockHashOTP.mockResolvedValue('hashedResetOTP');
      mockUserUpdatePasswordResetOTP.mockResolvedValue(undefined);
      mockSendPasswordResetEmail.mockRejectedValue(new Error('Email down'));

      const { forgotPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await forgotPassword(req, res, next);

      // Should still succeed
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Password reset OTP sent to your email' })
      );
    });

    test('should call next when repository throws unexpected error', async () => {
      const user = { id: '507f1f77bcf86cd799439011', email: 'john@example.com' };

      mockUserFindByEmail.mockResolvedValue(user);
      mockGenerateOTP.mockReturnValue('999888');
      mockHashOTP.mockResolvedValue('hashedResetOTP');
      mockUserUpdatePasswordResetOTP.mockRejectedValue(new Error('DB write failed'));

      const { forgotPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com' };
      await forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('resetPassword', () => {
    test('should reset password successfully', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        passwordResetOTP: 'hashedResetOTP',
        passwordResetOTPExpires: new Date(Date.now() + 600000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);
      mockCompareOTP.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue('newHashedPassword');
      mockUserUpdatePassword.mockResolvedValue(undefined);
      mockUserClearPasswordResetOTP.mockResolvedValue(undefined);

      const { resetPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '999888', newPassword: 'newPass123' };
      await resetPassword(req, res, next);

      expect(mockHashPassword).toHaveBeenCalledWith('newPass123');
      expect(mockUserUpdatePassword).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'newHashedPassword'
      );
      expect(mockUserClearPasswordResetOTP).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password reset successfully',
        })
      );
    });

    test('should return 404 if user not found', async () => {
      const notFoundError = new Error('User not found');
      notFoundError.name = 'NotFoundError';
      mockUserFindByEmailWithSensitive.mockRejectedValue(notFoundError);

      const { resetPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456', newPassword: 'newPass123' };
      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404, message: 'User not found' })
      );
    });

    test('should return 400 if no reset OTP found', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        passwordResetOTP: null,
        passwordResetOTPExpires: null,
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);

      const { resetPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456', newPassword: 'newPass123' };
      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'No reset OTP found. Please request a new one.',
        })
      );
    });

    test('should return 400 if reset OTP expired', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        passwordResetOTP: 'hashedResetOTP',
        passwordResetOTPExpires: new Date(Date.now() - 60000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);

      const { resetPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456', newPassword: 'newPass123' };
      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'OTP has expired' })
      );
    });

    test('should return 400 if reset OTP is invalid', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        passwordResetOTP: 'hashedResetOTP',
        passwordResetOTPExpires: new Date(Date.now() + 600000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);
      mockCompareOTP.mockResolvedValue(false);

      const { resetPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: 'wrongOTP', newPassword: 'newPass123' };
      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'Invalid OTP' })
      );
    });

    test('should throw non-NotFoundError from findByEmailWithSensitive', async () => {
      mockUserFindByEmailWithSensitive.mockRejectedValue(new Error('DB error'));

      const { resetPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '123456', newPassword: 'newPass123' };
      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should call next when repository throws unexpected error', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'john@example.com',
        passwordResetOTP: 'hashedResetOTP',
        passwordResetOTPExpires: new Date(Date.now() + 600000),
      };

      mockUserFindByEmailWithSensitive.mockResolvedValue(user);
      mockCompareOTP.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue('newHashedPassword');
      mockUserUpdatePassword.mockRejectedValue(new Error('DB write failed'));

      const { resetPassword } = await import('../src/controllers/auth.controller.js');

      req.body = { email: 'john@example.com', otp: '999888', newPassword: 'newPass123' };
      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('default export', () => {
    test('should export all controller functions', async () => {
      const authController = await import('../src/controllers/auth.controller.js');

      expect(authController.default).toBeDefined();
      expect(authController.default.register).toBe(authController.register);
      expect(authController.default.login).toBe(authController.login);
      expect(authController.default.logout).toBe(authController.logout);
      expect(authController.default.verifyEmailOTP).toBe(authController.verifyEmailOTP);
      expect(authController.default.resendOTP).toBe(authController.resendOTP);
      expect(authController.default.forgotPassword).toBe(authController.forgotPassword);
      expect(authController.default.resetPassword).toBe(authController.resetPassword);
    });
  });
});
