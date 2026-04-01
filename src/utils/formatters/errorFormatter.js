/**
 * errorFormatter - Formats error responses
 * Interface Segregation: Only handles error responses
 */
const formatError = (error, statusCode = 500) => {
  // If error already has our custom format, return it
  if (error.toJSON && typeof error.toJSON === 'function') {
    return {
      success: false,
      status: 'error',
      ...error.toJSON(),
      timestamp: new Date().toISOString(),
    };
  }

  // Standard error format
  return {
    success: false,
    status: 'error',
    statusCode,
    message: error.message || 'Internal Server Error',
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  };
};

export default {
  formatError,
};
