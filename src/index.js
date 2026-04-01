import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.routes.js';
import errorHandler from './middlewares/errorHandler.js';
import swaggerUi from 'swagger-ui-express';
import openapiSpec from './docs/openapi.js';
import config from './config/index.js';
import database from './config/database.js';
import { loggerService } from './utils/index.js';

// Initialize logger (Dependency Inversion - can swap implementation)
const logger = loggerService.getLogger();

const app = express();

app.use(cors());
app.use(express.json());

// Serve Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Expose OpenAPI JSON for documentation UIs
app.get('/openapi.json', (req, res) => res.json(openapiSpec));

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);

app.get('/', (req, res) => {
  let dbStatus = 'unknown';
  try {
    dbStatus = database.getConnectionStatus() ? 'connected' : 'disconnected';
  } catch (err) {
    // Ignore error here as it's just for the root info route
  }

  res.json({
    message: 'Welcome to Agent Marketplace API',
    version: '1.0.0',
    database: dbStatus,
  });
});

app.use(errorHandler);

let isStarting = false;

/**
 * Start the server and connect to MongoDB
 */
async function startServer() {
  if (isStarting) return;
  isStarting = true;

  try {
    // Connect to MongoDB
    await database.connect();

    if (!isTest) {
      const server = app.listen(config.port, () => {
        logger.info(`Server listening on port ${config.port}`);
        let dbStatus = 'unknown';
        try {
          dbStatus = database.getConnectionStatus() ? 'true' : 'false';
        } catch (err) {
          // Ignore
        }
        logger.info(`MongoDB connected: ${dbStatus}`);
      });
      server.unref();
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

// Start the server if not in test mode
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
if (!isTest) {
  startServer().catch((err) => {
    logger.error('Unhandled server startup error:', err);
  });
}

export default app;
