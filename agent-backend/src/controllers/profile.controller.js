import userRepository from '../repositories/userRepository.js';
import { successFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';
import BaseError from '../utils/errors/BaseError.js';
import Agent from '../models/Agent.js';
import Skill from '../models/Skill.js';
import Provider from '../models/Provider.js';
import Mcp from '../models/Mcp.js';
import McpUserConnection from '../models/McpUserConnection.js';
import Conversation from '../models/Conversation.js';
import checkpointService from '../services/checkpoint.service.js';

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
        lastUpdated: new Date()
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

export const deleteProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    logger.info('User requested account deletion', { userId });

    // 1. Cleanup threads and their LangGraph checkpoints
    const userThreads = await Conversation.find({ userId }).select('threadId');
    const threadIds = userThreads.map((t) => t.threadId);
    if (threadIds.length > 0) {
      await checkpointService.cleanupThreads(threadIds);
      await Conversation.deleteMany({ userId });
    }

    // 2. Delete all other user owned resources
    await Promise.all([
      Agent.deleteMany({ ownerId: userId }),
      Skill.deleteMany({ ownerId: userId }),
      Provider.deleteMany({ ownerId: userId }),
      Mcp.deleteMany({ ownerId: userId }),
      McpUserConnection.deleteMany({ userId }),
    ]);

    // 3. Finally delete the user document
    await userRepository.delete(userId);

    logger.info('Account and all associated data deleted successfully', { userId });

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
  deleteProfile,
};
