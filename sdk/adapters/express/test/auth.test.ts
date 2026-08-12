import { describe, expect, it } from 'vitest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { createExpressAdapter, toExpressRouter } from '../src/index.js';
import { buffered, createTestApp, makeFakeRuntime, okJson } from './helpers.js';

interface AuthedRequest extends Request {
  user?: { id: string };
}

function authMiddleware(userId: string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as AuthedRequest).user = userId ? { id: userId } : undefined;
    next();
  };
}

const unauthorized = buffered(
  401,
  JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'not authenticated' } }),
  { 'content-type': 'application/json' }
);

describe('user resolver — Express middleware pattern (resolveUserFrom)', () => {
  it('reads the identity the host middleware attached to req.user', async () => {
    const runtime = makeFakeRuntime(async (request) => okJson({ userId: request.userId }));
    const app = express();
    app.use(express.json());
    app.use('/api/persona', authMiddleware('user-123'));
    app.use(
      '/api/persona',
      toExpressRouter(runtime, (req) => (req as AuthedRequest).user?.id ?? null)
    );

    const res = await request(app).get('/api/persona/threads').expect(200);

    expect(res.body).toEqual({ userId: 'user-123' });
    expect(runtime.requests[0]?.userId).toBe('user-123');
  });

  it('leaves userId null when the resolver returns null → the runtime decides (401)', async () => {
    const runtime = makeFakeRuntime(async (request) =>
      request.userId ? okJson({ ok: true }) : unauthorized
    );
    const app = express();
    app.use(express.json());
    app.use('/api/persona', authMiddleware(undefined));
    app.use(
      '/api/persona',
      toExpressRouter(runtime, (req) => (req as AuthedRequest).user?.id ?? null)
    );

    await request(app).get('/api/persona/threads').expect(401);
    expect(runtime.requests[0]?.userId).toBeNull();
  });

  it('treats a throwing resolver as unauthenticated (null), never 500s', async () => {
    const runtime = makeFakeRuntime(async (request) =>
      request.userId ? okJson({ ok: true }) : unauthorized
    );
    const app = createTestApp(
      toExpressRouter(runtime, () => {
        throw new Error('session db down');
      })
    );

    await request(app).get('/api/persona/threads').expect(401);
    expect(runtime.requests[0]?.userId).toBeNull();
  });
});

describe('runtime-level resolveUser (no resolveUserFrom)', () => {
  it('leaves userId null for the runtime to resolve itself', async () => {
    const runtime = makeFakeRuntime(async (request) => okJson({ userId: request.userId }));
    const app = createTestApp(toExpressRouter(runtime));

    await request(app).get('/api/persona/health').expect(200);

    expect(runtime.requests[0]?.userId).toBeNull();
  });
});

describe('createExpressAdapter factory', () => {
  it('returns a router and a closeable runtime with resolveUserFrom wired', async () => {
    const adapter = createExpressAdapter({
      baseUrl: 'http://fake',
      credential: 'key.secret',
      resolveUserFrom: (req) => (req as AuthedRequest).user?.id ?? null,
    });

    expect(typeof adapter.router.use).toBe('function');
    expect(typeof adapter.runtime.handle).toBe('function');
    expect(typeof adapter.runtime.close).toBe('function');

    adapter.runtime.close();
  });

  it('throws when neither resolveUser nor resolveUserFrom is provided', () => {
    expect(() =>
      createExpressAdapter({ baseUrl: 'http://fake', credential: 'key.secret' })
    ).toThrow(/resolveUser/);
  });

  it('wires the resolver through a real runtime.handle() call (GET /health)', async () => {
    const adapter = createExpressAdapter({
      baseUrl: 'http://fake',
      credential: 'key.secret',
      resolveUserFrom: (req) => (req as AuthedRequest).user?.id ?? null,
      fetch: async () =>
        new Response(
          JSON.stringify({ success: true, data: { principalType: 'project', domain: 'test' } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    });
    const app = express();
    app.use('/api/persona', adapter.router);

    const res = await request(app).get('/api/persona/health').expect(200);

    expect(res.body.status).toBe('ok');
    adapter.runtime.close();
  });
});
