/**
 * schemaValidator - Robust validation using Zod schemas
 * Single Responsibility: Provides schema-based validation with detailed error handling
 */

import { z } from 'zod';
import ValidationError from '../errors/ValidationError.js';

/**
 * Validate data against a Zod schema, throwing ValidationError on failure.
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.stripUnknown - Remove unknown fields (default: false)
 * @returns {Object} - Validated data (if successful)
 * @throws {ValidationError} - If validation fails
 */
export const validateSchema = (schema, data, options = {}) => {
  const { stripUnknown = false } = options;

  try {
    const validationSchema = stripUnknown ? schema.strip() : schema;
    return validationSchema.parse(data);
  } catch (error) {
    // Transform Zod error into ValidationError details
    const details =
      error.issues?.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })) || [];

    throw new ValidationError('Validation failed', { errors: details, raw: error });
  }
};

/**
 * Safely validate data against a Zod schema, returning a result object.
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.stripUnknown - Remove unknown fields (default: false)
 * @returns {Object} - Result object { success: boolean, data?: any, error?: ZodError, details?: Array }
 */
export const safeValidateSchema = (schema, data, options = {}) => {
  const { stripUnknown = false } = options;

  try {
    const validationSchema = stripUnknown ? schema.strip() : schema;
    const validated = validationSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    const details =
      error.issues?.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })) || [];

    return {
      success: false,
      error,
      details,
    };
  }
};

/**
 * Create a reusable validator function for a given schema.
 * @param {z.ZodSchema} schema - Zod schema
 * @param {Object} options - Validation options
 * @returns {Function} - Validator function that returns validated data or throws ValidationError
 */
export const createValidator = (schema, options = {}) => {
  return (data) => validateSchema(schema, data, options);
};

/**
 * Common schemas for reuse across the application
 */
export const schemas = {
  // String schemas
  nonEmptyString: z.string().min(1, 'Must not be empty'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  url: z.string().url('Invalid URL format'),
  uuid: z.string().uuid('Invalid UUID format'),

  // Number schemas
  positiveNumber: z.number().positive('Must be positive'),
  nonNegativeNumber: z.number().nonnegative('Must be non-negative'),
  integer: z.number().int('Must be an integer'),
  range: (min, max) => z.number().min(min).max(max),

  // Object schemas
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId'),
  dateString: z.string().datetime({ offset: true }),

  // Utility schemas
  optional: (schema) => schema.optional(),
  nullable: (schema) => schema.nullable(),
  arrayOf: (schema) => z.array(schema),
};

/**
 * Middleware factory for Express request validation
 * @param {Object} schemaMap - Map of field names to Zod schemas (e.g., { body: schema, query: schema })
 * @returns {Function} - Express middleware that validates request parts
 */
export const validateRequest = (schemaMap) => {
  return (req, res, next) => {
    const errors = [];

    Object.entries(schemaMap).forEach(([key, schema]) => {
      if (!req[key]) {
        errors.push({
          field: key,
          message: `Request does not have ${key} property`,
        });
        return;
      }

      const result = safeValidateSchema(schema, req[key], { stripUnknown: true });
      if (!result.success) {
        errors.push(
          ...result.details.map((err) => ({
            field: `${key}.${err.field}`,
            message: err.message,
          }))
        );
      } else {
        // Replace with validated data
        req[key] = result.data;
      }
    });

    if (errors.length > 0) {
      return next(new ValidationError('Request validation failed', { errors }));
    }

    next();
  };
};

// Export Zod for advanced usage
export { z };

export default {
  validateSchema,
  safeValidateSchema,
  createValidator,
  schemas,
  validateRequest,
  z,
};
