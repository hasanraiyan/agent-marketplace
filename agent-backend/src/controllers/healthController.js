import healthService from '../services/healthService.js';
import database from '../config/database.js';
import { successFormatter } from '../utils/formatters/index.js';
import { loggerService } from '../utils/index.js';
const logger = loggerService.getLogger();

/**
 * getHealth - Health check endpoint controller
 * Uses successFormatter (Interface Segregation) for consistent response format
 * Uses injected logger (Dependency Inversion) for logging
 */
const getHealth = (req, res, next) => {
  try {
    const data = healthService.getHealth();
    logger.info('Health check performed', { uptime: data.uptime });
    res.json(successFormatter.formatSuccess(data, 'Server is healthy'));
  } catch (err) {
    logger.error('Health check failed', err);
    next(err);
  }
};

/**
 * getDbHealth - Database health check endpoint controller
 * Returns database connection status
 */
const getDbHealth = (req, res, next) => {
  try {
    const isConnected = database.getConnectionStatus();
    const status = isConnected ? 'healthy' : 'unhealthy';
    const data = {
      status,
      database: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
    logger.info('Database health check performed', { status });
    const statusCode = isConnected ? 200 : 503;
    res
      .status(statusCode)
      .json(successFormatter.formatSuccess(data, `Database is ${status}`, statusCode));
  } catch (err) {
    logger.error('Database health check failed', err);
    next(err);
  }
};

export default { getHealth, getDbHealth };
