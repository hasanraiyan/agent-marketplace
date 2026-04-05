import ConsoleLogger from './ConsoleLogger.js';

/**
 * Logger - Singleton instance for app-wide logging
 * Injected where needed; can be swapped without changing service code
 */
let loggerInstance = new ConsoleLogger();

const setLogger = (newLogger) => {
  loggerInstance = newLogger;
};

const getLogger = () => loggerInstance;

export default { getLogger, setLogger };
