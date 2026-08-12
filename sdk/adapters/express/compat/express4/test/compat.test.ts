/**
 * Express 4 compatibility suite — backs the `express >= 4` peer range claim.
 *
 * This package installs the adapter as a consumer would (`@personaai/express`
 * via a `file:` link → its built `dist/`) alongside `express@4`, and exercises
 * the same behaviors the main suite covers against Express 5. Run from the
 * adapter root with `pnpm test:express4`.
 */
import { describe, expect, it } from 'vitest';
import express from 'express';
import type { NextFunction, Request, Response, Router } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { toExpressRouter } from '@personaai/express';
import type { RuntimeRequest, RuntimeResponse } from '@personaai/runtime';

interface AuthedRequest extends Request {
  user?: { id: string };
}

function makeFakeRuntime(
  handler: (request: RuntimeRequest) => Promise<RuntimeResponse>
): { requests: RuntimeRequest[]; handle: (r: RuntimeRequest) => Promise<RuntimeResponse>; close: () => void } {
  const requests: RuntimeRequest[] = [];
  return {
    requests,
    async handle(request) {
      requests.push(request);
      return handler(request);
    },
    close() {},
  };
}

function buffered(
  status: number,
  body: string,
  headers: Record<string, string> = {}
): RuntimeResponse {
  return { kind: 'buffered', status, headers, body };
}

function createApp(router: Router): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/persona', router);
  return app;
}

function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

