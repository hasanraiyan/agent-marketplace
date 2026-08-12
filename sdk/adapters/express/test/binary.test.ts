import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { toExpressRouter } from '../src/index.js';
import { createTestApp, makeFakeRuntime } from './helpers.js';

describe('binary responses (file downloads)', () => {
  it('streams Uint8Array chunks through to the client', async () => {
    const runtime = makeFakeRuntime(async () => ({
      kind: 'binary',
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
      body: (async function* () {
        yield new Uint8Array([1, 2, 3]);
        yield new Uint8Array([4, 5]);
      })(),
    }));
    const app = createTestApp(toExpressRouter(runtime));

    const res = await request(app).get('/api/persona/files/abc').expect(200);

    expect(res.headers['content-type']).toMatch(/octet-stream/);
    expect(res.body).toEqual(Buffer.from([1, 2, 3, 4, 5]));
  });
});
