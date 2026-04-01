import { jest } from '@jest/globals';
import {
  registerSchema,
  loginSchema,
  verifyEmailOTPSchema,
  resendOTPSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../src/validators/auth.validator.js';

describe('Auth Validators', () => {
  describe('registerSchema', () => {
    test('should validate correct registration data', () => {
      const data = { name: 'John Doe', email: 'john@example.com', password: 'password123' };
      const result = registerSchema.parse(data);
      expect(result).toEqual(data);
    });

    test('should reject missing name', () => {
      const data = { email: 'john@example.com', password: 'password123' };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    test('should reject short name', () => {
      const data = { name: 'J', email: 'john@example.com', password: 'password123' };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    test('should reject invalid email', () => {
      const data = { name: 'John Doe', email: 'invalid', password: 'password123' };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    test('should reject short password', () => {
      const data = { name: 'John Doe', email: 'john@example.com', password: 'short' };
      expect(() => registerSchema.parse(data)).toThrow();
    });
  });

  describe('loginSchema', () => {
    test('should validate correct login data', () => {
      const data = { email: 'john@example.com', password: 'password123' };
      const result = loginSchema.parse(data);
      expect(result).toEqual(data);
    });

    test('should reject missing email', () => {
      const data = { password: 'password123' };
      expect(() => loginSchema.parse(data)).toThrow();
    });

    test('should reject missing password', () => {
      const data = { email: 'john@example.com' };
      expect(() => loginSchema.parse(data)).toThrow();
    });
  });

  describe('verifyEmailOTPSchema', () => {
    test('should validate correct OTP verification data', () => {
      const data = { email: 'john@example.com', otp: '123456' };
      const result = verifyEmailOTPSchema.parse(data);
      expect(result).toEqual(data);
    });

    test('should reject OTP that is not 6 digits', () => {
      const data = { email: 'john@example.com', otp: '12345' };
      expect(() => verifyEmailOTPSchema.parse(data)).toThrow();
    });

    test('should reject OTP with letters', () => {
      const data = { email: 'john@example.com', otp: '12345a' };
      expect(() => verifyEmailOTPSchema.parse(data)).toThrow();
    });
  });

  describe('resendOTPSchema', () => {
    test('should validate correct resend OTP data', () => {
      const data = { email: 'john@example.com' };
      const result = resendOTPSchema.parse(data);
      expect(result).toEqual(data);
    });

    test('should reject invalid email', () => {
      const data = { email: 'invalid' };
      expect(() => resendOTPSchema.parse(data)).toThrow();
    });
  });

  describe('forgotPasswordSchema', () => {
    test('should validate correct forgot password data', () => {
      const data = { email: 'john@example.com' };
      const result = forgotPasswordSchema.parse(data);
      expect(result).toEqual(data);
    });

    test('should reject invalid email', () => {
      const data = { email: 'invalid' };
      expect(() => forgotPasswordSchema.parse(data)).toThrow();
    });
  });

  describe('resetPasswordSchema', () => {
    test('should validate correct reset password data', () => {
      const data = { email: 'john@example.com', otp: '123456', newPassword: 'newpassword123' };
      const result = resetPasswordSchema.parse(data);
      expect(result).toEqual(data);
    });

    test('should reject short new password', () => {
      const data = { email: 'john@example.com', otp: '123456', newPassword: 'short' };
      expect(() => resetPasswordSchema.parse(data)).toThrow();
    });

    test('should reject invalid OTP', () => {
      const data = { email: 'john@example.com', otp: '12345', newPassword: 'newpassword123' };
      expect(() => resetPasswordSchema.parse(data)).toThrow();
    });
  });
});
