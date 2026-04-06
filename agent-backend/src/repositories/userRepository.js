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

      // Explicitly include sensitive/extra fields required by Mongoose
      const createData = { ...validatedBase };
      const extraKeys = [
        'password',
        'emailVerificationOTP',
        'emailVerificationOTPExpires',
        'passwordResetOTP',
        'passwordResetOTPExpires',
        'refreshToken',
        'role',
      ];

      for (const key of extraKeys) {
        if (Object.prototype.hasOwnProperty.call(userData, key) && userData[key] !== undefined) {
          createData[key] = userData[key];
        }
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
   * Find user by ID with password field selected
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object with password
   */
  async findByIdWithPassword(id) {
    const user = await User.findById(id).select('+password +refreshToken');
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }

  /**
   * Find user by ID excluding sensitive fields for profile
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object without sensitive fields
   */
  async findByIdForProfile(id) {
    const user = await User.findById(id).select(
      '-password -refreshToken -emailVerificationOTP -emailVerificationOTPExpires -passwordResetOTP -passwordResetOTPExpires'
    );
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
   * Find user by email with sensitive fields selected
   * @param {string} email - User email
   * @returns {Promise<Object>} User object with sensitive fields
   */
  async findByEmailWithSensitive(email) {
    const user = await User.findOne({ email }).select(
      '+password +refreshToken +emailVerificationOTP +emailVerificationOTPExpires +passwordResetOTP +passwordResetOTPExpires'
    );
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
   * Update refresh token for a user
   * @param {string} id - User ID
   * @param {string|null} refreshToken - Refresh token to set
   * @returns {Promise<Object>} Updated user
   */
  async updateRefreshToken(id, refreshToken) {
    const user = await User.findByIdAndUpdate(
      id,
      { refreshToken, updatedAt: new Date() },
      { returnDocument: 'after', runValidators: false }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Update email verification OTP
   * @param {string} id - User ID
   * @param {string} hashedOTP - Hashed OTP
   * @param {Date} expiresAt - OTP expiration date
   * @returns {Promise<Object>} Updated user
   */
  async updateEmailVerificationOTP(id, hashedOTP, expiresAt) {
    const user = await User.findByIdAndUpdate(
      id,
      {
        emailVerificationOTP: hashedOTP,
        emailVerificationOTPExpires: expiresAt,
        updatedAt: new Date(),
      },
      { returnDocument: 'after', runValidators: false }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Clear email verification OTP
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  async clearEmailVerificationOTP(id) {
    const user = await User.findByIdAndUpdate(
      id,
      {
        emailVerificationOTP: undefined,
        emailVerificationOTPExpires: undefined,
        updatedAt: new Date(),
      },
      { returnDocument: 'after', runValidators: false }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Update password reset OTP
   * @param {string} id - User ID
   * @param {string} hashedOTP - Hashed OTP
   * @param {Date} expiresAt - OTP expiration date
   * @returns {Promise<Object>} Updated user
   */
  async updatePasswordResetOTP(id, hashedOTP, expiresAt) {
    const user = await User.findByIdAndUpdate(
      id,
      {
        passwordResetOTP: hashedOTP,
        passwordResetOTPExpires: expiresAt,
        updatedAt: new Date(),
      },
      { returnDocument: 'after', runValidators: false }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Clear password reset OTP
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  async clearPasswordResetOTP(id) {
    const user = await User.findByIdAndUpdate(
      id,
      {
        passwordResetOTP: undefined,
        passwordResetOTPExpires: undefined,
        updatedAt: new Date(),
      },
      { returnDocument: 'after', runValidators: false }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Mark email as verified
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  async markEmailAsVerified(id) {
    const user = await User.findByIdAndUpdate(
      id,
      { emailVerified: true, updatedAt: new Date() },
      { returnDocument: 'after', runValidators: false }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
  }

  /**
   * Update password
   * @param {string} id - User ID
   * @param {string} hashedPassword - New hashed password
   * @returns {Promise<Object>} Updated user
   */
  async updatePassword(id, hashedPassword) {
    const user = await User.findByIdAndUpdate(
      id,
      { password: hashedPassword, updatedAt: new Date() },
      { returnDocument: 'after', runValidators: false }
    );

    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return user;
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
}

// Create and export a singleton instance
const userRepository = new UserRepository();
export default userRepository;
