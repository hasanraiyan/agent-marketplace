import User from '../models/User.js';
import { userSchema } from '../models/User.js';
import { NotFoundError, ValidationError } from '../utils/errors/index.js';

/**
 * User repository for database operations
 */
class UserRepository {
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  async create(userData) {
    try {
      // Validate base user fields with Zod (do not strip or accept unknowns here)
      const validatedBase = userSchema.parse(userData);

      // Explicitly include extra fields
      const createData = { ...validatedBase };
      if (userData.clerkId) {
        createData.clerkId = userData.clerkId;
      }
      if (userData.role) {
        createData.role = userData.role;
      }

      const user = new User(createData);
      return await user.save();
    } catch (error) {
      if (error.name === 'ZodError') {
        throw new ValidationError('Invalid user data', error.errors);
      }
      if (error.code === 11000) {
        throw new ValidationError('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object
   */
  async findById(id) {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  /**
   * Find user by clerk ID
   * @param {string} clerkId - User Clerk ID
   * @returns {Promise<Object>} User object
   */
  async findByClerkId(clerkId) {
    const user = await User.findOne({ clerkId });
    if (!user) {
      throw new NotFoundError(`User with clerkId ${clerkId} not found`);
    }
    return user;
  }

  /**
   * Find user by ID excluding sensitive fields for profile
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object without sensitive fields
   */
  async findByIdForProfile(id) {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object>} User object
   */
  async findByEmail(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new NotFoundError(`User with email ${email} not found`);
    }
    return user;
  }

  /**
   * Get all users with pagination
   * @param {Object} options - Pagination options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 10)
   * @param {Object} options.filter - Filter criteria
   * @returns {Promise<Object>} Paginated users
   */
  async findAll({ page = 1, limit = 10, filter = {} } = {}) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update user by ID
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user
   */
  async update(id, updateData) {
    try {
      // Remove fields that shouldn't be updated
      const { _id, __v, createdAt, ...safeUpdateData } = updateData;

      const user = await User.findByIdAndUpdate(
        id,
        { ...safeUpdateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new NotFoundError(`User with id ${id} not found`);
      }

      return user;
    } catch (error) {
      if (error.code === 11000) {
        throw new ValidationError('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Delete user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} Deleted user
   */
  async delete(id) {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  /**
   * Soft delete user by ID (set isActive to false)
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  async softDelete(id) {
    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Count total users
   * @param {Object} filter - Filter criteria
   * @returns {Promise<number>} Total count
   */
  async count(filter = {}) {
    return await User.countDocuments(filter);
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if email exists
   */
  async emailExists(email) {
    const count = await User.countDocuments({ email });
    return count > 0;
  }
}

// Create and export a singleton instance
const userRepository = new UserRepository();
export default userRepository;
