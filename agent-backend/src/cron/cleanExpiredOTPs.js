import User from '../models/User.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

export default async function cleanExpiredOTPs() {
  const now = new Date();

  const result = await User.updateMany(
    {
      $or: [
        { emailVerificationOTPExpires: { $lt: now } },
        { passwordResetOTPExpires: { $lt: now } },
      ],
    },
    {
      $unset: {
        emailVerificationOTP: '',
        emailVerificationOTPExpires: '',
        passwordResetOTP: '',
        passwordResetOTPExpires: '',
      },
    }
  );

  if (result.modifiedCount > 0) {
    logger.info(`Cleaned expired OTPs from ${result.modifiedCount} users`);
  }

  return result;
}
