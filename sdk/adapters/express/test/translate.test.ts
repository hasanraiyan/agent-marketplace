import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { toExpressRouter } from '../src/index.js';
import { buffered, createTestApp, makeFakeRuntime, okJson } from './helpers.js';

describe('Express → RuntimeRequest translation', () => {
  it('passes the mount-relative path and parsed query', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime));

    await request(app).get('/api/persona/threads?page=2&limit=10').expect(200);

    expect(runtime.requests[0]?.path).toBe('/threads');
    expect(runtime.requests[0]?.query).toEqual({ page: '2', limit: '10' });
  });

  it('forwards method, headers, and leaves body undefined for bodyless requests', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime));

    await request(app).delete('/api/persona/threads/abc').set('x-custom', 'hello').expect(200);

    expect(runtime.requests[0]?.method).toBe('DELETE');
    expect(runtime.requests[0]?.body).toBeUndefined();
    expect(runtime.requests[0]?.headers['x-custom']).toBe('hello');
    expect(runtime.requests[0]?.headers['content-type']).toBeUndefined();
  });

  it('uses the host-parsed JSON body when express.json() is mounted', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime));

    await request(app)
      .post('/api/persona/chat')
      .send({ agentId: 'a', messages: [{ role: 'user', text: 'hi' }] })
      .expect(200);

    expect(runtime.requests[0]?.body).toEqual({
      agentId: 'a',
      messages: [{ role: 'user', text: 'hi' }],
    });
  });

  it('reads and parses the raw JSON stream when no body parser is mounted', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime), { json: false });

    await request(app)
      .post('/api/persona/chat')
      .set('Content-Type', 'application/json')
      .send('{"agentId":"raw"}')
      .expect(200);

    expect(runtime.requests[0]?.body).toEqual({ agentId: 'raw' });
  });

  it('responds 400 INVALID_REQUEST for malformed JSON', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ ok: true }));
    const app = createTestApp(toExpressRouter(runtime), { json: false });

    const res = await request(app)
      .post('/api/persona/chat')
      .set('Content-Type', 'application/json')
      .send('{not json')
      .expect(400);

    expect(res.body).toEqual({ error: { code: 'INVALID_REQUEST', message: expect.any(String) } });
    expect(runtime.requests).toHaveLength(0);
  });
});

describe('buffered response fidelity', () => {
  it('forwards status, headers, and body verbatim', async () => {
    const runtime = makeFakeRuntime(async () =>
      buffered(200, JSON.stringify({ hello: 'world' }), {
        'content-type': 'application/json',
        'x-persona-run-id': 'run-1',
      })
    );
    const app = createTestApp(toExpressRouter(runtime));

    const res = await request(app).get('/api/persona/chat').expect(200);

    expect(res.headers['x-persona-run-id']).toBe('run-1');
    expect(res.body).toEqual({ hello: 'world' });
  });

  it('passes through 204 no-content', async () => {
    const runtime = makeFakeRuntime(async () => buffered(204, ''));
    const app = createTestApp(toExpressRouter(runtime));

    const res = await request(app).delete('/api/persona/threads/abc').expect(204);
    expect(res.text).toBe('');
  });

  it('passes through runtime 404 and 405 responses untouched', async () => {
    const runtime = makeFakeRuntime(async () =>
      buffered(404, JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no route' } }), {
        'content-type': 'application/json',
      })
    );
    const app = createTestApp(toExpressRouter(runtime));

    const res = await request(app).get('/api/persona/nope').expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'no route' } });
  });

  it('exposes runtime.close() and close() flips the flag', () => {
    const runtime = makeFakeRuntime(async () => okJson({}));
    const router = toExpressRouter(runtime);
    expect(typeof router.use).toBe('function');
    runtime.close();
    expect(runtime.closed).toBe(true);
  });
});
