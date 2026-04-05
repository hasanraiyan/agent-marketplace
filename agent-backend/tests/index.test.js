import { jest } from '@jest/globals';
import request from 'supertest';

describe('index.js root route', () => {
  let app;

  beforeAll(async () => {
    const { default: loggerService } = await import('../src/utils/logger/index.js');
    loggerService.setLogger({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    });
    app = (await import('../src/index.js')).default;
  });

  test('GET / should return connected when db is connected', async () => {
    const { default: database } = await import('../src/config/database.js');
    database.getConnectionStatus = jest.fn().mockReturnValue(true);

    const res = await request(app).get('/').expect(200);
    expect(res.body.message).toBe('Welcome to Agent Marketplace API');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.database).toBe('connected');
  });

  test('GET / should return disconnected when db is disconnected', async () => {
    const { default: database } = await import('../src/config/database.js');
    database.getConnectionStatus = jest.fn().mockReturnValue(false);

    const res = await request(app).get('/').expect(200);
    expect(res.body.database).toBe('disconnected');
  });

  test('GET / should return unknown when db getConnectionStatus throws', async () => {
    const { default: database } = await import('../src/config/database.js');
    database.getConnectionStatus = jest.fn().mockImplementation(() => {
      throw new Error('DB error');
    });

    const res = await request(app).get('/').expect(200);
    expect(res.body.database).toBe('unknown');
  });
});

describe('index.js server start', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  test('should not start server when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';

    const mockLogger = { info: jest.fn(), error: jest.fn() };
    const { default: loggerService } = await import('../src/utils/logger/index.js');
    loggerService.setLogger(mockLogger);

    jest.unstable_mockModule('../src/config/index.js', () => ({
      default: { port: 3000, jwt: {}, resend: {} },
    }));
    jest.unstable_mockModule('../src/config/jwt.config.js', () => ({
      default: { secret: 'test', expiresIn: '15m', refreshSecret: 'test', refreshExpiresIn: '7d' },
    }));
    jest.unstable_mockModule('../src/config/mail.config.js', () => ({
      resend: { emails: { send: jest.fn() } },
      mailgen: { generate: jest.fn(), generatePlaintext: jest.fn() },
    }));

    const mockListen = jest.fn();
    const mockRouter = { get: jest.fn(), post: jest.fn(), use: jest.fn() };
    jest.unstable_mockModule('express', () => {
      const express = () => ({ use: jest.fn(), get: jest.fn(), listen: mockListen });
      express.json = jest.fn();
      express.Router = jest.fn(() => mockRouter);
      return { default: express };
    });
    jest.unstable_mockModule('cors', () => ({ default: jest.fn() }));
    jest.unstable_mockModule('../src/config/database.js', () => ({
      default: {
        connect: jest.fn().mockResolvedValue({}),
        getConnectionStatus: jest.fn().mockReturnValue(true),
      },
    }));

    await import('../src/index.js');

    expect(mockListen).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
