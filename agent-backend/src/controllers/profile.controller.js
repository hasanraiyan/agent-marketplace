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

export default {
  getProfile,
  updateProfile,
};
