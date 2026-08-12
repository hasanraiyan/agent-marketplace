import User from './user.model.js';
import { userSchema } from './user.model.js';
import { NotFoundError, ValidationError } from '../../utils/errors/index.js';

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
        { returnDocument: 'after', runValidators: true }
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
   * Marks a first-run onboarding tour section as seen (completed or
   * skipped). Atomic $addToSet — idempotent, and avoids a read-modify-write
   * race that the generic `update()` method's plain field replace would have.
   * @param {string} id - User ID
   * @param {string} section - Onboarding section key (e.g. 'dashboard')
   * @returns {Promise<Object>} Updated user
   */
  async addOnboardingSeenSection(id, section) {
    const user = await User.findByIdAndUpdate(
      id,
      { $addToSet: { onboardingSeen: section } },
      { returnDocument: 'after' }
    );

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
      { returnDocument: 'after' }
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

  /**
   * Search active users by email prefix (case-insensitive) for the
   * Developer Studio "Add Admin" autocomplete. Returns only the fields
   * needed to display and pick a user (name + email) — never clerkId or
   * role. Regex-special characters in the query are escaped.
   * @param {string} query - Email prefix to match
   * @param {number} limit - Max results (default: 8)
   * @returns {Promise<Array>} Matching active users
   */
  async searchByEmailPrefix(query, limit = 8) {
    const q = String(query || '')
      .trim()
      .toLowerCase();
    if (!q) return [];

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await User.find({
      email: { $regex: `^${escaped}`, $options: 'i' },
      isActive: true,
    })
      .select('name email')
      .limit(limit);
  }
}

const userRepository = new UserRepository();
export default userRepository;
