import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import RateLimitError from '../src/utils/errors/RateLimitError.js';

// Mock dependencies
const mockAgentFactory = {
  buildAgent: jest.fn(),
};
const mockThreadRepository = {
  findById: jest.fn(),
};
const mockCheckpointService = {
  checkpointer: {},
};

// We need to mock the rateLimiterService because it's a singleton
// and we want to control its state across tests.
jest.unstable_mockModule('../src/modules/agents/agent.factory.js', () => ({
  default: mockAgentFactory,
}));
jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: mockThreadRepository,
}));
jest.unstable_mockModule('../src/modules/threads/checkpoint.service.js', () => ({
  default: mockCheckpointService,
}));

// Mock auth middleware to provide a user
const mockAuth = (req, res, next) => {
  req.user = { _id: 'test-user-id' };
  next();
};

jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: mockAuth,
}));

// Import the router after mocks
const { default: aguiRouter } = await import('../src/modules/agui/agui.routes.js');
const { default: rateLimiterService } =
  await import('../src/modules/rateLimiter/rateLimiter.service.js');

describe('Rate Limit Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/agui', aguiRouter);
    // Error handler for RateLimitError
    app.use((err, req, res, next) => {
      if (err instanceof RateLimitError || err.statusCode === 429) {
        return res.status(429).json({ error: err.message, retryAfter: err.retryAfter });
      }
      res.status(500).json({ error: err.message });
    });
  });

  beforeEach(() => {
    rateLimiterService.destroy();
    jest.clearAllMocks();
  });

  test('CHAT rate limit is enforced in agui routes', async () => {
    // CHAT is 20 req/min
    const identifier = 'test-user-id';
    const key = rateLimiterService.buildKey('CHAT', identifier);

    // Fill up the rate limit
    for (let i = 0; i < 20; i++) {
      await rateLimiterService.check(key, 20, 60000);
    }

    const response = await request(app)
      .post('/agui')
      .send({ messages: [{ role: 'user', content: 'hi' }] });

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Too many requests');
  });

  test('Concurrency cap blocks 3rd simultaneous run', async () => {
    const identifier = 'test-user-id';
    const concurrencyKey = `concurrency:CHAT:${identifier}`;

    // Mock 2 active runs
    rateLimiterService.incrementConcurrency(concurrencyKey);
    rateLimiterService.incrementConcurrency(concurrencyKey);

    const response = await request(app)
      .post('/agui')
      .send({ messages: [{ role: 'user', content: 'hi' }] });

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Too many requests');
    expect(rateLimiterService.getConcurrency(concurrencyKey)).toBe(2);
  });
});
