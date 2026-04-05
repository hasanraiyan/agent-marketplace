import express from 'express';
import authController from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import rateLimiter, { RATE_LIMITS } from '../middlewares/rateLimiter.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailOTPSchema,
  resendOTPSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

const router = express.Router();

router.post(
  '/register',
  rateLimiter('register', RATE_LIMITS.REGISTER),
  validateBody(registerSchema),
  authController.register
);
router.post(
  '/login',
  rateLimiter('login', RATE_LIMITS.LOGIN),
  validateBody(loginSchema),
  authController.login
);
router.post('/logout', authMiddleware, authController.logout);
router.post(
  '/verify-email-otp',
  rateLimiter('verify-otp', RATE_LIMITS.VERIFY_OTP),
  validateBody(verifyEmailOTPSchema),
  authController.verifyEmailOTP
);
router.post(
  '/resend-otp',
  rateLimiter('resend-otp', RATE_LIMITS.RESEND_OTP),
  validateBody(resendOTPSchema),
  authController.resendOTP
);
router.post(
  '/forgot-password',
  rateLimiter('forgot-password', RATE_LIMITS.FORGOT_PASSWORD),
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  rateLimiter('reset-password', RATE_LIMITS.RESET_PASSWORD),
  validateBody(resetPasswordSchema),
  authController.resetPassword
);

export default router;
