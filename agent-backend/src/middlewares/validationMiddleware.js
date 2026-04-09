/**
 * validationMiddleware - Express middleware for request validation using Zod
 * Single Responsibility: Validate request body, query, params, and headers
 */

import { safeValidateSchema } from '../utils/validators/schemaValidator.js';
import ValidationError from '../utils/errors/ValidationError.js';

/**
 * Create a validation middleware for a specific request part (body, query, params, headers)
 * @param {Object} schemas - Object mapping request part to Zod schema
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
export const validateRequest = (schemas, options = {}) => {
  return (req, res, next) => {
    const errors = [];
    const validatedParts = {};

    Object.entries(schemas).forEach(([part, schema]) => {
      if (!req[part]) {
        // If the part is missing but schema expects it, treat as empty object
        const data = {};
        const result = safeValidateSchema(schema, data, options);
        if (!result.success) {
          errors.push(
            ...result.details.map((err) => ({
              field: `${part}.${err.field}`,
              message: err.message,
            }))
          );
        } else {
          validatedParts[part] = result.data;
        }
        return;
      }

      const result = safeValidateSchema(schema, req[part], options);
      if (!result.success) {
        errors.push(
          ...result.details.map((err) => ({
            field: `${part}.${err.field}`,
            message: err.message,
          }))
        );
      } else {
        validatedParts[part] = result.data;
      }
    });

    // If there are errors, pass to error handler
    if (errors.length > 0) {
      return next(new ValidationError('Request validation failed', { errors }));
    }

    // Replace request parts with validated data without reassigning getter-only props
    Object.entries(validatedParts).forEach(([part, value]) => {
      const current = req[part];

      if (current && typeof current === 'object') {
        // Mutate existing object (e.g. req.query) instead of overwriting the property
        Object.keys(current).forEach((key) => {
          delete current[key];
        });
        Object.assign(current, value);
      } else {
        // For parts that don't exist yet, define or assign directly
        req[part] = value;
      }
    });

    next();
  };
};

/**
 * Convenience functions for common validation patterns
 */
export const validateBody = (schema, options) => validateRequest({ body: schema }, options);
export const validateQuery = (schema, options) => validateRequest({ query: schema }, options);
export const validateParams = (schema, options) => validateRequest({ params: schema }, options);
export const validateHeaders = (schema, options) => validateRequest({ headers: schema }, options);

export default {
  validateRequest,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
};
