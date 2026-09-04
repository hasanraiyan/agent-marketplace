import express from 'express';
import cors from 'cors';
import path from 'path';
import { healthRouter } from './modules/health/index.js';
import { statusRouter } from './modules/status/index.js';
import { profileRouter, adminRouter } from './modules/users/index.js';
import { providerRouter } from './modules/providers/index.js';
import {
  projectRouter,
  projectArchitectAguiRouter,
  projectAgentTestAguiRouter,
} from './modules/projects/index.js';
import {
  developerRouter,
  developerAguiRouter,
  developerAgentRouter,
  developerSkillRouter,
  developerKnowledgeRouter,
  developerMcpRouter,
  developerProviderRouter,
  developerThreadRouter,
  developerFileRouter,
  developerAuditLogRouter,
  developerMemoryRouter,
  developerStoreRouter,
  developerArchitectRouter,
  developerSecretRouter,
  developerRestToolRouter,
} from './modules/developer/index.js';
import { agentRouter } from './modules/agents/index.js';
import {
  projectAgentVoiceTestRouter,
  developerVoiceRouter,
  attachVoiceGateway,
} from './modules/voice/index.js';
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
import { startAgenda, stopAgenda } from './modules/jobs/agenda.js';
// Imported for its side effect: registers the cleanup-deleted-project job
// definition on the shared Agenda instance before agenda.start() runs.
import './modules/jobs/cleanupDeletedProject.job.js';

import { clerkMiddleware } from '@clerk/express';

// Initialize logger (Dependency Inversion - can swap implementation)
const logger = loggerService.getLogger();

const app = express();

// This app runs behind a TLS-terminating reverse proxy/CDN in production
// (confirmed: req.protocol was reporting 'http' for real HTTPS traffic).
// Without this, req.protocol/req.ip both read the raw socket instead of
// X-Forwarded-Proto/X-Forwarded-For, which silently broke ws vs wss
// selection (voice ticket minting) and collapses every anonymous caller
// behind the proxy onto one shared rate-limit bucket keyed by req.ip
// (rateLimiter.middleware.js). `1` trusts exactly one hop — correct for a
// single reverse proxy/CDN in front of this process; bump to the real hop
// count if there's more than one (e.g. CDN -> reverse proxy -> Node).
app.set('trust proxy', 1);

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
app.use('/api/v1/developer/architect/agui', developerArchitectRouter);
app.use('/api/v1/projects/:projectId/architect/agui', projectArchitectAguiRouter);
app.use('/api/v1/projects/:projectId/agents/:agentId/test/agui', projectAgentTestAguiRouter);

app.use(express.json());

// Serve Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Expose OpenAPI JSON for documentation UIs
app.get('/openapi.json', (req, res) => res.json(openapiSpec));

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/status', statusRouter);
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/providers', providerRouter);
app.use('/api/v1/projects', projectRouter);
// Voice Agents (voice-agent-plan.md Phase 1, Section 7 route (b)) - ticket
// minting only, a normal JSON POST behind Clerk + projectAdminAuthMiddleware.
// The actual conversation happens over the WS gateway (attachVoiceGateway),
// never through this router.
app.use('/api/v1/projects/:projectId', projectAgentVoiceTestRouter);
// Mounted before the generic /api/v1/developer prefix (below) so a more
// specific path always matches first, avoiding double authentication via
// prefix fallthrough.
app.use('/api/v1/developer/agents', developerAgentRouter);
// Ticket minting only (Project credential, developerMachineAuthMiddleware)
// — the actual conversation happens over the WS gateway
// (attachVoiceGateway), never through this router. Coexists fine with the
// WS upgrade handler at the same base path: Express never sees 'upgrade'
// requests at all, only ordinary GET/POST ones.
app.use('/api/v1/developer/voice', developerVoiceRouter);
app.use('/api/v1/developer/skills', developerSkillRouter);
app.use('/api/v1/developer/knowledge', developerKnowledgeRouter);
app.use('/api/v1/developer/mcps', developerMcpRouter);
app.use('/api/v1/developer/providers', developerProviderRouter);
app.use('/api/v1/developer/threads', developerThreadRouter);
app.use('/api/v1/developer/files', developerFileRouter);
app.use('/api/v1/developer/audit-logs', developerAuditLogRouter);
app.use('/api/v1/developer/memory', developerMemoryRouter);
app.use('/api/v1/developer/stores', developerStoreRouter);
app.use('/api/v1/developer/secrets', developerSecretRouter);
app.use('/api/v1/developer/rest-tools', developerRestToolRouter);
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
    message: 'Welcome to persona.hasanraiyan.me API',
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

    // Start the Agenda job queue (blueprint Phase 10, PR-53) — the durable
    // executor `discoverExpiredDeletions` enqueues into.
    if (!isTest) {
      await startAgenda();
    }

    // Handle process termination (skip in test to avoid open handles)
    if (!isTest) {
      process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down gracefully...');
        stopAllCronJobs();
        stopAgenda().finally(() => database.closeConnection().then(() => process.exit(0)));
      });
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully...');
        stopAllCronJobs();
        stopAgenda().finally(() => database.closeConnection().then(() => process.exit(0)));
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
      // Voice Agents (voice-agent-plan.md Phase 1) - Express middleware
      // never runs on a WebSocket 'upgrade' request, so this attaches its
      // own 'upgrade' listener directly to the http.Server rather than
      // being an Express route.
      attachVoiceGateway(server);
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
