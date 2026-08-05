import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level integration test (REQ-8): proves status.routes.js is publicly
 * reachable with no auth middleware, and actually wires routes -> controller
 * -> service -> database.getConnectionStatus() together over real HTTP.
 */

jest.unstable_mockModule('../src/config/database.js', () => ({
  default: { getConnectionStatus: jest.fn() },
}));

const database = (await import('../src/config/database.js')).default;
const statusRouter = (await import('../src/modules/status/status.routes.js')).default;

function buildApp() {
  const app = express();
  app.use('/api/v1/status', statusRouter);
  return app;
}

describe('GET /api/v1/status (REQ-8)', () => {
  test('is publicly reachable with no auth header and returns the raw status document', async () => {
    database.getConnectionStatus.mockReturnValue(true);

    const res = await request(buildApp()).get('/api/v1/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'operational',
      latencyTargets: { chatTimeToFirstTokenMsP95: 2000 },
      uptimeTargetPct: 99.9,
      incidents: [],
    });
  });

  test('reports degraded when the database is disconnected', async () => {
    database.getConnectionStatus.mockReturnValue(false);

    const res = await request(buildApp()).get('/api/v1/status');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
  });
});
