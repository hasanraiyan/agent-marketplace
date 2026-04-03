import { hashPassword, comparePassword } from '../services/auth.service.js';
import userRepository from '../repositories/userRepository.js';
import { successFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';
import BaseError from '../utils/errors/BaseError.js';

const logger = loggerService.getLogger();

export const getProfile = async (req, res, next) => {
  try {
    const user = await userRepository.findByIdForProfile(req.user.id);

    logger.info('Profile retrieved', { userId: user.id });

    res.json(
      successFormatter.formatSuccess({
        id: user.id,
        name: user.name,
        email: user.email,
        age: user.age,
        isActive: user.isActive,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, age } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (age !== undefined) updateData.age = age;

    if (Object.keys(updateData).length === 0) {
      throw new BaseError('No fields to update', 400, 'BAD_REQUEST');
    }

    const user = await userRepository.update(req.user.id, updateData);

    logger.info('Profile updated', { userId: user.id });

    res.json(
      successFormatter.formatSuccess(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          age: user.age,
          isActive: user.isActive,
          role: user.role,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        'Profile updated successfully'
      )
    );
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await userRepository.findByIdWithPassword(req.user.id);

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      throw new BaseError('Current password is incorrect', 400, 'BAD_REQUEST');
    }

    const hashedPassword = await hashPassword(newPassword);
    await userRepository.updatePassword(user.id, hashedPassword);

    logger.info('Password changed', { userId: user.id });

    res.json(successFormatter.formatSuccess(null, 'Password changed successfully'));
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    const user = await userRepository.findByIdWithPassword(req.user.id);

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new BaseError('Password is incorrect', 400, 'BAD_REQUEST');
    }

    await userRepository.softDelete(user.id);
    await userRepository.updateRefreshToken(user.id, null);

    logger.info('Account deleted', { userId: user.id });

    res.json(successFormatter.formatSuccess(null, 'Account deletion scheduled'));
  } catch (error) {
    next(error);
  }
};

export default {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
