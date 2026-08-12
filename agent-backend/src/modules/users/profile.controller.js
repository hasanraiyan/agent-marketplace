import userRepository from './user.repository.js';
import userService from './user.service.js';
import { successFormatter } from '../../utils/formatters/index.js';
import { loggerService } from '../../utils/index.js';
import BaseError from '../../utils/errors/BaseError.js';

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
        username: user.username,
        age: user.age,
        isActive: user.isActive,
        role: user.role,
        emailVerified: user.emailVerified,
        profile: user.profile || { summary: '', preferences: {} },
        onboardingSeen: user.onboardingSeen || [],
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
    const { name, age, profile } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (age !== undefined) updateData.age = age;
    if (profile !== undefined) {
      updateData.profile = {
        summary: profile.summary !== undefined ? profile.summary : '',
        preferences: profile.preferences !== undefined ? profile.preferences : {},
        lastUpdated: new Date(),
      };
    }

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
          profile: user.profile || { summary: '', preferences: {} },
          onboardingSeen: user.onboardingSeen || [],
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

export const markOnboardingSeen = async (req, res, next) => {
  try {
    const { section } = req.body;
    const user = await userRepository.addOnboardingSeenSection(req.user.id, section);

    logger.info('Onboarding section marked seen', { userId: user.id, section });

    res.json(
      successFormatter.formatSuccess(
        { onboardingSeen: user.onboardingSeen || [] },
        'Onboarding updated'
      )
    );
  } catch (error) {
    next(error);
  }
};

export const deleteProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await userService.deleteUser(userId);

    res.json(
      successFormatter.formatSuccess(null, 'Account and all associated data deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getProfile,
  updateProfile,
  markOnboardingSeen,
  deleteProfile,
};