describe('@personaai/express on Express 4', () => {
  it('mounts at a path prefix and forwards mount-relative paths + query', async () => {
    const runtime = makeFakeRuntime(async () => buffered(200, '{"ok":true}', { 'content-type': 'application/json' }));
    const app = createApp(toExpressRouter(runtime));

    await request(app).get('/api/persona/threads?page=2').expect(200);

    expect(runtime.requests[0]?.path).toBe('/threads');
    expect(runtime.requests[0]?.query).toEqual({ page: '2' });
  });

  it('uses the host-parsed JSON body (express.json() coexistence)', async () => {
    const runtime = makeFakeRuntime(async () => buffered(200, '{"ok":true}', { 'content-type': 'application/json' }));
    const app = createApp(toExpressRouter(runtime));

    await request(app).post('/api/persona/chat').send({ agentId: 'a' }).expect(200);

    expect(runtime.requests[0]?.body).toEqual({ agentId: 'a' });
  });

  it('reads the raw stream when no body parser is mounted', async () => {
    const runtime = makeFakeRuntime(async () => buffered(200, '{"ok":true}', { 'content-type': 'application/json' }));
    const app = express();
    app.use('/api/persona', toExpressRouter(runtime));

    await request(app)
      .post('/api/persona/chat')
      .set('Content-Type', 'application/json')
      .send('{"agentId":"raw"}')
      .expect(200);

    expect(runtime.requests[0]?.body).toEqual({ agentId: 'raw' });
  });

  it('responds 400 INVALID_REQUEST for malformed JSON', async () => {
    const runtime = makeFakeRuntime(async () => buffered(200, '{}', { 'content-type': 'application/json' }));
    const app = express();
    app.use('/api/persona', toExpressRouter(runtime));

    const res = await request(app)
      .post('/api/persona/chat')
      .set('Content-Type', 'application/json')
      .send('{oops')
      .expect(400);

    expect(res.body).toEqual({ error: { code: 'INVALID_REQUEST', message: expect.any(String) } });
  });

  it('forwards buffered responses verbatim (status, headers, body)', async () => {
    const runtime = makeFakeRuntime(async () =>
      buffered(201, JSON.stringify({ id: 't1' }), {
        'content-type': 'application/json',
        'x-persona-run-id': 'run-1',
      })
    );
    const app = createApp(toExpressRouter(runtime));

    const res = await request(app).post('/api/persona/threads').expect(201);

    expect(res.headers['x-persona-run-id']).toBe('run-1');
    expect(res.body).toEqual({ id: 't1' });
  });

  it('passes through 204 and runtime 404 responses', async () => {
    const runtime = makeFakeRuntime(async (request) =>
      request.path === '/nope'
        ? buffered(404, JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no' } }), {
            'content-type': 'application/json',
          })
        : buffered(204, '')
    );
    const app = createApp(toExpressRouter(runtime));

    await request(app).delete('/api/persona/threads/x').expect(204);
    await request(app).get('/api/persona/nope').expect(404);
  });

  it('resolves the user via the Express middleware pattern', async () => {
    const runtime = makeFakeRuntime(async (request) =>
      buffered(200, JSON.stringify({ userId: request.userId }), { 'content-type': 'application/json' })
    );
    const app = express();
    app.use(express.json());
    app.use('/api/persona', (req: Request, _res: Response, next: NextFunction) => {
      (req as AuthedRequest).user = { id: 'user-9' };
      next();
    });
    app.use('/api/persona', toExpressRouter(runtime, (req) => (req as AuthedRequest).user?.id ?? null));

    const res = await request(app).get('/api/persona/threads').expect(200);

    expect(res.body).toEqual({ userId: 'user-9' });
    expect(runtime.requests[0]?.userId).toBe('user-9');
  });

  it('responds 401 when the resolver finds no authenticated user', async () => {
    const runtime = makeFakeRuntime(async (request) =>
      request.userId
        ? buffered(200, '{}', { 'content-type': 'application/json' })
        : buffered(401, JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'no' } }), {
            'content-type': 'application/json',
          })
    );
    const app = createApp(toExpressRouter(runtime));

    await request(app).get('/api/persona/threads').expect(401);
  });

  it('streams SSE frames with headers committed first', async () => {
    const runtime = makeFakeRuntime(async () => ({
      kind: 'stream',
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: (async function* () {
        yield 'data: {"type":"RUN_STARTED"}\n\n';
        yield 'data: {"type":"TEXT","delta":"hi"}\n\n';
        yield 'data: {"type":"RUN_COMPLETED"}\n\n';
      })(),
    }));
    const app = createApp(toExpressRouter(runtime));
    const { server, baseUrl } = await listen(app);

    try {
      const res = await fetch(`${baseUrl}/api/persona/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: 'a', messages: [] }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
      expect(await res.text()).toBe(
        'data: {"type":"RUN_STARTED"}\n\ndata: {"type":"TEXT","delta":"hi"}\n\ndata: {"type":"RUN_COMPLETED"}\n\n'
      );
    } finally {
      server.close();
    }
  });

  it('streams binary file downloads', async () => {
    const runtime = makeFakeRuntime(async () => ({
      kind: 'binary',
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
      body: (async function* () {
        yield new Uint8Array([1, 2, 3]);
        yield new Uint8Array([4, 5]);
      })(),
    }));
    const app = createApp(toExpressRouter(runtime));

    const res = await request(app).get('/api/persona/files/abc').expect(200);

    expect(res.headers['content-type']).toMatch(/octet-stream/);
    expect(res.body).toEqual(Buffer.from([1, 2, 3, 4, 5]));
  });

  it('parses multipart uploads natively', async () => {
    const runtime = makeFakeRuntime(async () => buffered(200, '{"ok":true}', { 'content-type': 'application/json' }));
    const app = createApp(toExpressRouter(runtime));

    await request(app)
      .post('/api/persona/files')
      .field('agentId', 'ag-1')
      .attach('file', Buffer.from('hello'), 'note.txt')
      .expect(200);

    const uploaded = runtime.requests[0]?.file;
    expect(uploaded?.filename).toBe('note.txt');
    expect(Buffer.from(uploaded!.content).toString()).toBe('hello');
    expect(runtime.requests[0]?.body).toEqual({ agentId: 'ag-1' });
  });
});
