import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

/**
 * Route-level regression test for the Architect ("Sage") thread-resume bug:
 * threadRepository.findById() always populates `agentId`, and Mongoose nulls
 * out an unresolvable populate ref — which every Architect thread has, since
 * ARCHITECT_AGENT_ID has no real Agent document backing it. Comparing the
 * populated (now-null) agentId against the sentinel string always failed,
 * 404ing every single Architect conversation ("Thread not found").
 */

jest.unstable_mockModule('../src/modules/auth/auth.middleware.js', () => ({
  default: (req, res, next) => {
    req.user = { _id: 'user-1' };
    next();
  },
}));

jest.unstable_mockModule('../src/modules/threads/thread.repository.js', () => ({
  default: {
    findById: jest.fn(),
    touchLastMessageAt: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.unstable_mockModule('../src/modules/agui/agui.controller.js', () => ({
  default: {
    getProtocolInfo: jest.fn((req, res) => res.json({ ok: true })),
    runAgent: jest.fn((req, res) => res.status(200).json({ ok: true })),
  },
}));

const threadRepository = (await import('../src/modules/threads/thread.repository.js')).default;
const { ARCHITECT_AGENT_ID } = await import('../src/modules/agents/architectConstants.js');
const { default: aguiRouter } = await import('../src/modules/agui/agui.routes.js');

describe('agui.routes.js — Architect thread resume', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/agui', aguiRouter);
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    threadRepository.touchLastMessageAt.mockResolvedValue(undefined);
  });

  test('resumes an Architect thread whose populate comes back null', async () => {
    threadRepository.findById.mockResolvedValue({
      _id: 'thread-1',
      userId: 'user-1',
      agentId: null, // unresolvable populate — true of every real Architect thread
      threadId: 'lg-thread-1',
    });

    const res = await request(app)
      .post('/api/v1/agui')
      .set('x-agent-id', ARCHITECT_AGENT_ID)
      .set('x-thread-id', 'thread-1')
      .send({ messages: [] });

    expect(res.status).toBe(200);
    expect(threadRepository.touchLastMessageAt).toHaveBeenCalledWith('thread-1');
  });

  test('still 404s a real-agent thread that belongs to someone else', async () => {
    threadRepository.findById.mockResolvedValue({
      _id: 'thread-2',
      userId: 'someone-else',
      agentId: { _id: 'agent-1' },
      threadId: 'lg-thread-2',
    });

    const res = await request(app)
      .post('/api/v1/agui')
      .set('x-agent-id', 'agent-1')
      .set('x-thread-id', 'thread-2')
      .send({ messages: [] });

    expect(res.status).toBe(404);
  });

  test('still 404s claiming the Architect sentinel against a real, populated agent thread (no spoofing)', async () => {
    threadRepository.findById.mockResolvedValue({
      _id: 'thread-3',
      userId: 'user-1',
      agentId: { _id: 'agent-1' }, // real agent, populated fine — not the Architect
      threadId: 'lg-thread-3',
    });

    const res = await request(app)
      .post('/api/v1/agui')
      .set('x-agent-id', ARCHITECT_AGENT_ID)
      .set('x-thread-id', 'thread-3')
      .send({ messages: [] });

    expect(res.status).toBe(404);
  });

  test('matches a normal real-agent thread by populated agentId._id', async () => {
    threadRepository.findById.mockResolvedValue({
      _id: 'thread-4',
      userId: 'user-1',
      agentId: { _id: 'agent-1' },
      threadId: 'lg-thread-4',
    });

    const res = await request(app)
      .post('/api/v1/agui')
      .set('x-agent-id', 'agent-1')
      .set('x-thread-id', 'thread-4')
      .send({ messages: [] });

    expect(res.status).toBe(200);
  });
});
