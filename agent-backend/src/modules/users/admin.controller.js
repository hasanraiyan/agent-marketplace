import userRepository from './user.repository.js';
import userService from './user.service.js';
import projectService from '../projects/project.service.js';
import { successFormatter } from '../../utils/formatters/index.js';
import { loggerService } from '../../utils/index.js';
import BaseError from '../../utils/errors/BaseError.js';

const logger = loggerService.getLogger();

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      throw new BaseError('Cannot delete your own account via admin endpoint', 400, 'BAD_REQUEST');
    }

    const user = await userRepository.findById(id);

    await userService.deleteUser(id);

    logger.info('User permanently deleted by admin', { userId: id, adminId: req.user.id });

    res.json(
      successFormatter.formatSuccess(
        { email: user.email, name: user.name },
        'User permanently deleted'
      )
    );
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const isActive = req.query.isActive;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const result = await userRepository.findAll({ page, limit, filter });

    res.json(
      successFormatter.formatSuccess({
        users: result.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          emailVerified: u.emailVerified,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
        pagination: result.pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Developer Platform (blueprint Phase 10, PR-50, AD-08 §33): Platform
 * Admin's narrow, explicit, separately-authorized Project enforcement
 * authority — suspend/restore any Project. Reuses the exact same
 * `authMiddleware` + `adminMiddleware` chain as every other route in this
 * file; not a new auth concept.
 */
export const suspendProject = async (req, res, next) => {
  try {
    const project = await projectService.platformSuspendProject(
      req.params.projectId,
      req.user.id ?? req.user._id
    );
    res.json(successFormatter.formatSuccess(project));
  } catch (error) {
    next(error);
  }
};

export const restoreProject = async (req, res, next) => {
  try {
    const project = await projectService.platformRestoreProject(
      req.params.projectId,
      req.user.id ?? req.user._id
    );
    res.json(successFormatter.formatSuccess(project));
  } catch (error) {
    next(error);
  }
};

export default {
  deleteUser,
  listUsers,
  suspendProject,
  restoreProject,
};
