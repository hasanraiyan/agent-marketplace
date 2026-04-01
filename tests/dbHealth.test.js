import { jest } from '@jest/globals';
import request from 'supertest';
import database from '../src/config/database.js';

// Mock getConnectionStatus BEFORE importing app
const mockGetConnectionStatus = jest.fn().mockReturnValue(true);
database.getConnectionStatus = mockGetConnectionStatus;

// Mock loggerService before importing app to prevent console.error output
const { default: loggerService } = await import('../src/utils/logger/index.js');
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
loggerService.setLogger(mockLogger);

const { default: app } = await import('../src/index.js');

describe('Database Health Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /health/db should return healthy when database is connected', async () => {
    // Mock database as connected
    mockGetConnectionStatus.mockReturnValue(true);

    const res = await request(app).get('/api/v1/health/db').expect(200);

    expect(res.body.data).toMatchObject({
      status: 'healthy',
      database: 'connected',
    });
    expect(res.body.data.timestamp).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(200);
  });

  test('GET /health/db should return unhealthy when database is disconnected', async () => {
    // Mock database as disconnected
    mockGetConnectionStatus.mockReturnValue(false);

    const res = await request(app).get('/api/v1/health/db').expect(503);

    expect(res.body.data).toMatchObject({
      status: 'unhealthy',
      database: 'disconnected',
    });
    expect(res.body.data.timestamp).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(503);
  });

  test('GET /health/db should handle errors gracefully', async () => {
    // Mock database to throw an error
    mockGetConnectionStatus.mockImplementation(() => {
      throw new Error('Database error');
    });

    const res = await request(app).get('/api/v1/health/db').expect(500);

    expect(res.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Database error',
    });
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.success).toBe(false);
    expect(res.body.statusCode).toBe(500);
  });
});
