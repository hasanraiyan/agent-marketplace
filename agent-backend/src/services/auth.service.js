import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import jwtConfig from '../config/jwt.config.js';

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;

// Fallback secrets for testing environments (when not set in .env)
// In production, these should always be set via environment variables
const getSecret = (secret) => {
  if (!secret || secret.trim() === '') {
    // Only allow empty secret in test environment
    if (process.env.NODE_ENV === 'test') {
      return 'test-secret-fallback-key-do-not-use-in-production';
    }
    throw new Error('JWT secret is required in non-test environments');
  }
  return secret;
};

export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const generateOTP = () => {
  return crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH).toString();
};

export const hashOTP = async (otp) => {
  return bcrypt.hash(otp, SALT_ROUNDS);
};

export const compareOTP = async (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

export const generateAccessToken = (userId) => {
  const secret = getSecret(jwtConfig.secret);
  return jwt.sign({ userId }, secret, {
    expiresIn: jwtConfig.expiresIn,
  });
};

export const generateRefreshToken = (userId) => {
  const secret = getSecret(jwtConfig.refreshSecret);
  return jwt.sign({ userId }, secret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });
};

export const verifyAccessToken = (token) => {
  const secret = getSecret(jwtConfig.secret);
  return jwt.verify(token, secret);
};

export const verifyRefreshToken = (token) => {
  const secret = getSecret(jwtConfig.refreshSecret);
  return jwt.verify(token, secret);
};
