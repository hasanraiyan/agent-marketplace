import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Set up JWT secrets before importing the service
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';

import {
  hashPassword,
  comparePassword,
  generateOTP,
  hashOTP,
  compareOTP,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/services/auth.service.js';

describe('Auth Service', () => {
  describe('hashPassword', () => {
    test('should hash a password', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    test('should produce different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    test('should return true for matching password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);
      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    test('should return false for non-matching password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);
      const result = await comparePassword('wrongpassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateOTP', () => {
    test('should generate a 6-digit string', () => {
      const otp = generateOTP();
      expect(otp).toBeDefined();
      expect(typeof otp).toBe('string');
      expect(otp.length).toBe(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    test('should generate different OTPs', () => {
      const otp1 = generateOTP();
      const otp2 = generateOTP();
      // Very unlikely to be the same
      expect(otp1).not.toBe(otp2);
    });
  });

  describe('hashOTP', () => {
    test('should hash an OTP', async () => {
      const otp = '123456';
      const hash = await hashOTP(otp);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(otp);
    });
  });

  describe('compareOTP', () => {
    test('should return true for matching OTP', async () => {
      const otp = '123456';
      const hash = await bcrypt.hash(otp, 10);
      const result = await compareOTP(otp, hash);
      expect(result).toBe(true);
    });

    test('should return false for non-matching OTP', async () => {
      const otp = '123456';
      const hash = await bcrypt.hash(otp, 10);
      const result = await compareOTP('654321', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateAccessToken', () => {
    test('should generate a valid JWT access token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = generateAccessToken(userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(userId);
    });
  });

  describe('generateRefreshToken', () => {
    test('should generate a valid JWT refresh token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = generateRefreshToken(userId);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(userId);
    });
  });

  describe('verifyAccessToken', () => {
    test('should verify a valid access token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = generateAccessToken(userId);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(userId);
    });

    test('should throw for invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    test('should verify a valid refresh token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = generateRefreshToken(userId);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(userId);
    });

    test('should throw for invalid token', () => {
      expect(() => verifyRefreshToken('invalid.token.here')).toThrow();
    });
  });

  describe('getSecret edge cases', () => {
    const origSecret = process.env.JWT_SECRET;
    const origRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const origEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.JWT_SECRET = origSecret;
      process.env.JWT_REFRESH_SECRET = origRefreshSecret;
      process.env.NODE_ENV = origEnv;
    });

    test('should use fallback secret when JWT secret is empty in test env', async () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = '';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';

      jest.resetModules();
      const { generateAccessToken } = await import('../src/services/auth.service.js');

      const token = generateAccessToken('test-user-id');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should use fallback secret when JWT secret is whitespace-only in test env', async () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = '   ';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';

      jest.resetModules();
      const { generateAccessToken } = await import('../src/services/auth.service.js');

      const token = generateAccessToken('test-user-id');
      expect(token).toBeDefined();
    });

    test('should throw error when JWT secret is empty in non-test env', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = '';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing';

      jest.resetModules();
      const { generateAccessToken } = await import('../src/services/auth.service.js');

      expect(() => generateAccessToken('test-user-id')).toThrow(
        'JWT secret is required in non-test environments'
      );
    });

    test('should throw error when JWT refresh secret is empty in non-test env', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
      process.env.JWT_REFRESH_SECRET = '';

      jest.resetModules();
      const { generateRefreshToken } = await import('../src/services/auth.service.js');

      expect(() => generateRefreshToken('test-user-id')).toThrow(
        'JWT secret is required in non-test environments'
      );
    });
  });

  describe('token expiration', () => {
    test('should reject expired access token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const secret = 'test-jwt-secret-key-for-testing';
      const expiredToken = jwt.sign({ userId }, secret, { expiresIn: '0s' });

      expect(() => verifyAccessToken(expiredToken)).toThrow();
    });

    test('should reject expired refresh token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const secret = 'test-jwt-refresh-secret-key-for-testing';
      const expiredToken = jwt.sign({ userId }, secret, { expiresIn: '0s' });

      expect(() => verifyRefreshToken(expiredToken)).toThrow();
    });

    test('should reject access token signed with wrong secret', () => {
      const userId = '507f1f77bcf86cd799439011';
      const wrongSecret = 'wrong-secret-key';
      const token = jwt.sign({ userId }, wrongSecret, { expiresIn: '15m' });

      expect(() => verifyAccessToken(token)).toThrow();
    });

    test('should reject refresh token signed with wrong secret', () => {
      const userId = '507f1f77bcf86cd799439011';
      const wrongSecret = 'wrong-refresh-secret';
      const token = jwt.sign({ userId }, wrongSecret, { expiresIn: '7d' });

      expect(() => verifyRefreshToken(token)).toThrow();
    });

    test('should reject tampered access token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const token = generateAccessToken(userId);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });
  });
});
