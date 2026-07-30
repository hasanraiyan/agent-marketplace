import express from 'express';
import cors from 'cors';
import path from 'path';
import { healthRouter } from './modules/health/index.js';
import { profileRouter, adminRouter } from './modules/users/index.js';
import { providerRouter } from './modules/providers/index.js';
import { projectRouter } from './modules/projects/index.js';
import {
  developerRouter,
  developerAguiRouter,
  developerAgentRouter,
  developerSkillRouter,
  developerKnowledgeRouter,
  developerMcpRouter,
  developerProviderRouter,
} from './modules/developer/index.js';
import { agentRouter } from './modules/agents/index.js';
import { threadRouter } from './modules/threads/index.js';
import { skillRouter } from './modules/skills/index.js';
import { mcpRouter } from './modules/mcp/index.js';
import { aguiRouter } from './modules/agui/index.js';
import { webhookRouter } from './modules/webhooks/index.js';
import { uploadRouter } from './modules/upload/index.js';
import { knowledgeRouter } from './modules/knowledge/index.js';
import { memoryRouter } from './modules/memory/index.js';
import errorHandler from './middlewares/errorHandler.js';
import swaggerUi from 'swagger-ui-express';
import openapiSpec from './docs/swagger.config.js';
import config from './config/index.js';
import database from './config/database.js';
import { loggerService } from './utils/index.js';
import { startAllCronJobs, stopAllCronJobs } from './modules/cron/index.js';

import { clerkMiddleware } from '@clerk/express';

// Initialize logger (Dependency Inversion - can swap implementation)
const logger = loggerService.getLogger();

const app = express();

app.use(cors());

// Prevent browser and proxy caching for all API responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Log every incoming request — method, path, query, and timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const query = Object.keys(req.query).length ? ` ${JSON.stringify(req.query)}` : '';
    logger.info(`${req.method} ${req.originalUrl}${query} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Webhooks must be parsed as raw body and bypass global auth
app.use('/api/v1/webhooks', webhookRouter);

app.use(clerkMiddleware());

// AG-UI reads its own raw request body before express.json() consumes the stream.
app.use('/api/v1/agui', aguiRouter);
app.use('/api/v1/developer/agui', developerAguiRouter);

app.use(express.json());

// Serve Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Expose OpenAPI JSON for documentation UIs
app.get('/openapi.json', (req, res) => res.json(openapiSpec));

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/providers', providerRouter);
app.use('/api/v1/projects', projectRouter);
// Mounted before the generic /api/v1/developer prefix (below) so a more
// specific path always matches first, avoiding double authentication via
// prefix fallthrough.
app.use('/api/v1/developer/agents', developerAgentRouter);
app.use('/api/v1/developer/skills', developerSkillRouter);
app.use('/api/v1/developer/knowledge', developerKnowledgeRouter);
app.use('/api/v1/developer/mcps', developerMcpRouter);
app.use('/api/v1/developer/providers', developerProviderRouter);
app.use('/api/v1/developer', developerRouter);
app.use('/api/v1/agents', agentRouter);
app.use('/api/v1/threads', threadRouter);
app.use('/api/v1/skills', skillRouter);
app.use('/api/v1/mcps', mcpRouter);
app.use('/api/v1/upload', uploadRouter);
app.use('/api/v1/knowledge', knowledgeRouter);
app.use('/api/v1/memory', memoryRouter);

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (req, res) => {
  let dbStatus = 'unknown';
  try {
    dbStatus = database.getConnectionStatus() ? 'connected' : 'disconnected';
  } catch (err) {
    // Ignore error here as it's just for the root info route
  }

  res.json({
    message: 'Welcome to Persona.ai API',
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

    // Start cron jobs
    startAllCronJobs();

    // Handle process termination (skip in test to avoid open handles)
    if (!isTest) {
      process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down gracefully...');
        stopAllCronJobs();
        database.closeConnection().then(() => process.exit(0));
      });
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully...');
        stopAllCronJobs();
        database.closeConnection().then(() => process.exit(0));
      });
    }

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
