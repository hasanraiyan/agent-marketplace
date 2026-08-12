import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createExpressApp } from './express-server.js';
import { makeFakeRuntime, okJson } from '../test/helpers.js';

describe('express-server example wiring', () => {
  it('serves the runtime surface from /api/persona', async () => {
    const runtime = makeFakeRuntime(async () => okJson({ hello: 'world' }));
    const app = createExpressApp(runtime);

    const res = await request(app).get('/api/persona/health').expect(200);

    expect(res.body).toEqual({ hello: 'world' });
    expect(runtime.requests[0]?.path).toBe('/health');
  });
});
