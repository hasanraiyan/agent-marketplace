import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/index.js';
import database from '../src/config/database.js';

describe('GET / (root)', () => {
  let originalGetConnectionStatus;

  beforeAll(() => {
    originalGetConnectionStatus = database.getConnectionStatus;
  });

  afterEach(() => {
    database.getConnectionStatus = originalGetConnectionStatus;
  });

  test('responds with status ok and message when database is connected', async () => {
    database.getConnectionStatus = jest.fn().mockReturnValue(true);
    const res = await request(app).get('/').expect(200);
    expect(res.body).toMatchObject({
      message: 'Welcome to Agent Marketplace API',
      database: 'connected',
    });
  });

  test('responds with status ok and message when database is disconnected', async () => {
    // Mock database as disconnected
    database.getConnectionStatus = jest.fn().mockReturnValue(false);

    const res = await request(app).get('/').expect(200);
    expect(res.body).toMatchObject({
      message: 'Welcome to Agent Marketplace API',
      database: 'disconnected',
    });
  });
});
