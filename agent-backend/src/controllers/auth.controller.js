import {
  hashPassword,
  comparePassword,
  generateOTP,
  hashOTP,
  compareOTP,
  generateAccessToken,
  generateRefreshToken,
} from '../services/auth.service.js';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from '../services/mail.service.js';
import userRepository from '../repositories/userRepository.js';
import { successFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';
import BaseError from '../utils/errors/BaseError.js';

const logger = loggerService.getLogger();

const OTP_EXPIRY_MINUTES = 10;

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if email already exists using repository
    const emailExists = await userRepository.emailExists(email);
    if (emailExists) {
      throw new BaseError('Email already registered', 409, 'CONFLICT');
    }

    const hashedPassword = await hashPassword(password);
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Create user using repository
    // Force role to 'normal' - admin users can only be created via CLI
    const user = await userRepository.create({
      name,
      email,
      password: hashedPassword,
      emailVerificationOTP: hashedOTP,
      emailVerificationOTPExpires: otpExpires,
      role: 'normal',
    });

    sendVerificationEmail(email, otp).catch((err) =>
      logger.error('Fire-and-forget verification email failed', { email, error: err.message })
    );

    logger.info('User registered', { userId: user.id, email });

    res
      .status(201)
      .json(
        successFormatter.formatSuccess(
          { userId: user.id, email: user.email },
          'Registration successful. Please verify your email.',
          201
        )
      );
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email using repository, including password field
    let user;
    try {
      user = await userRepository.findByEmail(email);
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new BaseError('Invalid email or password', 401, 'UNAUTHORIZED');
      }
      throw error;
    }

    // Get user with password selected
    user = await userRepository.findByIdWithPassword(user.id);

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new BaseError('Invalid email or password', 401, 'UNAUTHORIZED');
    }

    if (!user.emailVerified) {
      throw new BaseError('Please verify your email first', 403, 'FORBIDDEN');
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Update refresh token using repository
    await userRepository.updateRefreshToken(user.id, refreshToken);

    logger.info('User logged in', { userId: user.id, email });

    res.json(
      successFormatter.formatSuccess({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    // Clear refresh token using repository
    await userRepository.updateRefreshToken(req.user.id, null);

    logger.info('User logged out', { userId: req.user.id });

    res.json(successFormatter.formatSuccess(null, 'Logged out successfully'));
  } catch (error) {
    next(error);
  }
};

export const verifyEmailOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Find user with sensitive fields using repository
    let user;
    try {
      user = await userRepository.findByEmailWithSensitive(email);
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new BaseError('User not found', 404, 'NOT_FOUND');
      }
      throw error;
    }

    if (user.emailVerified) {
      throw new BaseError('Email already verified', 400, 'BAD_REQUEST');
    }

    if (!user.emailVerificationOTP || !user.emailVerificationOTPExpires) {
      throw new BaseError('No OTP found. Please request a new one.', 400, 'BAD_REQUEST');
    }

    if (user.emailVerificationOTPExpires < new Date()) {
      throw new BaseError('OTP has expired', 400, 'BAD_REQUEST');
    }

    const isValid = await compareOTP(otp, user.emailVerificationOTP);
    if (!isValid) {
      throw new BaseError('Invalid OTP', 400, 'BAD_REQUEST');
    }

    // Mark email as verified and clear OTP using repository
    await userRepository.markEmailAsVerified(user.id);
    await userRepository.clearEmailVerificationOTP(user.id);

    sendWelcomeEmail(email, user.name).catch((err) =>
      logger.error('Fire-and-forget welcome email failed', { email, error: err.message })
    );

    logger.info('Email verified', { userId: user.id, email });

    res.json(successFormatter.formatSuccess(null, 'Email verified successfully'));
  } catch (error) {
    next(error);
  }
};

export const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user using repository
    let user;
    try {
      user = await userRepository.findByEmail(email);
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new BaseError('User not found', 404, 'NOT_FOUND');
      }
      throw error;
    }

    if (user.emailVerified) {
      throw new BaseError('Email already verified', 400, 'BAD_REQUEST');
    }

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Update OTP using repository
    await userRepository.updateEmailVerificationOTP(user.id, hashedOTP, otpExpires);

    sendVerificationEmail(email, otp).catch((err) =>
      logger.error('Fire-and-forget verification email failed', { email, error: err.message })
    );

    logger.info('Verification OTP resent', { userId: user.id, email });

    res.json(successFormatter.formatSuccess(null, 'Verification OTP sent'));
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user using repository
    let user;
    try {
      user = await userRepository.findByEmail(email);
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new BaseError('User not found', 404, 'NOT_FOUND');
      }
      throw error;
    }

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Update password reset OTP using repository
    await userRepository.updatePasswordResetOTP(user.id, hashedOTP, otpExpires);

    sendPasswordResetEmail(email, otp).catch((err) =>
      logger.error('Fire-and-forget password reset email failed', { email, error: err.message })
    );

    logger.info('Password reset OTP sent', { userId: user.id, email });

    res.json(successFormatter.formatSuccess(null, 'Password reset OTP sent to your email'));
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Find user with sensitive fields using repository
    let user;
    try {
      user = await userRepository.findByEmailWithSensitive(email);
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new BaseError('User not found', 404, 'NOT_FOUND');
      }
      throw error;
    }

    if (!user.passwordResetOTP || !user.passwordResetOTPExpires) {
      throw new BaseError('No reset OTP found. Please request a new one.', 400, 'BAD_REQUEST');
    }

    if (user.passwordResetOTPExpires < new Date()) {
      throw new BaseError('OTP has expired', 400, 'BAD_REQUEST');
    }

    const isValid = await compareOTP(otp, user.passwordResetOTP);
    if (!isValid) {
      throw new BaseError('Invalid OTP', 400, 'BAD_REQUEST');
    }

    // Hash new password and update using repository
    const hashedPassword = await hashPassword(newPassword);
    await userRepository.updatePassword(user.id, hashedPassword);
    await userRepository.clearPasswordResetOTP(user.id);

    logger.info('Password reset', { userId: user.id, email });

    res.json(successFormatter.formatSuccess(null, 'Password reset successfully'));
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  logout,
  verifyEmailOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
};
