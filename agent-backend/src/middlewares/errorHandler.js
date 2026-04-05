import { errorFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

/**
 * errorHandler - Express error middleware
 * Uses errorFormatter (Interface Segregation) and logger (Dependency Inversion)
 * Handles custom and standard errors consistently
 */
export default function errorHandler(err, req, res, next) {
  // Log error using injected logger
  logger.error('Request error occurred', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Format error response using formatter
  const errorResponse = errorFormatter.formatError(err, statusCode);

  // Send formatted error response
  res.status(statusCode).json(errorResponse);
}
