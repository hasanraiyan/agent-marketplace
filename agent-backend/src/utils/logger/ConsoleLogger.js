import util from 'node:util';

/**
 * ConsoleLogger - Default logger implementation
 * Dependency Inversion: Logger interface can be swapped for other implementations
 */
class ConsoleLogger {
  _formatData(data) {
    if (!data) return '';
    if (typeof data !== 'object') return data;
    return util.inspect(data, { depth: null, colors: true });
  }

  info(message, data = null) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
  }

  warn(message, data = null) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || '');
  }

  error(message, error = null) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
  }

  debug(message, data = null) {
    if (
      process.env.DEBUG ||
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data || '');
    }
  }
}

export default ConsoleLogger;
